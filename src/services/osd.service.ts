import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getPendingEnrollmentsForStageRepo } from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   OSD_JUNIOR_ACTION,
   OSD_SENIOR_ACTION,
   REIMBURSEMENT_STATUS,
   ACTOR_TYPE,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get pending enrollments for OSD queue
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingEnrollmentsService = async (
   orgId: string,
   osdLevel: number
) => {
   const stage =
      osdLevel >= 2
         ? ENROLLMENT_STAGE.OSD_SENIOR_REVIEW
         : ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW;

   return await getPendingEnrollmentsForStageRepo(orgId, stage);
};

// ─────────────────────────────────────────────────────────────────────────────
// OSD Junior action (return | recommend)
//
// Idempotency: query filters on currentStage === OSD_JUNIOR_REVIEW. Once the
// junior acts and moves the stage, a repeat call gets a 404, preventing
// double-processing.
//
// Atomicity: single findOneAndUpdate — no read-modify-write race.
// ─────────────────────────────────────────────────────────────────────────────

export const takeOsdJuniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action
   if (
      !Object.values(OSD_JUNIOR_ACTION).includes(action as OSD_JUNIOR_ACTION) ||
      action === OSD_JUNIOR_ACTION.PENDING
   ) {
      throw new AppError(
         "Invalid action. Must be 'return' or 'recommend'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Verify enrollment exists in junior-review stage (idempotency guard)
   const existing = await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (!existing.reimbursement) {
      throw new AppError("No reimbursement data found.", HTTP_STATUS.CONFLICT);
   }

   // 3. Determine next stage and status
   const nextStage              =
      action === OSD_JUNIOR_ACTION.RETURN
         ? ENROLLMENT_STAGE.REIMBURSEMENT_SUBMITTED
         : ENROLLMENT_STAGE.OSD_SENIOR_REVIEW;

   const nextReimbursementStatus =
      action === OSD_JUNIOR_ACTION.RETURN
         ? REIMBURSEMENT_STATUS.RETURNED
         : REIMBURSEMENT_STATUS.RECOMMENDED;

   // 4. Atomic update — single round-trip, no race condition
   await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW,
      },
      {
         $set: {
            currentStage:                        nextStage,
            "statusSummary.reimbursementStatus": nextReimbursementStatus,
            "reimbursement.osdJunior": {
               officerId: toObjectId(officerId),
               action:    action as OSD_JUNIOR_ACTION,
               note,
               actedAt:   new Date(),
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

   return { currentStage: nextStage };
};

// ─────────────────────────────────────────────────────────────────────────────
// OSD Senior action (approve | reject)
//
// Per design decision: senior "reject" is FINAL — enrollment moves to
// ENROLLMENT_STAGE.REJECTED with reimbursementStatus = REJECTED.
// There is no revision loop back to junior.
//
// Idempotency: query filters on currentStage === OSD_SENIOR_REVIEW.
// Atomicity: single findOneAndUpdate.
// ─────────────────────────────────────────────────────────────────────────────

export const takeOsdSeniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action
   if (
      !Object.values(OSD_SENIOR_ACTION).includes(action as OSD_SENIOR_ACTION) ||
      action === OSD_SENIOR_ACTION.WAITING
   ) {
      throw new AppError(
         "Invalid action. Must be 'approve' or 'reject'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Verify enrollment exists in senior-review stage (idempotency guard)
   const existing = await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.OSD_SENIOR_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (!existing.reimbursement) {
      throw new AppError("No reimbursement data found.", HTTP_STATUS.CONFLICT);
   }

   // 3. Determine next stage and status
   //    approve → REIMBURSEMENT_APPROVED
   //    reject  → REJECTED (final — no revision loop)
   const nextStage =
      action === OSD_SENIOR_ACTION.APPROVE
         ? ENROLLMENT_STAGE.REIMBURSEMENT_APPROVED
         : ENROLLMENT_STAGE.REJECTED;

   const nextReimbursementStatus =
      action === OSD_SENIOR_ACTION.APPROVE
         ? REIMBURSEMENT_STATUS.APPROVED
         : REIMBURSEMENT_STATUS.REJECTED;

   // 4. Atomic update — single round-trip, no race condition
   await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.OSD_SENIOR_REVIEW,
      },
      {
         $set: {
            currentStage:                        nextStage,
            "statusSummary.reimbursementStatus": nextReimbursementStatus,
            "reimbursement.osdSenior": {
               officerId: toObjectId(officerId),
               action:    action as OSD_SENIOR_ACTION,
               note,
               actedAt:   new Date(),
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

   return { currentStage: nextStage };
};
