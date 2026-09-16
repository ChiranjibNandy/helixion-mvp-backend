import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getPendingEnrollmentsForManagerRepo,
   countPendingEnrollmentsForManagerRepo,
   getPendingReimbursementsForManagerRepo,
   takeReimbursementManagerActionRepo,
   getManagerOwnDashboardSummaryRepo,
   getManagerTeamEnrollmentCountRepo,
   getPendingTourApprovalsForManagerRepo,
   countPendingTourApprovalsForManagerRepo,
} from "../repositories/enrollment.repository.js";
import { getApprovalStatsRepo } from "../repositories/employee.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   MANAGER_ACTION,
   MANAGER_CHAIN_STATUS,
   ENROLLMENT_STAGE,
   ACTOR_TYPE,
   TOUR_STATUS,
   ENROLLMENT_STATUS_SUMMARY,
   TRAVEL_TYPE,
   REIMBURSEMENT_ACTION,
   REIMBURSEMENT_STATUS,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { sendReimbursementRejectedByManagerMail, sendTravelRequestUnderCtdReviewMail, sendTravelRequestRejectedByManagerMail, sendTravelRequestApprovedMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure, reimbursementTimelineAction, isLocalTraining } from "../utils/notification.util.js";
import { createNotification } from "../repositories/notification.repository.js";
import { buildApprovedLocalEmailBody, buildApprovedOutstationEmailBody, buildRejectedEmailBody, NOTIFICATION_TEMPLATES } from "../constants/notificationTemplates.js";
import { sendTrackedMail } from "../utils/sendTrackedMail.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get pending enrollments for a manager
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingEnrollmentsService = async (
   managerId: string,
   orgId: string,
   level?: number
) => {
   return await getPendingEnrollmentsForManagerRepo(
      managerId,
      orgId,
      level !== undefined ? { level } : {}
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// Manager dashboard summary — mirrors the employee dashboard's shape
// (summary/approvalStats/listed-rows), extended with team-level aggregates
// since a manager also has their own personal enrollments as an employee.
// ─────────────────────────────────────────────────────────────────────────────

export const getManagerDashboardService = async (managerId: string, orgId: string) => {
   const [ownSummary, teamEnrollments, approvalStats, pendingEnrollments, pendingTeamCount, pendingTourApprovalsRaw, pendingTourCount] = await Promise.all([
      getManagerOwnDashboardSummaryRepo(managerId),
      getManagerTeamEnrollmentCountRepo(managerId),
      // "Approval Status" mirrors the employee dashboard's meaning here — the
      // manager's own submitted enrollments' approved/pending/rejected
      // breakdown, not their team's decisions (a manager with no direct
      // reports would otherwise see this permanently stuck at all-zero).
      getApprovalStatsRepo(managerId),
      // Capped (see DASHBOARD_LIST_CAP) — this list only backs the dashboard
      // preview panel below, not the "Pending Approvals" count, which comes
      // from the uncapped countDocuments() sibling instead.

      getPendingEnrollmentsForManagerRepo(managerId, orgId),
      countPendingEnrollmentsForManagerRepo(managerId, orgId),
      getPendingTourApprovalsForManagerRepo(managerId, orgId),
      countPendingTourApprovalsForManagerRepo(managerId, orgId),
   ]);

   const mapPendingRow = (enrollment: any) => {
      const employee = enrollment.employeeId;
      const program = enrollment.programId;

      return {
         _id: enrollment._id.toString(),
         employeeName: employee?.name ?? "Unknown",
         programTitle: program?.title ?? "Untitled Program",
         fromDate: program?.startDate ? new Date(program.startDate).toISOString() : "",
         toDate: program?.endDate ? new Date(program.endDate).toISOString() : "",
         venue: program?.venueName || program?.city || "",
         status: "Pending Approval",
      };
   };

   const pendingTeamEnrollments = pendingEnrollments.map(mapPendingRow);
   const pendingTourApprovals = pendingTourApprovalsRaw.map(mapPendingRow);

   return {
      // "Pending Approvals" reflects team enrollments awaiting this manager's
      // action (matches the "Pending Team Enrollments" badge/donut below it),
      // not ownSummary's personal-employee pendingApprovals count. Uses the
      // true count, not pendingTeamEnrollments.length, since that list is capped.
      summary: { ...ownSummary, teamEnrollments, pendingApprovals: pendingTeamCount, pendingTourApprovals: pendingTourCount },
      approvalStats,
      pendingTeamEnrollments,
      pendingTourApprovals,
   };
};

// ─────────────────────────────────────────────────────────────────────────────
// Take action on an enrollment (recommend | approve | reject)
//
// Atomicity: uses findOneAndUpdate with $set + $push so the read-modify-write
// happens in a single round-trip. This eliminates the race condition where two
// concurrent requests could both read PENDING and both write conflicting state.
//
// Idempotency: the query filter includes `status: PENDING` on the chain entry,
// so a second request for the same manager on the same enrollment will find no
// document (the entry is no longer PENDING) and receive a 404 — preventing
// double-processing.
// ─────────────────────────────────────────────────────────────────────────────
export const takeManagerActionService = async (
   enrollmentId: string,
   managerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action value
   if (
      !Object.values(MANAGER_ACTION).includes(action as MANAGER_ACTION) ||
      action === MANAGER_ACTION.PENDING
   ) {
      throw new AppError(
         MESSAGES.INVALID_MANAGER_ACTION,
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Fetch and guard idempotency
   const enrollment = await enrollmentModel.findOne({
      _id: toObjectId(String(enrollmentId)),
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.MANAGER_REVIEW,
      managerChain: {
         $elemMatch: {
            userId: toObjectId(managerId),
            status: MANAGER_CHAIN_STATUS.PENDING,
         },
      },
   });

   if (!enrollment) {
      throw new AppError(
         MESSAGES.ENROLLMENT_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }
   console.log(enrollment)


   // 3. Setup update payloads
   const newChainStatus =
      action === MANAGER_ACTION.REJECT
         ? MANAGER_CHAIN_STATUS.REJECTED
         : MANAGER_CHAIN_STATUS.APPROVED;

   let nextStage: ENROLLMENT_STAGE = enrollment.currentStage;
   let nextEnrollmentStatus = enrollment.statusSummary.enrollmentStatus;

   const arrayFilters: Record<string, any>[] = [
      { "actingElem.userId": toObjectId(managerId) },
   ];

   const updateOps: Record<string, any> = {
      $set: {
         "managerChain.$[actingElem].status": newChainStatus,
         "managerApproval.action": action as MANAGER_ACTION,
         "managerApproval.note": note,
         "managerApproval.actedAt": new Date(),
      },
      $push: {},
   };

   const tourManagerApprovalRequired =
      enrollment.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;

   let skippedCtdNotification: { employee: any; programTitle: string; isLocal: boolean } | null = null;

   // 4. Handle Rejection vs Approval logic
   if (action === MANAGER_ACTION.REJECT) {
      nextStage = ENROLLMENT_STAGE.REJECTED;
      nextEnrollmentStatus = ENROLLMENT_STATUS_SUMMARY.REJECTED;

      if (enrollment.travelAndStay) {
         updateOps.$set["travelAndStay.managerAction"] = MANAGER_ACTION.REJECT;
         updateOps.$set["travelAndStay.status"] = TOUR_STATUS.REJECTED;
         updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.REJECTED;
      }
      if (enrollment.tour) {
         updateOps.$set["tour.managerApproval.action"] = MANAGER_ACTION.REJECT;
         updateOps.$set["tour.managerApproval.actedAt"] = new Date();
         updateOps.$set["tour.managerApproval.note"] = note;
         updateOps.$set["tour.status"] = TOUR_STATUS.MANAGER_REJECTED;
      }
   } else {
      // Evaluate approval levels
      const minLevel = enrollment.policySnapshot?.managerApproval?.minLevelToApprove ?? 1;
      const approvedChain = enrollment.managerChain.filter(
         (e) => (e as any).status === MANAGER_CHAIN_STATUS.APPROVED
      );
      const thisEntry = enrollment.managerChain.find(
         (e) => e.userId.toString() === managerId
      );
      const thisLevel = thisEntry?.level ?? Infinity;
      const approvedLevels = [...approvedChain.map((e) => e.level), thisLevel];
      const lowestApproved = Math.min(...approvedLevels);

      if (lowestApproved <= minLevel) {
         const trainingDeptEnabled =
            enrollment.policySnapshot?.trainingDeptApproval?.enabled ?? true;

         if (!trainingDeptEnabled) {
            const { employee, program, programTitle } = await loadNotificationContext(
               String(enrollment.employeeId),
               String(enrollment.programId)
            );
            const isLocal = isLocalTraining(employee?.placeOfPosting, program?.city);

            nextStage = isLocal ? ENROLLMENT_STAGE.APPROVED : ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE;
            nextEnrollmentStatus = ENROLLMENT_STATUS_SUMMARY.APPROVED;

            if (isLocal) {
               updateOps.$set["tour.travelType"] = TRAVEL_TYPE.LOCAL;
               updateOps.$set["tour.status"] = TOUR_STATUS.NOT_REQUIRED;
               updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.NOT_REQUIRED;
            }

            skippedCtdNotification = { employee, programTitle, isLocal };
         } else {
            nextStage = ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW;
            nextEnrollmentStatus = ENROLLMENT_STATUS_SUMMARY.RECOMMENDED;

            if (tourManagerApprovalRequired && enrollment.travelAndStay) {
               updateOps.$set["travelAndStay.managerAction"] = MANAGER_ACTION.APPROVE;
               updateOps.$set["travelAndStay.status"] = TOUR_STATUS.APPROVED;
               updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.APPROVED;
            }

            const ctdApprovalRequired =
               enrollment.policySnapshot?.tourApproval?.ctdApprovalRequired ?? true;

            if (tourManagerApprovalRequired && enrollment.tour) {
               updateOps.$set["tour.managerApproval.action"] = MANAGER_ACTION.APPROVE;
               updateOps.$set["tour.managerApproval.actedAt"] = new Date();
               updateOps.$set["tour.managerApproval.note"] = note;

               if (enrollment.tour.travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
                  updateOps.$set["tour.status"] = ctdApprovalRequired
                     ? TOUR_STATUS.MANAGER_APPROVED
                     : TOUR_STATUS.CTD_APPROVED;
               } else {
                  updateOps.$set["tour.status"] = TOUR_STATUS.NOT_REQUIRED;
               }
            }
         }
      }
   }

   // 5. Apply stage updates
   updateOps.$set.currentStage = nextStage;
   updateOps.$set["statusSummary.enrollmentStatus"] = nextEnrollmentStatus;
   updateOps.$push.timeline = {
      stage: nextStage,
      actorId: toObjectId(managerId),
      actorType: ACTOR_TYPE.MANAGER,
      action,
      note,
      at: new Date(),
   };

   // 6. Handle multi-level approval progression
   const nextWaiting = enrollment.managerChain
      .filter((e) => (e as any).status === MANAGER_CHAIN_STATUS.WAITING)
      .sort((a, b) => a.level - b.level)[0];

   if (nextWaiting && action !== MANAGER_ACTION.REJECT && nextStage === ENROLLMENT_STAGE.MANAGER_REVIEW) {
      arrayFilters.push({ "waitingElem.userId": nextWaiting.userId });
      updateOps.$set["managerChain.$[waitingElem].status"] = MANAGER_CHAIN_STATUS.PENDING;
   }

   // 7. Persist changes
   await enrollmentModel.findOneAndUpdate(
      {
         _id: toObjectId(String(enrollmentId)),
         orgId: toObjectId(orgId),
         managerChain: {
            $elemMatch: {
               userId: toObjectId(managerId),
               status: MANAGER_CHAIN_STATUS.PENDING,
            },
         },
      },
      updateOps,
      { arrayFilters, new: true }
   );

   // 8. Single Notification Dispatch Handling

   if (action === MANAGER_ACTION.REJECT) {
      try {
         const context = await loadNotificationContext(
            String(enrollment.employeeId),
            String(enrollment.programId)
         );

         if (context?.employee) {
            const { employee, programTitle } = context;

            await createNotification(
               String(enrollment.employeeId),
               NOTIFICATION_TEMPLATES.ENROLLMENT_REJECTED(programTitle),
               String(enrollment._id)
            );

            await sendTrackedMail({
               to: employee.email,
               subject: NOTIFICATION_TEMPLATES.ENROLLMENT_REJECTED(programTitle).emailSubject,
               templateName: NOTIFICATION_TEMPLATES.ENROLLMENT_REJECTED(programTitle).title,
               html: buildRejectedEmailBody(employee.name, programTitle),
               relatedEntityId: String(enrollment._id),
            });
         }
      } catch (err) {
         logMailFailure("enrollment-rejected")(err);
      }
   } else if (skippedCtdNotification?.employee) {
      const { employee, programTitle, isLocal } = skippedCtdNotification;
      const template = isLocal
         ? NOTIFICATION_TEMPLATES.ENROLLMENT_APPROVED_LOCAL(programTitle)
         : NOTIFICATION_TEMPLATES.ENROLLMENT_APPROVED_OUTSTATION(programTitle)

      try {
         await createNotification(
            String(enrollment.employeeId),
            template,
            String(enrollment._id)
         );

         await sendTrackedMail({
            to: employee.email,
            subject: template.emailSubject,
            templateName: template.title,
            html: isLocal
               ? buildApprovedLocalEmailBody(employee.name, programTitle)
               : buildApprovedOutstationEmailBody(employee.name, programTitle),
            relatedEntityId: String(enrollment._id),
         });
      } catch (err) {
         logMailFailure("enrollment-approved")(err);
      }
   }

   return { currentStage: nextStage };
};
// ─────────────────────────────────────────────────────────────────────────────
// Get pending reimbursement claims awaiting this manager's approval
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingReimbursementsService = async (
   managerId: string,
   orgId: string
) => {
   return await getPendingReimbursementsForManagerRepo(managerId, orgId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Manager approve/reject a reimbursement claim (approve | reject)
//
// Single-tier gate — no chain, keyed on the same assignedApproverId set when
// the enrollment was created. Reject is terminal (no rework loop, per ticket
// 0031's linear flow); approve hands off to OSD review.
// ─────────────────────────────────────────────────────────────────────────────

export const takeReimbursementManagerActionService = async (
   enrollmentId: string,
   managerId: string,
   orgId: string,
   action: REIMBURSEMENT_ACTION,
   note: string
) => {
   if (
      !Object.values(REIMBURSEMENT_ACTION).includes(action) ||
      action === REIMBURSEMENT_ACTION.PENDING ||
      action === REIMBURSEMENT_ACTION.WAITING
   ) {
      throw new AppError(MESSAGES.INVALID_REIMBURSEMENT_ACTION, HTTP_STATUS.BAD_REQUEST);
   }

   const nextStage =
      action === REIMBURSEMENT_ACTION.REJECT
         ? ENROLLMENT_STAGE.REJECTED
         : ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW;

   const nextReimbursementStatus =
      action === REIMBURSEMENT_ACTION.REJECT
         ? REIMBURSEMENT_STATUS.REJECTED
         : REIMBURSEMENT_STATUS.SUBMITTED;

   const updated = await takeReimbursementManagerActionRepo(
      enrollmentId,
      orgId,
      managerId,
      {
         currentStage: nextStage,
         "reimbursement.status": nextReimbursementStatus,
         "reimbursement.managerApproval": { action, note, actedAt: new Date() },
      },
      {
         stage: nextStage,
         actorId: toObjectId(managerId),
         actorType: ACTOR_TYPE.MANAGER,
         action: reimbursementTimelineAction("manager", action),
         note,
         at: new Date(),
      }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (action === REIMBURSEMENT_ACTION.REJECT) {
      loadNotificationContext(String(updated.employeeId), String(updated.programId))
         .then(({ employee, programTitle }) => {
            if (!employee) return;
            return sendReimbursementRejectedByManagerMail(employee.email, employee.name, programTitle);
         })
         .catch(logMailFailure("reimbursement-rejected-by-manager"));
   }

   return { currentStage: nextStage };
};

// ─────────────────────────────────────────────────────────────────────────────
// Get pending tour approvals awaiting this manager's action
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingTourApprovalsService = async (
   managerId: string,
   orgId: string
) => {
   return await getPendingTourApprovalsForManagerRepo(managerId, orgId);
};

// ─────────────────────────────────────────────────────────────────────────────
// Manager approve/reject a tour (company-assisted travel)
//
// Single-tier gate keyed on the same assignedApproverId.
// Approve → advance to TOUR_CTD_REVIEW (if CTD required) or APPROVED.
// Reject → fallback to self_travel, enrollment continues at APPROVED stage.
//
// Idempotency: query filters on currentStage === TOUR_MANAGER_REVIEW.
// Atomicity: single findOneAndUpdate.
// ─────────────────────────────────────────────────────────────────────────────

export const takeTourManagerActionService = async (
   enrollmentId: string,
   managerId: string,
   orgId: string,
   action: MANAGER_ACTION,
   note: string
) => {
   if (
      action !== MANAGER_ACTION.APPROVE &&
      action !== MANAGER_ACTION.REJECT
   ) {
      throw new AppError(MESSAGES.INVALID_TOUR_ACTION, HTTP_STATUS.BAD_REQUEST);
   }

   const enrollment = await enrollmentModel.findOne({
      _id: toObjectId(enrollmentId),
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TOUR_MANAGER_REVIEW,
      "managerApproval.assignedApproverId": toObjectId(managerId),
   });

   if (!enrollment) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const ctdRequired = enrollment.policySnapshot?.tourApproval?.ctdApprovalRequired ?? true;

   let nextStage: ENROLLMENT_STAGE;
   let nextTourStatus: TOUR_STATUS;

   if (action === MANAGER_ACTION.REJECT) {
      // Rejection: fallback to self_travel, enrollment continues
      nextStage = ENROLLMENT_STAGE.APPROVED;
      nextTourStatus = TOUR_STATUS.MANAGER_REJECTED;
   } else {
      // Approval: route to CTD if required, otherwise mark approved
      if (ctdRequired) {
         nextStage = ENROLLMENT_STAGE.TOUR_CTD_REVIEW;
         nextTourStatus = TOUR_STATUS.MANAGER_APPROVED;
      } else {
         nextStage = ENROLLMENT_STAGE.APPROVED;
         nextTourStatus = TOUR_STATUS.APPROVED;
      }
   }

   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id: toObjectId(enrollmentId),
         orgId: toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TOUR_MANAGER_REVIEW,
         "managerApproval.assignedApproverId": toObjectId(managerId),
      },
      {
         $set: {
            currentStage: nextStage,
            "tour.status": nextTourStatus,
            "tour.managerApproval.action": action,
            "tour.managerApproval.note": note,
            "tour.managerApproval.actedAt": new Date(),
            "statusSummary.tourStatus": nextTourStatus,
            ...(action === MANAGER_ACTION.REJECT ? { "tour.travelType": TRAVEL_TYPE.SELF_TRAVEL } : {}),
         },
         $push: {
            timeline: {
               stage: nextStage,
               actorId: toObjectId(managerId),
               actorType: ACTOR_TYPE.MANAGER,
               action: `tour_manager_${ action }`,
               note,
               at: new Date(),
            },
         },
      },
      { new: true }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   loadNotificationContext(
      String(updated.employeeId),
      String(updated.programId)
   )
      .then(async ({ employee, programTitle }) => {
         if (!employee) return;

         const employeeId = String(updated.employeeId);
         const relatedEntityId = String(updated._id);

         if (nextTourStatus === TOUR_STATUS.MANAGER_REJECTED) {
            const template =
               NOTIFICATION_TEMPLATES.TRAVEL_REQUEST_REJECTED_BY_MANAGER(
                  programTitle
               );

            await createNotification(
               employeeId,
               template,
               relatedEntityId
            );

            return sendTravelRequestRejectedByManagerMail(
               employee.email,
               employee.name,
               programTitle
            );
         }

         if (nextTourStatus === TOUR_STATUS.MANAGER_APPROVED) {
            const template =
               NOTIFICATION_TEMPLATES.TRAVEL_REQUEST_UNDER_CTD_REVIEW(
                  programTitle
               );

            await createNotification(
               employeeId,
               template,
               relatedEntityId
            );

            return sendTravelRequestUnderCtdReviewMail(
               employee.email,
               employee.name,
               programTitle
            );
         }

         const template =
            NOTIFICATION_TEMPLATES.TRAVEL_REQUEST_APPROVED(programTitle);

         await createNotification(
            employeeId,
            template,
            relatedEntityId
         );

         return sendTravelRequestApprovedMail(
            employee.email,
            employee.name,
            programTitle
         );
      })
      .catch(logMailFailure("tour-manager-action"));

   return { currentStage: nextStage };
};
