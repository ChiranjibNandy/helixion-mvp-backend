import mongoose, { Types, HydratedDocument } from "mongoose";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { IProgram } from "../interfaces/program.interface.js";
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
import programModel from "../models/program.model.js";
import { AppError } from "../utils/appError.js";
import { reserveProgramSlot, autoRejectRemainingPendingEnrollments } from "./quota.service.js";
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
   ENROLLMENT_REJECTION_REASON,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { sendEnrollmentRejectedMail, sendReimbursementRejectedByManagerMail, sendTravelRequestUnderCtdReviewMail, sendTravelRequestRejectedByManagerMail, sendTravelRequestApprovedMail, sendEnrollmentApprovedLocalMail, sendEnrollmentApprovedOutstationMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure, reimbursementTimelineAction, isLocalTraining } from "../utils/notification.util.js";

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
      const program   = enrollment.programId;

      return {
         _id:          enrollment._id.toString(),
         employeeName: employee?.name ?? "Unknown",
         programTitle: program?.title ?? "Untitled Program",
         fromDate:     program?.startDate ? new Date(program.startDate).toISOString() : "",
         toDate:       program?.endDate ? new Date(program.endDate).toISOString() : "",
         venue:        program?.venueName || program?.city || "",
         status:       "Pending Approval",
      };
   };

   const pendingTeamEnrollments = pendingEnrollments.map(mapPendingRow);
   const pendingTourApprovals = pendingTourApprovalsRaw.map(mapPendingRow);

   return {
      // "Pending Approvals" reflects team enrollments awaiting this manager's
      // action (matches the "Pending Team Enrollments" badge/donut below it),
      // not ownSummary's personal-employee pendingApprovals count. Uses the
      // true count, not pendingTeamEnrollments.length, since that list is capped.
      summary:                 { ...ownSummary, teamEnrollments, pendingApprovals: pendingTeamCount, pendingTourApprovals: pendingTourCount },
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
         "Invalid action. Must be recommend, approve, or reject.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   const enrollment = await enrollmentModel.findOne({
      _id:   toObjectId(String(enrollmentId)),
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
      // Either not found, or this manager already acted (idempotency guard)
      throw new AppError(
         MESSAGES.ENROLLMENT_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }

   // 3. Determine the new chain-entry status
   const newChainStatus =
      action === MANAGER_ACTION.REJECT
         ? MANAGER_CHAIN_STATUS.REJECTED
         : MANAGER_CHAIN_STATUS.APPROVED;

   // 4. Determine next enrollment stage
   let nextStage: ENROLLMENT_STAGE = enrollment.currentStage;
   let nextEnrollmentStatus        = enrollment.statusSummary.enrollmentStatus;

   const arrayFilters: Record<string, any>[] = [
      { "actingElem.userId": toObjectId(managerId) },
   ];
   const updateOps: Record<string, any> = {
      $set: {
         "managerChain.$[actingElem].status": newChainStatus,
         "managerApproval.action":            action as MANAGER_ACTION,
         "managerApproval.note":              note,
         "managerApproval.actedAt":           new Date(),
         currentStage:                        nextStage,
         "statusSummary.enrollmentStatus":    nextEnrollmentStatus,
      },
      $push: {
         timeline: {
            stage:     nextStage,
            actorId:   toObjectId(managerId),
            actorType: ACTOR_TYPE.MANAGER,
            action,
            note,
            at:        new Date(),
         },
      },
   };

   const tourManagerApprovalRequired = enrollment.policySnapshot?.tourApproval?.managerApprovalRequired ?? true;

   // Populated only when this org has Training Dept review disabled and the
   // chain's final approval skips straight past it (see below) — carries the
   // employee/program lookup already done for that branch forward to the
   // post-update mail dispatch, so it isn't fetched twice.
   let skippedCtdNotification: { employee: any; programTitle: string; isLocal: boolean } | null = null;

   // Set when this specific approval must atomically reserve a program quota
   // slot (see the trainingDeptEnabled===false branch below) — routes the
   // final enrollment update through a transaction instead of the plain
   // single-document update every other manager action uses.
   let requiresQuotaReservation = false;

   if (action === MANAGER_ACTION.REJECT) {
      nextStage             = ENROLLMENT_STAGE.REJECTED;
      nextEnrollmentStatus  = ENROLLMENT_STATUS_SUMMARY.REJECTED;
      updateOps.$set.currentStage = nextStage;
      updateOps.$set["statusSummary.enrollmentStatus"] = nextEnrollmentStatus;
      updateOps.$set.rejectionReason = ENROLLMENT_REJECTION_REASON.MANAGER;
      updateOps.$push.timeline.stage = nextStage;
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
      // Check whether the minimum required level has approved
      const minLevel      = enrollment.policySnapshot?.managerApproval?.minLevelToApprove ?? 1;
      const approvedChain = enrollment.managerChain.filter(
         (e) => (e as any).status === MANAGER_CHAIN_STATUS.APPROVED
      );
      // Include the entry we are about to approve (not yet persisted)
      const thisEntry = enrollment.managerChain.find(
         (e) => e.userId.toString() === managerId
      );
      const thisLevel    = thisEntry?.level ?? Infinity;
      const approvedLevels = [
         ...approvedChain.map((e) => e.level),
         thisLevel,
      ];
      const lowestApproved = Math.min(...approvedLevels);

      if (lowestApproved <= minLevel) {
         const trainingDeptEnabled = enrollment.policySnapshot?.trainingDeptApproval?.enabled ?? true;

         if (!trainingDeptEnabled) {
            // Training Dept review disabled for this org — skip straight past
            // training_dept_review, applying the same local-vs-outstation
            // branch takeSeniorActionService (CTD) would otherwise apply, and
            // firing the "Enrollment Approved" notification here instead
            // since CTD's own approval step, which normally sends it, never runs.
            //
            // This manager approval IS the final gate in this org (no CTD
            // step exists to reserve a quota slot later), so it must reserve
            // one itself — see requiresQuotaReservation below, which routes
            // the final enrollment update through the same
            // reserveProgramSlot+transaction pattern trainingDept.service.ts
            // uses for its equivalent final-approval step.
            requiresQuotaReservation = true;

            const { employee, program, programTitle } = await loadNotificationContext(
               String(enrollment.employeeId),
               String(enrollment.programId)
            );
            const isLocal = isLocalTraining(employee?.placeOfPosting, program?.city);

            nextStage = isLocal ? ENROLLMENT_STAGE.APPROVED : ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE;
            // "approved" here means the approval chain approved it, same as
            // takeSeniorActionService's unconditional approving->"approved"
            // (trainingDept.service.ts) — it does NOT mean the tour is
            // resolved. Nothing downstream (submitTourFormService,
            // takeTourManagerActionService, takeTourCtdActionService) ever
            // writes statusSummary.enrollmentStatus again, so gating this on
            // isLocal left outstation enrollments permanently stuck at
            // "recommended" even after the tour was later fully approved.
            nextEnrollmentStatus = ENROLLMENT_STATUS_SUMMARY.APPROVED;
            updateOps.$set.currentStage = nextStage;
            updateOps.$set["statusSummary.enrollmentStatus"] = nextEnrollmentStatus;
            updateOps.$push.timeline.stage = nextStage;

            if (isLocal) {
               updateOps.$set["tour.travelType"] = TRAVEL_TYPE.LOCAL;
               updateOps.$set["tour.status"] = TOUR_STATUS.NOT_REQUIRED;
               updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.NOT_REQUIRED;
            }

            skippedCtdNotification = { employee, programTitle, isLocal };
         } else {
            // Quota isn't reserved here — CTD's approval is still the real
            // reservation point — but we block early if it's already full,
            // so a manager doesn't push a request into a queue that CTD can
            // only bounce right back out. Non-atomic on purpose: a race with
            // CTD filling the last slot between this read and the write
            // below just means this request also gets picked up later by
            // the CTD-side atomic check (and, if needed, the cascade).
            const program = await programModel.findById(enrollment.programId);
            if (!program || program.confirmedEnrollmentCount >= (program.maxParticipants ?? 0)) {
               throw new AppError(MESSAGES.PROGRAM_FULL, HTTP_STATUS.CONFLICT);
            }

            // Minimum required level has approved — advance to training dept review
            nextStage            = ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW;
            nextEnrollmentStatus = ENROLLMENT_STATUS_SUMMARY.RECOMMENDED;
            updateOps.$set.currentStage = nextStage;
            updateOps.$set["statusSummary.enrollmentStatus"] = nextEnrollmentStatus;
            updateOps.$push.timeline.stage = nextStage;
            if (tourManagerApprovalRequired && enrollment.travelAndStay) {
               updateOps.$set["travelAndStay.managerAction"] = MANAGER_ACTION.APPROVE;
               updateOps.$set["travelAndStay.status"] = TOUR_STATUS.APPROVED;
               updateOps.$set["statusSummary.tourStatus"] = TOUR_STATUS.APPROVED;
            }
            const ctdApprovalRequired = enrollment.policySnapshot?.tourApproval?.ctdApprovalRequired ?? true;
            if (tourManagerApprovalRequired && enrollment.tour) {
               updateOps.$set["tour.managerApproval.action"] = MANAGER_ACTION.APPROVE;
               updateOps.$set["tour.managerApproval.actedAt"] = new Date();
               updateOps.$set["tour.managerApproval.note"] = note;

               if (enrollment.tour.travelType === TRAVEL_TYPE.COMPANY_ASSISTED) {
                   updateOps.$set["tour.status"] = ctdApprovalRequired ? TOUR_STATUS.MANAGER_APPROVED : TOUR_STATUS.CTD_APPROVED;
               } else {
                   updateOps.$set["tour.status"] = TOUR_STATUS.NOT_REQUIRED;
               }
            }
         }
      }
   }


   const nextWaiting = enrollment.managerChain
      .filter((e) => (e as any).status === MANAGER_CHAIN_STATUS.WAITING)
      .sort((a, b) => a.level - b.level)[0];

   // Activate the next waiting manager level atomically
   if (nextWaiting && action !== MANAGER_ACTION.REJECT && nextStage === ENROLLMENT_STAGE.MANAGER_REVIEW) {
      arrayFilters.push({ "waitingElem.userId": nextWaiting.userId });
      updateOps.$set["managerChain.$[waitingElem].status"] =
         MANAGER_CHAIN_STATUS.PENDING;
   }

   const enrollmentFilter = {
      _id:   toObjectId(String(enrollmentId)),
      orgId: toObjectId(orgId),
      managerChain: {
         $elemMatch: {
            userId: toObjectId(managerId),
            status: MANAGER_CHAIN_STATUS.PENDING,
         },
      },
   };

   if (requiresQuotaReservation) {
      // This approval is the final gate (Training Dept review disabled for
      // this org) — reserve the quota slot and advance the enrollment
      // atomically, exactly like trainingDept.service.ts's CTD approval.
      let reservedProgram: HydratedDocument<IProgram> | null = null;
      const session = await mongoose.startSession();
      try {
         await session.withTransaction(async () => {
            reservedProgram = await reserveProgramSlot(String(enrollment.programId), session);
            if (!reservedProgram) {
               throw new AppError(MESSAGES.PROGRAM_FULL, HTTP_STATUS.CONFLICT);
            }

            await enrollmentModel.findOneAndUpdate(
               enrollmentFilter,
               updateOps,
               { arrayFilters, new: true, session }
            );
         });
      } finally {
         await session.endSession();
      }

      const finalReservedProgram = reservedProgram as HydratedDocument<IProgram> | null;
      if (finalReservedProgram && finalReservedProgram.confirmedEnrollmentCount >= finalReservedProgram.maxParticipants!) {
         await autoRejectRemainingPendingEnrollments(String(enrollment.programId), enrollmentId);
      }
   } else {
      await enrollmentModel.findOneAndUpdate(
         enrollmentFilter,
         updateOps,
         { arrayFilters, new: true }
      );
   }

   if (action === MANAGER_ACTION.REJECT) {
      loadNotificationContext(String(enrollment.employeeId), String(enrollment.programId))
         .then(({ employee, programTitle }) => {
            if (!employee) return;
            return sendEnrollmentRejectedMail(employee.email, employee.name, programTitle);
         })
         .catch(logMailFailure("enrollment-rejected"));
   } else if (skippedCtdNotification?.employee) {
      const { employee, programTitle, isLocal } = skippedCtdNotification;
      (isLocal
         ? sendEnrollmentApprovedLocalMail(employee.email, employee.name, programTitle)
         : sendEnrollmentApprovedOutstationMail(employee.email, employee.name, programTitle)
      ).catch(logMailFailure("enrollment-approved"));
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
         currentStage:                    nextStage,
         "reimbursement.status":          nextReimbursementStatus,
         "reimbursement.managerApproval": { action, note, actedAt: new Date() },
      },
      {
         stage:     nextStage,
         actorId:   toObjectId(managerId),
         actorType: ACTOR_TYPE.MANAGER,
         action:    reimbursementTimelineAction("manager", action),
         note,
         at:        new Date(),
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
               action: `tour_manager_${action}`,
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

   loadNotificationContext(String(updated.employeeId), String(updated.programId))
      .then(({ employee, programTitle }) => {
         if (!employee) return;
         if (nextTourStatus === TOUR_STATUS.MANAGER_REJECTED) {
            return sendTravelRequestRejectedByManagerMail(employee.email, employee.name, programTitle);
         }
         return nextTourStatus === TOUR_STATUS.MANAGER_APPROVED
            ? sendTravelRequestUnderCtdReviewMail(employee.email, employee.name, programTitle)
            : sendTravelRequestApprovedMail(employee.email, employee.name, programTitle);
      })
      .catch(logMailFailure("tour-manager-action"));

   return { currentStage: nextStage };
};
