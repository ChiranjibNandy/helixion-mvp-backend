import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getPendingEnrollmentsForStageRepo } from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   TRAINING_DEPT_JUNIOR_ACTION,
   TRAINING_DEPT_SENIOR_ACTION,
   ACTOR_TYPE,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

// ─────────────────────────────────────────────────────────────────────────────
// Get pending enrollments for Training Dept queue
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingEnrollmentsService = async (orgId: string) => {
   return await getPendingEnrollmentsForStageRepo(
      orgId,
      ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// Training Dept Junior action ("reviewed")
//
// Idempotency: stage filter on TRAINING_DEPT_REVIEW ensures a second call after
// the senior has already advanced the stage returns a 404 — no double-act.
// Idempotency within the junior step itself: if juniorAction is already
// "reviewed", we reject with 409 to prevent overwriting existing review data.
//
// Atomicity: single findOneAndUpdate — no read-modify-write race condition.
// ─────────────────────────────────────────────────────────────────────────────

export const takeJuniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action
   if (
      !Object.values(TRAINING_DEPT_JUNIOR_ACTION).includes(
         action as TRAINING_DEPT_JUNIOR_ACTION
      ) ||
      action === TRAINING_DEPT_JUNIOR_ACTION.PENDING
   ) {
      throw new AppError(
         "Invalid action. Junior action must be 'reviewed'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Load enrollment to check idempotency (junior already reviewed?)
   const existing = await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   // Idempotency guard: reject if junior has already acted
   if (
      (existing.trainingDeptReview as any)?.juniorAction ===
      TRAINING_DEPT_JUNIOR_ACTION.REVIEWED
   ) {
      throw new AppError(
         "Junior review has already been recorded for this enrollment.",
         HTTP_STATUS.CONFLICT
      );
   }

   // 3. Atomic update — single round-trip, no race condition
   //    Stage does NOT advance here; it stays TRAINING_DEPT_REVIEW until senior acts.
   await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
      },
      {
         $set: {
            "trainingDeptReview.juniorOfficerId": toObjectId(officerId),
            "trainingDeptReview.juniorAction":    action as TRAINING_DEPT_JUNIOR_ACTION,
            "trainingDeptReview.juniorNote":      note,
            "trainingDeptReview.juniorActedAt":   new Date(),
         },
         $push: {
            timeline: {
               stage:     ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
               actorId:   toObjectId(officerId),
               actorType: ACTOR_TYPE.TRAINING_DEPT,
               action,
               note,
               at:        new Date(),
            },
         },
      },
      { new: true }
   );

   return { message: "Junior review recorded" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Training Dept Senior action (approve | reject)
//
// Idempotency: stage filter on TRAINING_DEPT_REVIEW + check that junior has
// already acted (seniorAction still WAITING) prevents:
//   - Senior acting before junior
//   - Senior double-acting after stage has advanced
//
// Atomicity: single findOneAndUpdate.
// ─────────────────────────────────────────────────────────────────────────────

export const takeSeniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: string,
   note: string
) => {
   // 1. Validate action
   if (
      !Object.values(TRAINING_DEPT_SENIOR_ACTION).includes(
         action as TRAINING_DEPT_SENIOR_ACTION
      ) ||
      action === TRAINING_DEPT_SENIOR_ACTION.WAITING
   ) {
      throw new AppError(
         "Invalid action. Senior action must be 'approve' or 'reject'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Load enrollment — must be in TRAINING_DEPT_REVIEW and junior must have acted
   const existing = await enrollmentModel.findOne({
      _id:          toObjectId(String(enrollmentId)),
      orgId:        toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (!existing.trainingDeptReview) {
      throw new AppError(
         "Junior review must be completed before senior action.",
         HTTP_STATUS.CONFLICT
      );
   }

   // Idempotency guard: reject if senior has already acted
   if (
      (existing.trainingDeptReview as any)?.seniorAction !==
      TRAINING_DEPT_SENIOR_ACTION.WAITING
   ) {
      throw new AppError(
         "Senior review has already been recorded for this enrollment.",
         HTTP_STATUS.CONFLICT
      );
   }

   // 3. Determine next stage
   const nextStage =
      action === TRAINING_DEPT_SENIOR_ACTION.APPROVE
         ? ENROLLMENT_STAGE.APPROVED
         : ENROLLMENT_STAGE.REJECTED;

   const nextEnrollmentStatus =
      action === TRAINING_DEPT_SENIOR_ACTION.APPROVE ? "approved" : "rejected";

   // 4. Atomic update — single round-trip, no race condition
   await enrollmentModel.findOneAndUpdate(
      {
         _id:          toObjectId(String(enrollmentId)),
         orgId:        toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
      },
      {
         $set: {
            currentStage:                        nextStage,
            "statusSummary.enrollmentStatus":    nextEnrollmentStatus,
            "trainingDeptReview.seniorOfficerId": toObjectId(officerId),
            "trainingDeptReview.seniorAction":    action as TRAINING_DEPT_SENIOR_ACTION,
            "trainingDeptReview.seniorNote":      note,
            "trainingDeptReview.seniorActedAt":   new Date(),
         },
         $push: {
            timeline: {
               stage:     nextStage,
               actorId:   toObjectId(officerId),
               actorType: ACTOR_TYPE.TRAINING_DEPT,
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
