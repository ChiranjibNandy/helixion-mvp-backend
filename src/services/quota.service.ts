import mongoose, { HydratedDocument } from "mongoose";
import programModel from "../models/program.model.js";
import enrollmentModel from "../models/enrollment.model.js";
import { IProgram } from "../interfaces/program.interface.js";
import {
   ACTOR_TYPE,
   ENROLLMENT_REJECTION_REASON,
   ENROLLMENT_STAGE,
   ENROLLMENT_STATUS_SUMMARY,
} from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { sendEnrollmentAutoRejectedQuotaFullMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure } from "../utils/notification.util.js";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance quota enforcement.
//
// confirmedEnrollmentCount is the authoritative "actually sent to TP" counter
// on Program — distinct from the read-time $lookup aggregations elsewhere
// (getAverageFillRate, getPrograms, etc.), which only estimate fill rate and
// are never used for enforcement. It increments exactly once per enrollment,
// at the moment that enrollment is confirmed as BOTH Manager- and CTD-approved
// with a slot still available.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically reserves one slot on a program, iff a slot is still available.
 * Must be called inside the same transaction/session as the enrollment stage
 * transition it is guarding, so the two documents move together or not at all.
 *
 * Returns the updated program on success, or null if the program is already
 * at capacity (caller must abort the transaction and surface the block).
 */
export const reserveProgramSlot = async (
   programId: string,
   session: mongoose.ClientSession
): Promise<HydratedDocument<IProgram> | null> => {
   return await programModel.findOneAndUpdate(
      {
         _id: toObjectId(programId),
         $expr: { $lt: ["$confirmedEnrollmentCount", "$maxParticipants"] },
      },
      { $inc: { confirmedEnrollmentCount: 1 } },
      { session, new: true }
   );
};

/**
 * Auto-rejects every other enrollment for this program still sitting in
 * Manager or Training Dept review, once the program has just become full.
 * Idempotent by design (re-filters on currentStage), so it's safe to call
 * without a transaction/session — a concurrent duplicate call simply finds
 * nothing left to update.
 */
export const autoRejectRemainingPendingEnrollments = async (
   programId: string,
   excludeEnrollmentId: string
) => {
   const filter = {
      programId: toObjectId(programId),
      _id: { $ne: toObjectId(excludeEnrollmentId) },
      currentStage: {
         $in: [ENROLLMENT_STAGE.MANAGER_REVIEW, ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW],
      },
   };

   // Snapshot the affected enrollments before the update so we know who to
   // email — updateMany doesn't return matched documents.
   const pending = await enrollmentModel.find(filter);
   if (pending.length === 0) return;

   await enrollmentModel.updateMany(filter, {
      $set: {
         currentStage: ENROLLMENT_STAGE.REJECTED,
         rejectionReason: ENROLLMENT_REJECTION_REASON.QUOTA_FULL,
         "statusSummary.enrollmentStatus": ENROLLMENT_STATUS_SUMMARY.REJECTED,
      },
      $push: {
         timeline: {
            stage: ENROLLMENT_STAGE.REJECTED,
            actorType: ACTOR_TYPE.SYSTEM,
            action: "auto_rejected_quota_full",
            note: "Program reached maximum attendance capacity",
            at: new Date(),
         },
      },
   });

   await Promise.all(
      pending.map(async (enrollment) => {
         const { employee, programTitle } = await loadNotificationContext(
            String(enrollment.employeeId),
            String(enrollment.programId)
         );
         if (!employee) return;
         return sendEnrollmentAutoRejectedQuotaFullMail(employee.email, employee.name, programTitle).catch(
            logMailFailure("enrollment-auto-rejected-quota-full")
         );
      })
   );
};
