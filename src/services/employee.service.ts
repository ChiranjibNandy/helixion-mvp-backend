import { getApprovalStatsRepo, getDashboardSummaryRepo, getListedProgramsRepo } from "../repositories/employee.repository.js";
import { getEmployeeProgramsListRepo, getEmployeeProgramByIdRepo, getAvailableProgramsPaginatedRepo } from "../repositories/program.repository.js";
import { SubmitTourFormDto } from "../dtos/enrollment.dto.js";
import {
   createEnrollmentRepo,
   findExistingEnrollmentRepo,
   getEmployeeEnrollmentsRepo,
   getEnrollmentDetailsRepo,
   findEnrollmentForReimbursementSubmitRepo,
   submitReimbursementRepo,
   getEmployeeNotificationTimelineRepo,
   countPendingEnrollmentsForStageRepo,
   countPendingTourApprovalsForCtdRepo,
} from "../repositories/enrollment.repository.js";
import userModel from "../models/user.model.js";
import enrollmentModel from "../models/enrollment.model.js";
import { organizationModel } from "../models/organization.model.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   ENROLLMENT_STAGE,
   TOUR_STATUS,
   REIMBURSEMENT_STATUS,
   MANAGER_ACTION,
   MANAGER_CHAIN_STATUS,
   ACTOR_TYPE,
   ATTENDANCE_RECORD_STATUS,
   EMPLOYEE_TIMELINE_ACTION,
   ENROLLMENT_STATUS_SUMMARY,
   TRAINING_DEPT_SENIOR_ACTION,
   TIMELINE_ACTION,
   TRAVEL_TYPE,
   TOUR_CTD_ACTION,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { resolveEnrollmentFee } from "../utils/fee.js";
import { isLocalTraining, resolveProgramTitle, loadNotificationContext, logMailFailure } from "../utils/notification.util.js";
import { sendSelfTravelSelectedMail, sendTravelRequestSubmittedMail } from "../utils/sendMail.js";
import { ITimelineEntry } from "../interfaces/enrollment.interface.js";
import { IUser } from "../interfaces/user.interface.js";


export const getEmployeeDashboardService = async (userId: string) => {
  const [summary, approvalStats, listedPrograms, user] = await Promise.all([
    getDashboardSummaryRepo(userId),
    getApprovalStatsRepo(userId),
    getListedProgramsRepo(userId),
    userModel.findById(userId).select("orgId officeRoles.trainingDept").lean(),
  ]);

  // A CTD officer's own personal "pendingApprovals" (enrollments THEY
  // submitted awaiting a manager) is rarely what they actually care about
  // on this dashboard — they land here because there's no separate CTD
  // dashboard. Mirror the same override already applied to the Manager
  // dashboard: replace it with the count of items actually awaiting THEIR
  // CTD action (main enrollment queue + tour queue combined), so "Pending
  // Approvals" / "Awaiting your review" means something real for them.
  const trainingDeptRole = (user as any)?.officeRoles?.trainingDept;
  if (trainingDeptRole?.enabled && (user as any)?.orgId) {
    const orgId = String((user as any).orgId);
    const [ctdMainPendingCount, ctdTourPendingCount] = await Promise.all([
      countPendingEnrollmentsForStageRepo(orgId, ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW),
      countPendingTourApprovalsForCtdRepo(orgId),
    ]);
    summary.pendingApprovals = ctdMainPendingCount + ctdTourPendingCount;
  }

  return { summary, approvalStats, listedPrograms };
};

export const getAvailableProgramsService = async (params: {
  page:      number;
  limit:     number;
  search?:   string;
  venue?:    string;
  fromDate?: string;
  toDate?:   string;
}) => {
  return await getAvailableProgramsPaginatedRepo(params);
};

export const getEmployeeProgramsListService = async (params: {
   page: number;
   limit: number;
   search?: string;
   venue?: string;
   fromDate?: string;
   toDate?: string;
}) => {
   return await getEmployeeProgramsListRepo(params);
};

export const getEmployeeProgramByIdService = async (id: string) => {
   const program = await getEmployeeProgramByIdRepo(id);
   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }
   return program;
};

export const enrollInProgramService = async (
   userId: string,
   programId: string,
   stayType: string,
   notes?: string,
   travelAndStayInput?: any
) => {
   // 1. Verify program exists and is published
   const program = await getEmployeeProgramByIdRepo(programId);
   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // 2. Check if already enrolled (active or pending)
   const existing = await findExistingEnrollmentRepo(userId, programId);
   if (existing) {
      throw new AppError(MESSAGES.ENROLLMENT_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
   }

   // 3. Retrieve user to get orgId and reporting manager (assignedApproverId)
   const user = await userModel.findById(userId);
   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // 3.5. Retrieve organization to get its policy
   const organization = await organizationModel.findById((user as any).orgId);
   if (!organization) {
      throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // 4. Resolve fee from stayOptions array
   const feeAmount = resolveEnrollmentFee(program, stayType);

   // 5. Structure travel and stay details
   const managerApprovalRequired = organization.policy?.tourApproval?.managerApprovalRequired ?? true;
   const ctdApprovalRequired = organization.policy?.tourApproval?.ctdApprovalRequired ?? true;

   const travelType = travelAndStayInput?.travelType || TRAVEL_TYPE.LOCAL;

   let initialTourStatus = TOUR_STATUS.NOT_REQUIRED;
   if (travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
      initialTourStatus = managerApprovalRequired ? TOUR_STATUS.SUBMITTED : (ctdApprovalRequired ? TOUR_STATUS.MANAGER_APPROVED : TOUR_STATUS.CTD_APPROVED);
   }

   const travelAndStay = {
      stayType,
      placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venueName || "",
      frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
      modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
      purpose: travelAndStayInput?.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayInput?.bookingDetails || [],
      advancePaymentRequired: travelAndStayInput?.advancePaymentRequired ?? 0,
      status: managerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
      managerAction: managerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      managerReason: ""
   };

   const tour = {
      travelType,
      status: initialTourStatus,
      details: {
         placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venueName || "",
         frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
         modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
         purpose: travelAndStayInput?.purpose || "To Attend Training Program",
         advancePaymentRequired: travelAndStayInput?.advancePaymentRequired ?? 0,
         bookingDetails: travelAndStayInput?.bookingDetails || [],
      },
      managerApproval: {
         action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && managerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      },
      ctdApproval: {
         action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && ctdApprovalRequired ? TOUR_CTD_ACTION.WAITING : TOUR_CTD_ACTION.APPROVE,
      }
   };


   // 6. Build enrollment payload
   const user_hierarchy = (user as any).hierarchy || {};
   const managerChain = (user_hierarchy.managerChain || []).map((entry: any) => ({
      userId: entry.userId,
      level:  entry.level,
      status: MANAGER_CHAIN_STATUS.WAITING,
   }));
   // Activate the first level immediately
   if (managerChain.length > 0) {
      managerChain[0].status = MANAGER_CHAIN_STATUS.PENDING;
   }

   const enrollmentPayload: any = {
      orgId: (user as any).orgId,
      employeeId: toObjectId(userId),
      programId: toObjectId(programId),
      providerOrgId: (program as any).providerOrgId || (program as any).createdBy,
      currentStage: ENROLLMENT_STAGE.SUBMITTED,
      statusSummary: {
         enrollmentStatus: "submitted",
         tourStatus: managerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
         attendanceStatus: ATTENDANCE_RECORD_STATUS.PENDING,
         reimbursementStatus: REIMBURSEMENT_STATUS.NOT_STARTED
      },
      policySnapshot: {
         managerApproval: organization.policy?.managerApproval || { levels: 3, minLevelToApprove: 1 },
         trainingDeptApproval: organization.policy?.trainingDeptApproval || { enabled: true, levels: 2, minLevelToApprove: 2 },
         osdReview: organization.policy?.osdReview || { enabled: true, levels: 2, minLevelToApprove: 2 },
         tourApproval: organization.policy?.tourApproval || { managerApprovalRequired: true, ctdApprovalRequired: true },
         reimbursementApproval: organization.policy?.reimbursementApproval || { managerApprovalRequired: true, osdApprovalRequired: true }
      },
      managerChain,
      managerApproval: {
         assignedApproverId: (user_hierarchy.managerId) || null,
         action: MANAGER_ACTION.PENDING,
         note: ""
      },
      travelAndStay,
      tour,
      notes,
      timeline: [
         {
            stage: ENROLLMENT_STAGE.SUBMITTED,
            actorId: toObjectId(userId),
            actorType: ACTOR_TYPE.EMPLOYEE,
            action: EMPLOYEE_TIMELINE_ACTION.CREATED,
            note: "Enrollment request submitted",
            at: new Date()
         }
      ]
   };


   // Save to DB
   const created = await createEnrollmentRepo(enrollmentPayload);

   return {
      enrollmentId: created._id.toString(),
      currentStage: created.currentStage,
      feeAmount,
      currency: "INR",
      programSnapshot: {
         title: program.title,
         startDate: program.startDate ? program.startDate.toISOString() : undefined,
         endDate: program.endDate ? program.endDate.toISOString() : undefined,
         venueName: program.venueName,
         city: program.city,
         training_providerId: created.providerOrgId?.toString(),
      }
   };

};

export const getEmployeeEnrollmentsService = async (userId: string) => {
   return await getEmployeeEnrollmentsRepo(userId);
};

export const getEnrollmentDetailsService = async (id: string, userId: string) => {
   const enrollmentObj = await getEnrollmentDetailsRepo(id, userId);
   if (!enrollmentObj) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }
   return enrollmentObj;
};

export const updateTravelDetailsService = async (
   userId: string,
   enrollmentId: string,
   travelAndStayData: SubmitTourFormDto
) => {
   const travelType = travelAndStayData.travelType || TRAVEL_TYPE.LOCAL;

   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id: toObjectId(enrollmentId),
         $or: [
            { employeeId: toObjectId(userId) },
            { userId: toObjectId(userId) }
         ]
      },
      [
         {
            $set: {
               "travelAndStay.stayType": { $ifNull: ["$travelAndStay.stayType", "twin_sharing"] },
               "travelAndStay.placeOfTour": travelAndStayData.placeOfTour || "",
               "travelAndStay.frequentFlyerNo": travelAndStayData.frequentFlyerNo || "",
               "travelAndStay.modeOfTravel": travelAndStayData.modeOfTravel || "flight",
               "travelAndStay.purpose": travelAndStayData.purpose || "To Attend Training Program",
               "travelAndStay.bookingDetails": travelAndStayData.bookingDetails || [],
               "travelAndStay.advancePaymentRequired": travelAndStayData.advancePaymentRequired ?? 0,
               "travelAndStay.status": {
                  $cond: {
                     if: { $eq: [{ $ifNull: ["$policySnapshot.tourApproval.managerApprovalRequired", true] }, true] },
                     then: TOUR_STATUS.SUBMITTED,
                     else: TOUR_STATUS.APPROVED
                  }
               },
               "travelAndStay.managerAction": {
                  $cond: {
                     if: { $eq: [{ $ifNull: ["$policySnapshot.tourApproval.managerApprovalRequired", true] }, true] },
                     then: MANAGER_ACTION.PENDING,
                     else: MANAGER_ACTION.APPROVE
                  }
               },
               "travelAndStay.managerReason": "",

               "tour.travelType": travelType,
               "tour.status": {
                  $cond: {
                     if: { $eq: [travelType, TRAVEL_TYPE.COMPANY_ASSISTED] },
                     then: {
                        $cond: {
                           if: { $eq: [{ $ifNull: ["$policySnapshot.tourApproval.managerApprovalRequired", true] }, true] },
                           then: TOUR_STATUS.SUBMITTED,
                           else: {
                              $cond: {
                                 if: { $eq: [{ $ifNull: ["$policySnapshot.tourApproval.ctdApprovalRequired", true] }, true] },
                                 then: TOUR_STATUS.MANAGER_APPROVED,
                                 else: TOUR_STATUS.CTD_APPROVED
                              }
                           }
                        }
                     },
                     else: TOUR_STATUS.NOT_REQUIRED
                  }
               },
               "tour.details.placeOfTour": travelAndStayData.placeOfTour || { $ifNull: ["$tour.details.placeOfTour", ""] },
               "tour.details.frequentFlyerNo": travelAndStayData.frequentFlyerNo || { $ifNull: ["$tour.details.frequentFlyerNo", ""] },
               "tour.details.modeOfTravel": travelAndStayData.modeOfTravel || { $ifNull: ["$tour.details.modeOfTravel", "flight"] },
               "tour.details.purpose": travelAndStayData.purpose || { $ifNull: ["$tour.details.purpose", "To Attend Training Program"] },
               "tour.details.advancePaymentRequired": travelAndStayData.advancePaymentRequired ?? { $ifNull: ["$tour.details.advancePaymentRequired", 0] },
               "tour.details.bookingDetails": travelAndStayData.bookingDetails || { $ifNull: ["$tour.details.bookingDetails", []] },
               "tour.managerApproval.action": {
                  $cond: {
                     if: {
                        $and: [
                           { $eq: [travelType, TRAVEL_TYPE.COMPANY_ASSISTED] },
                           { $eq: [{ $ifNull: ["$policySnapshot.tourApproval.managerApprovalRequired", true] }, true] }
                        ]
                     },
                     then: MANAGER_ACTION.PENDING,
                     else: MANAGER_ACTION.APPROVE
                  }
               },
               "tour.ctdApproval.action": {
                  $cond: {
                     if: {
                        $and: [
                           { $eq: [travelType, TRAVEL_TYPE.COMPANY_ASSISTED] },
                           { $eq: [{ $ifNull: ["$policySnapshot.tourApproval.ctdApprovalRequired", true] }, true] }
                        ]
                     },
                     then: TOUR_CTD_ACTION.WAITING,
                     else: TOUR_CTD_ACTION.APPROVE
                  }
               }
            }
         },
         {
            $set: {
               timeline: {
                  $concatArrays: [
                     { $ifNull: ["$timeline", []] },
                     [{
                        stage: "$currentStage",
                        actorId: toObjectId(userId),
                        actorType: ACTOR_TYPE.EMPLOYEE,
                        action: EMPLOYEE_TIMELINE_ACTION.UPDATED_TRAVEL,
                        note: "Updated travel and stay details",
                        at: new Date()
                     }]
                  ]
               }
            }
         }
      ],
      // Mongoose 9 requires explicitly opting in to aggregation-pipeline
      // (array) updates — previously auto-detected, now throws
      // "Cannot pass an array to query updates unless the `updatePipeline`
      // option is set" without this.
      { new: true, updatePipeline: true }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return updated;
};

export const submitEnrollmentService = async (userId: string, enrollmentId: string) => {
   const enrollmentObj = await enrollmentModel.findOne({
      _id: toObjectId(enrollmentId),
      $or: [
         { employeeId: toObjectId(userId) },
         { userId: toObjectId(userId) }
      ]
   });

   if (!enrollmentObj) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const tourManagerApprovalRequired = enrollmentObj.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;
   enrollmentObj.currentStage = ENROLLMENT_STAGE.MANAGER_REVIEW;
   enrollmentObj.statusSummary.enrollmentStatus = ENROLLMENT_STATUS_SUMMARY.SUBMITTED;
   enrollmentObj.statusSummary.tourStatus = tourManagerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED;

   if (!enrollmentObj.timeline) {
      enrollmentObj.timeline = [];
   }
   enrollmentObj.timeline.push({
      stage: ENROLLMENT_STAGE.MANAGER_REVIEW,
      actorId: toObjectId(userId),
      actorType: ACTOR_TYPE.EMPLOYEE,

      action: EMPLOYEE_TIMELINE_ACTION.SUBMITTED,
      note: "Submitted for manager approval",
      at: new Date()
   });

   await enrollmentObj.save();
   return enrollmentObj;
};

// Atomic findOneAndUpdate (via the repository) instead of find+save —
// eliminates the race where two concurrent submit requests could both read
// status=NOT_STARTED and both write, double-processing the same claim.
// A pre-check find is kept purely to produce a specific error message
// (not found vs. not yet enabled vs. already submitted); the actual state
// change is guarded by the same conditions atomically. If the pre-check
// passes but the atomic update still returns null, another request won the
// race between the two — treated as "already submitted".
export const submitReimbursementService = async (
   userId: string,
   enrollmentId: string,
   expenses: { travelCost: number; accommodationCost: number; foodCost: number },
   receipts: string[]
) => {
   const existing = await findEnrollmentForReimbursementSubmitRepo(enrollmentId, userId);

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (!existing.reimbursement?.enabled) {
      throw new AppError(MESSAGES.REIMBURSEMENT_NOT_ENABLED, HTTP_STATUS.CONFLICT);
   }

   if (existing.reimbursement.status !== REIMBURSEMENT_STATUS.NOT_STARTED) {
      throw new AppError(MESSAGES.REIMBURSEMENT_ALREADY_SUBMITTED, HTTP_STATUS.CONFLICT);
   }

   const totalAmount = expenses.travelCost + expenses.accommodationCost + expenses.foodCost;

   const updated = await submitReimbursementRepo(
      enrollmentId,
      userId,
      {
         "reimbursement.expenses":    expenses,
         "reimbursement.receipts":    receipts,
         "reimbursement.totalAmount": totalAmount,
         "reimbursement.status":      REIMBURSEMENT_STATUS.SUBMITTED,
         currentStage:                ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
      },
      {
         stage:     ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
         actorId:   toObjectId(userId),
         actorType: ACTOR_TYPE.EMPLOYEE,
         action:    EMPLOYEE_TIMELINE_ACTION.SUBMITTED,
         note:      "Reimbursement claim submitted",
         at:        new Date(),
      }
   );

   if (!updated) {
      throw new AppError(MESSAGES.REIMBURSEMENT_ALREADY_SUBMITTED, HTTP_STATUS.CONFLICT);
   }

   return updated;
};

// ─────────────────────────────────────────────────────────────────────────────
// Employee notifications (ticket 0033) — derived on read from each of the
// employee's enrollments' timeline[] entries, filtered to the workflow events
// that have real triggers today. No persistence, no schema changes: the
// timeline sub-schema already exists and is populated by the manager /
// trainingDept / attendance / osd services.
//
// NOTIFICATION_RULES is the single source of truth for "which timeline
// entries count as a notification, and what do they say" — adding a new
// event (e.g. once ticket 0030's tour workflow lands) is a new entry in this
// array, not a change to the matching/derivation loop below. `isLocalTraining`
// is shared with trainingDept.service.ts's email-selection logic so the
// local/outstation DECISION LOGIC can't diverge between the two call sites —
// it does NOT guarantee an already-sent email will forever match this live
// re-computation, since this runs against the employee/program's CURRENT
// data on every read. If placeOfPosting or program.city is edited after
// approval, a historical email can end up disagreeing with the bell; that's
// an accepted tradeoff of deriving from live state rather than snapshotting
// at approval time.
//
// Matching below is first-match-wins (Array.find, not filter) — each rule's
// `matches` predicate must stay mutually exclusive from the others. When
// adding a new rule, check it can't also match an entry an existing rule
// already claims (this is exactly how the reimbursement/enrollment-reject
// collision bug happened — same actorType, same bare action string).
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationContext {
   programTitle: string;
   program:      any;
   employee:     IUser | null;
}

interface NotificationRule {
   type:         string;
   matches:      (entry: ITimelineEntry) => boolean;
   buildMessage: (ctx: NotificationContext) => string;
}

const NOTIFICATION_RULES: NotificationRule[] = [
   {
      type:    "enrollment_rejected",
      matches: (entry) => entry.actorType === ACTOR_TYPE.MANAGER && entry.action === MANAGER_ACTION.REJECT,
      buildMessage: ({ programTitle }) =>
         `Your enrollment request for ${programTitle} has been rejected by your manager.`,
   },
   {
      type:    "enrollment_approved",
      matches: (entry) => entry.actorType === ACTOR_TYPE.TRAINING_DEPT && entry.action === TRAINING_DEPT_SENIOR_ACTION.APPROVE,
      buildMessage: ({ programTitle, program, employee }) =>
         isLocalTraining(employee?.placeOfPosting, program?.city)
            ? `Your enrollment for ${programTitle} has been approved. No travel action is required.`
            : `Your enrollment for ${programTitle} has been approved. Please coordinate travel arrangements with the Training Department.`,
   },
   {
      // For orgs with Training Dept review disabled, takeManagerActionService
      // applies the local/outstation branch itself and the timeline's `stage`
      // lands on APPROVED directly — distinguishes this from an intermediate
      // multi-level chain approval, which leaves `stage` unchanged.
      type:    "enrollment_approved",
      matches: (entry) => entry.actorType === ACTOR_TYPE.MANAGER && entry.action === MANAGER_ACTION.APPROVE && entry.stage === ENROLLMENT_STAGE.APPROVED,
      buildMessage: ({ programTitle }) =>
         `Your enrollment for ${programTitle} has been approved. No travel action is required.`,
   },
   {
      type:    "enrollment_approved",
      matches: (entry) => entry.actorType === ACTOR_TYPE.MANAGER && entry.action === MANAGER_ACTION.APPROVE && entry.stage === ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE,
      buildMessage: ({ programTitle }) =>
         `Your enrollment for ${programTitle} has been approved. Please coordinate travel arrangements with the Training Department.`,
   },
   {
      // Not one of the ticket's 12 named events, but its approval counterpart
      // (above) is — a Training Dept rejection producing zero notification
      // was a gap found while testing, matching the reimbursement-reject fix.
      type:    "enrollment_rejected",
      matches: (entry) => entry.actorType === ACTOR_TYPE.TRAINING_DEPT && entry.action === TRAINING_DEPT_SENIOR_ACTION.REJECT,
      buildMessage: ({ programTitle }) =>
         `Your enrollment request for ${programTitle} has been rejected by the Training Department.`,
   },
   {
      type:    "attendance_present",
      matches: (entry) => entry.actorType === ACTOR_TYPE.SYSTEM && entry.action === TIMELINE_ACTION.ATTENDANCE_PRESENT,
      buildMessage: ({ programTitle }) =>
         `Your attendance for ${programTitle} has been marked as Present. You may now submit your reimbursement claim.`,
   },
   {
      type:    "attendance_absent",
      matches: (entry) => entry.actorType === ACTOR_TYPE.SYSTEM && entry.action === TIMELINE_ACTION.ATTENDANCE_ABSENT,
      buildMessage: ({ programTitle }) =>
         `You have been marked as absent for ${programTitle}. Reimbursement submission is not available.`,
   },
   {
      type:    "reimbursement_approved",
      matches: (entry) => entry.actorType === ACTOR_TYPE.OSD && entry.action === TIMELINE_ACTION.REIMBURSEMENT_OSD_APPROVE,
      buildMessage: ({ programTitle }) =>
         `Your reimbursement claim for ${programTitle} has been approved.`,
   },
   // Not one of the ticket's 12 named events, but its approval counterpart
   // is — a rejected reimbursement claim producing zero notification at all
   // (found in code review) was a gap, not a deliberate scope decision.
   {
      type:    "reimbursement_rejected",
      matches: (entry) => entry.actorType === ACTOR_TYPE.MANAGER && entry.action === TIMELINE_ACTION.REIMBURSEMENT_MANAGER_REJECT,
      buildMessage: ({ programTitle }) =>
         `Your reimbursement claim for ${programTitle} was not approved by your manager.`,
   },
   {
      type:    "reimbursement_rejected",
      matches: (entry) => entry.actorType === ACTOR_TYPE.OSD && entry.action === TIMELINE_ACTION.REIMBURSEMENT_OSD_REJECT,
      buildMessage: ({ programTitle }) =>
         `Your reimbursement claim for ${programTitle} was not approved by OSD.`,
   },
   {
      type:    "self_travel_selected",
      matches: (entry) => entry.actorType === ACTOR_TYPE.EMPLOYEE && entry.action === EMPLOYEE_TIMELINE_ACTION.TOUR_FORM_SUBMITTED && !entry.note?.includes("company_assisted"),
      buildMessage: ({ programTitle }) =>
         `You have chosen to make your own travel arrangements for ${programTitle}. You will be able to submit reimbursement after attendance is marked as Present.`,
   },
   {
      type:    "travel_request_submitted",
      matches: (entry) => entry.actorType === ACTOR_TYPE.EMPLOYEE && entry.action === EMPLOYEE_TIMELINE_ACTION.TOUR_FORM_SUBMITTED && (entry.note?.includes("company_assisted") ?? false),
      buildMessage: ({ programTitle }) =>
         `Your company-assisted travel request for ${programTitle} has been submitted and is awaiting manager approval.`,
   },
   {
      type:    "travel_under_ctd_review",
      matches: (entry) => entry.actorType === ACTOR_TYPE.MANAGER && entry.action === TIMELINE_ACTION.TOUR_MANAGER_APPROVE,
      buildMessage: ({ programTitle }) =>
         `Your company-assisted travel request for ${programTitle} has been approved by your manager and is awaiting Training Dept approval.`,
   },
   {
      type:    "travel_rejected_by_manager",
      matches: (entry) => entry.actorType === ACTOR_TYPE.MANAGER && entry.action === TIMELINE_ACTION.TOUR_MANAGER_REJECT,
      buildMessage: ({ programTitle }) =>
         `Your company-assisted travel request for ${programTitle} was not approved by your manager.`,
   },
   {
      type:    "travel_approved",
      matches: (entry) => entry.actorType === ACTOR_TYPE.TRAINING_DEPT && entry.action === TIMELINE_ACTION.TOUR_CTD_APPROVE,
      buildMessage: ({ programTitle }) =>
         `Your company-assisted travel request for ${programTitle} has been approved. Please proceed with the approved travel arrangements.`,
   },
   {
      type:    "travel_rejected_by_ctd",
      matches: (entry) => entry.actorType === ACTOR_TYPE.TRAINING_DEPT && entry.action === TIMELINE_ACTION.TOUR_CTD_REJECT,
      buildMessage: ({ programTitle }) =>
         `Your company-assisted travel request for ${programTitle} was not approved by the Training Department. You may proceed with self-arranged travel and submit reimbursement after training completion.`,
   },
   {
      type:    "travel_timed_out",
      matches: (entry) => entry.actorType === ACTOR_TYPE.SYSTEM && entry.action === TIMELINE_ACTION.TOUR_CTD_TIMEOUT,
      buildMessage: ({ programTitle }) =>
         `Your company-assisted travel request for ${programTitle} could not be processed within the required time. You may proceed with self-arranged travel and submit reimbursement after training completion.`,
   },
];

const NOTIFICATION_LIMIT = 50;

export const getEmployeeNotificationsService = async (userId: string) => {
   const [enrollments, employee] = await Promise.all([
      getEmployeeNotificationTimelineRepo(userId),
      userModel.findById(userId),
   ]);

   const notifications: {
      id: string;
      type: string;
      message: string;
      enrollmentId: string;
      at: Date;
   }[] = [];

   for (const enrollment of enrollments) {
      const program = enrollment.programId as any;
      const programTitle = resolveProgramTitle(program);
      const enrollmentId = enrollment._id.toString();
      const ctx: NotificationContext = { programTitle, program, employee };

      for (const entry of enrollment.timeline || []) {
         const rule = NOTIFICATION_RULES.find((r) => r.matches(entry));
         if (!rule) continue;

         notifications.push({
            id:           `${enrollmentId}-${new Date(entry.at).getTime()}`,
            type:         rule.type,
            message:      rule.buildMessage(ctx),
            enrollmentId,
            at:           entry.at,
         });
      }
   }

   notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

   return notifications.slice(0, NOTIFICATION_LIMIT);
};

// Submit tour form (post-CTD approval)
//
// Called when the enrollment is at TOUR_PENDING_EMPLOYEE stage.
// Employee chooses between self_travel (no approval needed) or
// company_assisted (requires manager and/or OSD approval).
//
// Atomicity: single findOneAndUpdate with stage filter — prevents
// double-processing if two requests race on the same enrollment.
// ─────────────────────────────────────────────────────────────────────────────

export const submitTourFormService = async (
   userId: string,
   enrollmentId: string,
   tourFormData: {
      travelType: string;
      placeOfTour?: string;
      frequentFlyerNo?: string;
      modeOfTravel?: string;
      purpose?: string;
      bookingDetails?: any[];
      advancePaymentRequired?: number;
   }
) => {
   const enrollment = await enrollmentModel.findOne({
      _id: toObjectId(enrollmentId),
      employeeId: toObjectId(userId),
      currentStage: ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE,
   });

   if (!enrollment) {
      throw new AppError(MESSAGES.TOUR_NOT_PENDING, HTTP_STATUS.NOT_FOUND);
   }

   const travelType = tourFormData.travelType as TRAVEL_TYPE;
   const managerApprovalRequired = enrollment.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;
   const ctdApprovalRequired = enrollment.policySnapshot?.tourApproval?.ctdApprovalRequired ?? true;

   let nextStage: ENROLLMENT_STAGE;
   let tourStatus: TOUR_STATUS;

   if (travelType === TRAVEL_TYPE.SELF_TRAVEL || travelType === TRAVEL_TYPE.LOCAL) {
      // Self-travel / local — no approval needed
      nextStage = ENROLLMENT_STAGE.APPROVED;
      tourStatus = TOUR_STATUS.NOT_REQUIRED;
   } else if (travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
      if (managerApprovalRequired) {
         nextStage = ENROLLMENT_STAGE.TOUR_MANAGER_REVIEW;
         tourStatus = TOUR_STATUS.SUBMITTED;
      } else if (ctdApprovalRequired) {
         nextStage = ENROLLMENT_STAGE.TOUR_CTD_REVIEW;
         tourStatus = TOUR_STATUS.MANAGER_APPROVED;
      } else {
         nextStage = ENROLLMENT_STAGE.APPROVED;
         tourStatus = TOUR_STATUS.APPROVED;
      }
   } else {
      throw new AppError("Invalid travel type", HTTP_STATUS.BAD_REQUEST);
   }

   const updateOps: Record<string, any> = {
      $set: {
         currentStage: nextStage,
         "tour.travelType": travelType,
         "tour.status": tourStatus,
         "tour.details": {
            placeOfTour: tourFormData.placeOfTour || "",
            frequentFlyerNo: tourFormData.frequentFlyerNo || "",
            modeOfTravel: tourFormData.modeOfTravel || "flight",
            purpose: tourFormData.purpose || "To Attend Training Program",
            advancePaymentRequired: tourFormData.advancePaymentRequired ?? 0,
            bookingDetails: tourFormData.bookingDetails || [],
         },
         "tour.managerApproval": {
            action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && managerApprovalRequired
               ? MANAGER_ACTION.PENDING
               : MANAGER_ACTION.APPROVE,
         },
         "tour.ctdApproval": {
            action: travelType === TRAVEL_TYPE.COMPANY_ASSISTED && ctdApprovalRequired
               ? TOUR_CTD_ACTION.WAITING
               : TOUR_CTD_ACTION.APPROVE,
         },
         "statusSummary.tourStatus": tourStatus,
      },
      $push: {
         timeline: {
            stage: nextStage,
            actorId: toObjectId(userId),
            actorType: ACTOR_TYPE.EMPLOYEE,
            action: EMPLOYEE_TIMELINE_ACTION.TOUR_FORM_SUBMITTED,
            note: `Tour form submitted — ${travelType}`,
            at: new Date(),
         },
      },
   };

   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id: toObjectId(enrollmentId),
         employeeId: toObjectId(userId),
         currentStage: ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE,
      },
      updateOps,
      { new: true }
   );

   if (!updated) {
      throw new AppError(MESSAGES.TOUR_NOT_PENDING, HTTP_STATUS.CONFLICT);
   }

   loadNotificationContext(String(updated.employeeId), String(updated.programId))
      .then(({ employee, programTitle }) => {
         if (!employee) return;
         return travelType === TRAVEL_TYPE.COMPANY_ASSISTED
            ? sendTravelRequestSubmittedMail(employee.email, employee.name, programTitle)
            : sendSelfTravelSelectedMail(employee.email, employee.name, programTitle);
      })
      .catch(logMailFailure("tour-form-submitted"));

   return {
      enrollmentId: updated._id.toString(),
      currentStage: updated.currentStage,
      tourStatus: updated.tour?.status,
   };
};
