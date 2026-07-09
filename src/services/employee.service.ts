import { getApprovalStatsRepo, getDashboardSummaryRepo, getListedProgramsRepo } from "../repositories/employee.repository.js";
import { getEmployeeProgramsListRepo, getEmployeeProgramByIdRepo, getAvailableProgramsPaginatedRepo } from "../repositories/program.repository.js";
import {
   createEnrollmentRepo,
   findExistingEnrollmentRepo,
   getEmployeeEnrollmentsRepo,
   getEnrollmentDetailsRepo,
   findEnrollmentForReimbursementSubmitRepo,
   submitReimbursementRepo,
   getEmployeeNotificationTimelineRepo,
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
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { resolveEnrollmentFee } from "../utils/fee.js";
import { isLocalTraining, resolveProgramTitle } from "../utils/notification.util.js";
import { ITimelineEntry } from "../interfaces/enrollment.interface.js";
import { IUser } from "../interfaces/user.interface.js";


export const getEmployeeDashboardService = async (userId: string) => {
  const [summary, approvalStats, listedPrograms] = await Promise.all([
    getDashboardSummaryRepo(userId),
    getApprovalStatsRepo(userId),
    getListedProgramsRepo(userId),
  ]);

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
   const travelAndStay = {
      stayType,
      placeOfTour: travelAndStayInput?.placeOfTour || (program as any).city || program.venueName || "",
      frequentFlyerNo: travelAndStayInput?.frequentFlyerNo || "",
      modeOfTravel: travelAndStayInput?.modeOfTravel || "flight",
      purpose: travelAndStayInput?.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayInput?.bookingDetails || [],
      advancePaymentRequired: travelAndStayInput?.advancePaymentRequired || 0,
      status: managerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
      managerAction: managerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      managerReason: ""
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
         tourApproval: organization.policy?.tourApproval || { managerApprovalRequired: true, osdApprovalRequired: true },
         reimbursementApproval: organization.policy?.reimbursementApproval || { managerApprovalRequired: true, osdApprovalRequired: true }
      },
      managerChain,
      managerApproval: {
         assignedApproverId: (user_hierarchy.managerId) || null,
         action: MANAGER_ACTION.PENDING,
         note: ""
      },
      travelAndStay,
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
   travelAndStayData: any
) => {
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
   enrollmentObj.travelAndStay = {
      stayType: enrollmentObj.travelAndStay?.stayType || "twin_sharing",
      placeOfTour: travelAndStayData.placeOfTour,
      frequentFlyerNo: travelAndStayData.frequentFlyerNo || "",
      modeOfTravel: travelAndStayData.modeOfTravel,
      purpose: travelAndStayData.purpose || "To Attend Training Program",
      bookingDetails: travelAndStayData.bookingDetails || [],
      advancePaymentRequired: travelAndStayData.advancePaymentRequired || 0,
      status: tourManagerApprovalRequired ? TOUR_STATUS.SUBMITTED : TOUR_STATUS.APPROVED,
      managerAction: tourManagerApprovalRequired ? MANAGER_ACTION.PENDING : MANAGER_ACTION.APPROVE,
      managerReason: ""
   };

   if (!enrollmentObj.timeline) {
      enrollmentObj.timeline = [];
   }
   enrollmentObj.timeline.push({
      stage: enrollmentObj.currentStage,
      actorId: toObjectId(userId),
      actorType: ACTOR_TYPE.EMPLOYEE,
      action: EMPLOYEE_TIMELINE_ACTION.UPDATED_TRAVEL,
      note: "Updated travel and stay details",
      at: new Date()
   });


   await enrollmentObj.save();
   return enrollmentObj;
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
