import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getPendingEnrollmentsForStageRepo } from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   OSD_SENIOR_ACTION,
   REIMBURSEMENT_STATUS,
   ACTOR_TYPE,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

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
// Atomicity: single findOneAndUpdate — no read-modify-write race.
// ─────────────────────────────────────────────────────────────────────────────

export const takeReimbursementOsdActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   if (
      !Object.values(OSD_SENIOR_ACTION).includes(action as OSD_SENIOR_ACTION) ||
      action === OSD_SENIOR_ACTION.WAITING
   ) {
      throw new AppError(MESSAGES.INVALID_REIMBURSEMENT_ACTION, HTTP_STATUS.BAD_REQUEST);
   }

   const nextStage =
      action === OSD_SENIOR_ACTION.APPROVE
         ? ENROLLMENT_STAGE.COMPLETED
         : ENROLLMENT_STAGE.REJECTED;

   const nextReimbursementStatus =
      action === OSD_SENIOR_ACTION.APPROVE
         ? REIMBURSEMENT_STATUS.APPROVED
         : REIMBURSEMENT_STATUS.REJECTED;

   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW,
      },
      {
         $set: {
            currentStage:            nextStage,
            "reimbursement.status":  nextReimbursementStatus,
            "reimbursement.osdApproval": {
               action:  action as OSD_SENIOR_ACTION,
               note,
               actedAt: new Date(),
            },
         },
         $push: {
            timeline: {
               stage:     nextStage,
               actorId:   toObjectId(officerId),
               actorType: ACTOR_TYPE.OSD,
               action,
               note,
               at:        new Date(),
            },
         },
      },
      { new: true }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return { currentStage: nextStage };
};
