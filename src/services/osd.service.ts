import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
   getPendingEnrollmentsForStageRepo,
   getEnrollmentForStageOsdRepo,
   updateEnrollmentForStageOsdRepo,
   getEnrollmentForTourOsdActionRepo,
   updateEnrollmentForTourOsdActionRepo,
   takeReimbursementOsdActionRepo,
   getPendingTourApprovalsForOsdRepo,
} from "../repositories/enrollment.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { AppError } from "../utils/appError.js";
import {
   ENROLLMENT_STAGE,
   REIMBURSEMENT_ACTION,
   REIMBURSEMENT_STATUS,
   ACTOR_TYPE,
   TOUR_OSD_ACTION,
   TOUR_STATUS,
   TRAVEL_TYPE,
   OSD_JUNIOR_ACTION,
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
// Atomicity: single findOneAndUpdate (in the repository layer) — no read-
// modify-write race.
// ─────────────────────────────────────────────────────────────────────────────

export const takeOsdJuniorActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: OSD_JUNIOR_ACTION,
   note: string
) => {
   if (
      !Object.values(OSD_JUNIOR_ACTION).includes(action) ||
      action === OSD_JUNIOR_ACTION.PENDING
   ) {
      throw new AppError(
         "Invalid action. Must be 'return' or 'recommend'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Verify enrollment exists in junior-review stage (idempotency guard)
   const existing = await getEnrollmentForStageOsdRepo(
      enrollmentId,
      orgId,
      ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW
   );

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   if (!existing.reimbursement) {
      throw new AppError("No reimbursement data found.", HTTP_STATUS.CONFLICT);
   }

   // 3. Determine next stage and status
   const nextStage =
      action === OSD_JUNIOR_ACTION.RETURN
         ? ENROLLMENT_STAGE.REIMBURSEMENT_SUBMITTED
         : ENROLLMENT_STAGE.OSD_SENIOR_REVIEW;

   const nextReimbursementStatus =
      action === OSD_JUNIOR_ACTION.RETURN
         ? REIMBURSEMENT_STATUS.RETURNED
         : REIMBURSEMENT_STATUS.RECOMMENDED;

   // 4. Atomic update — single round-trip, no race condition
   await updateEnrollmentForStageOsdRepo(
      enrollmentId,
      orgId,
      ENROLLMENT_STAGE.OSD_JUNIOR_REVIEW,
      {
         $set: {
            currentStage: nextStage,
            "statusSummary.reimbursementStatus": nextReimbursementStatus,
            "reimbursement.osdJunior": {
               officerId: toObjectId(officerId),
               action: action as OSD_JUNIOR_ACTION,
               note,
               actedAt: new Date(),
            },
         },
         $push: {
            timeline: {
               stage: nextStage,
               actorId: toObjectId(officerId),
               actorType: ACTOR_TYPE.OSD,
               action,
               note,
               at: new Date(),
            },
         },
      }
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
      !Object.values(REIMBURSEMENT_ACTION).includes(action as REIMBURSEMENT_ACTION) ||
      action === REIMBURSEMENT_ACTION.WAITING ||
      action === REIMBURSEMENT_ACTION.PENDING
   ) {
      throw new AppError(
         "Invalid action. Must be 'approve' or 'reject'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   // 2. Verify enrollment exists in senior-review stage (idempotency guard)
   const existing = await getEnrollmentForStageOsdRepo(
      enrollmentId,
      orgId,
      ENROLLMENT_STAGE.OSD_SENIOR_REVIEW
   );

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
      action === REIMBURSEMENT_ACTION.APPROVE
         ? ENROLLMENT_STAGE.COMPLETED
         : ENROLLMENT_STAGE.REJECTED;

   const nextReimbursementStatus =
      action === REIMBURSEMENT_ACTION.APPROVE
         ? REIMBURSEMENT_STATUS.APPROVED
         : REIMBURSEMENT_STATUS.REJECTED;

   // 4. Atomic update — single round-trip, no race condition
   const updated = await takeReimbursementOsdActionRepo(
      enrollmentId,
      orgId,
      {
         currentStage: nextStage,
         "reimbursement.status": nextReimbursementStatus,
         "reimbursement.osdApproval": { action, note, actedAt: new Date() },
      },
      {
         stage: nextStage,
         actorId: toObjectId(officerId),
         actorType: ACTOR_TYPE.OSD,
         action,
         note,
         at: new Date(),
      }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return { currentStage: nextStage };
};

// ─────────────────────────────────────────────────────────────────────────────
// Tour OSD action (approve | reject)
// ─────────────────────────────────────────────────────────────────────────────

export const getPendingTourOsdApprovalsService = async (orgId: string) => {
   return await getPendingTourApprovalsForOsdRepo(orgId);
};

export const takeTourOsdActionService = async (
   enrollmentId: string,
   officerId: string,
   orgId: string,
   action: TOUR_OSD_ACTION,
   note: string
) => {
   if (
      !Object.values(TOUR_OSD_ACTION).includes(action as TOUR_OSD_ACTION) ||
      action === TOUR_OSD_ACTION.WAITING
   ) {
      throw new AppError(
         "Invalid action. Must be 'approve' or 'reject'.",
         HTTP_STATUS.BAD_REQUEST
      );
   }

   const existing = await enrollmentModel.findOne({
      _id: toObjectId(String(enrollmentId)),
      orgId: toObjectId(orgId),
      currentStage: ENROLLMENT_STAGE.TOUR_OSD_REVIEW,
   });

   if (!existing) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const nextStage = ENROLLMENT_STAGE.APPROVED;
   const nextTourStatus =
      action === TOUR_OSD_ACTION.APPROVE
         ? TOUR_STATUS.OSD_APPROVED
         : TOUR_STATUS.OSD_REJECTED;

   const updateOps: any = {
      $set: {
         currentStage: nextStage,
         "tour.status": nextTourStatus,
         "statusSummary.tourStatus": nextTourStatus,
         "tour.osdApproval": {
            officerId: toObjectId(officerId),
            action: action as TOUR_OSD_ACTION,
            note,
            actedAt: new Date(),
         },
      },
      $push: {
         timeline: {
            stage: nextStage,
            actorId: toObjectId(officerId),
            actorType: ACTOR_TYPE.OSD,
            action: `tour_osd_${action}`,
            note,
            at: new Date(),
         },
      },
   };

   // Fallback to self_travel if rejected
   if (action === TOUR_OSD_ACTION.REJECT) {
      updateOps.$set["tour.travelType"] = TRAVEL_TYPE.SELF_TRAVEL;
      if (existing.travelAndStay) {
         updateOps.$set["travelAndStay.status"] = TOUR_STATUS.REJECTED;
      }
   } else {
      if (existing.travelAndStay) {
         updateOps.$set["travelAndStay.status"] = TOUR_STATUS.APPROVED;
      }
   }

   const updated = await enrollmentModel.findOneAndUpdate(
      {
         _id: toObjectId(String(enrollmentId)),
         orgId: toObjectId(orgId),
         currentStage: ENROLLMENT_STAGE.TOUR_OSD_REVIEW,
      },
      updateOps,
      { new: true }
   );

   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return { currentStage: nextStage };
};
