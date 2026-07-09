import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getPendingEnrollmentsForStageRepo, takeReimbursementOsdActionRepo } from "../repositories/enrollment.repository.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   REIMBURSEMENT_ACTION,
   REIMBURSEMENT_STATUS,
   ACTOR_TYPE,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { sendReimbursementApprovedMail, sendReimbursementRejectedByOsdMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure, reimbursementTimelineAction } from "../utils/notification.util.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get pending reimbursement claims awaiting OSD approval
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingEnrollmentsService = async (orgId: string) => {
   return await getPendingEnrollmentsForStageRepo(orgId, ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW);
};

// ─────────────────────────────────────────────────────────────────────────────
// OSD approve/reject a reimbursement claim (approve | reject)
//
// Single-tier gate (per ticket 0031 — no junior/senior split). Reject is
// terminal (no rework loop, matches the manager gate's behavior); approve
// completes the enrollment.
//
// Idempotency: query filters on currentStage === REIMBURSEMENT_OSD_REVIEW.
// Atomicity: single findOneAndUpdate (in the repository layer) — no read-
// modify-write race.
// ─────────────────────────────────────────────────────────────────────────────

export const takeReimbursementOsdActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: REIMBURSEMENT_ACTION,
   note: string
) => {
   if (
      !Object.values(REIMBURSEMENT_ACTION).includes(action) ||
      action === REIMBURSEMENT_ACTION.WAITING ||
      action === REIMBURSEMENT_ACTION.PENDING
   ) {
      throw new AppError(MESSAGES.INVALID_REIMBURSEMENT_ACTION, HTTP_STATUS.BAD_REQUEST);
   }

   const nextStage =
      action === REIMBURSEMENT_ACTION.APPROVE
         ? ENROLLMENT_STAGE.COMPLETED
         : ENROLLMENT_STAGE.REJECTED;

   const nextReimbursementStatus =
      action === REIMBURSEMENT_ACTION.APPROVE
         ? REIMBURSEMENT_STATUS.APPROVED
         : REIMBURSEMENT_STATUS.REJECTED;

   const updated = await takeReimbursementOsdActionRepo(
      enrollmentId,
      orgId,
      {
         currentStage:               nextStage,
         "reimbursement.status":     nextReimbursementStatus,
         "reimbursement.osdApproval": { action, note, actedAt: new Date() },
      },
      {
         stage:     nextStage,
         actorId:   toObjectId(officerId),
         actorType: ACTOR_TYPE.OSD,
         action:    reimbursementTimelineAction("osd", action),
         note,
         at:        new Date(),
      }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (action === REIMBURSEMENT_ACTION.APPROVE) {
      loadNotificationContext(String(updated.employeeId), String(updated.programId))
         .then(({ employee, programTitle }) => {
            if (!employee) return;
            return sendReimbursementApprovedMail(employee.email, employee.name, programTitle);
         })
         .catch(logMailFailure("reimbursement-approved"));
   } else {
      loadNotificationContext(String(updated.employeeId), String(updated.programId))
         .then(({ employee, programTitle }) => {
            if (!employee) return;
            return sendReimbursementRejectedByOsdMail(employee.email, employee.name, programTitle);
         })
         .catch(logMailFailure("reimbursement-rejected-by-osd"));
   }

   return { currentStage: nextStage };
};
