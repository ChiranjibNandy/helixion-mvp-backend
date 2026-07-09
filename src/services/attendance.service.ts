import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getAttendanceByProgramIdRepo, updateParticipantAttendanceRepository, upsertAttendanceRepo } from "../repositories/attendance.repository.js";
import { assertProgramOwnershipService } from "./program.service.js";
import { syncEnrollmentAttendanceRepo, bulkSyncEnrollmentAttendanceRepo } from "../repositories/enrollment.repository.js";
import { TakeAttendancePayload, UpdateParticipantAttendancePayload } from "../types/attendance.js";
import { AppError } from "../utils/appError.js";
import { validateParticipantsEnrollmentService } from "../validators/attendance.validator.js";
import { ATTENDANCE_RECORD_STATUS, ATTENDANCE_STATUS, ENROLLMENT_STAGE } from "../constants/enum.js";

// Enrollment stages at or past which a (re-)mark of attendance must not
// clobber forward progress (e.g. TP re-marking attendance after the
// reimbursement claim has already been submitted/reviewed).
const ATTENDANCE_LOCKED_STAGES: ENROLLMENT_STAGE[] = [
   ENROLLMENT_STAGE.ABSENT,
   ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
   ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW,
   ENROLLMENT_STAGE.COMPLETED,
   ENROLLMENT_STAGE.REJECTED,
];

const presentUpdate = (now: Date) => ({
   "attendance.uploadedByProvider":  true,
   "attendance.uploadedAt":          now,
   "attendance.status":              ATTENDANCE_RECORD_STATUS.ATTENDED,
   "statusSummary.attendanceStatus": ATTENDANCE_RECORD_STATUS.ATTENDED,
   "reimbursement.enabled":          true,
   currentStage:                     ENROLLMENT_STAGE.ATTENDED,
});

const absentUpdate = (now: Date) => ({
   "attendance.uploadedByProvider":  true,
   "attendance.uploadedAt":          now,
   "attendance.status":              ATTENDANCE_RECORD_STATUS.ABSENT,
   "statusSummary.attendanceStatus": ATTENDANCE_RECORD_STATUS.ABSENT,
   currentStage:                     ENROLLMENT_STAGE.ABSENT,
});

// Marking attendance Present unlocks reimbursement (reimbursement.enabled);
// marking Absent ends the workflow. Single atomic update (in the repository
// layer) — no read-modify-write race. No-op (0 matched) if no matching
// non-terminal enrollment exists (e.g. the participant isn't enrolled, or
// the enrollment already advanced past the point where attendance should
// still drive it).
export const syncEnrollmentOnAttendanceService = async (
   programId: string,
   participantId: string,
   present_status: string
) => {
   const now = new Date();
   await syncEnrollmentAttendanceRepo(
      programId,
      participantId,
      ATTENDANCE_LOCKED_STAGES,
      present_status === ATTENDANCE_STATUS.PRESENT ? presentUpdate(now) : absentUpdate(now)
   );
};

// Bulk variant for takeAttendanceService — batches the whole roster into at
// most two updateMany calls (present group, absent group) instead of one
// round trip per participant, so a 500-person roster costs 2 writes instead
// of 500. Best-effort: the attendance roster itself is already persisted
// (the source of truth) by the time this runs, so a sync failure here is
// logged rather than surfaced as a failure of an otherwise-successful
// attendance save — and one bad group doesn't block the other.
export const syncEnrollmentsOnAttendanceService = async (
   programId: string,
   participants: { participantId: string; present_status: string }[]
) => {
   const now = new Date();
   const presentIds: string[] = [];
   const absentIds: string[] = [];

   for (const participant of participants) {
      if (participant.present_status === ATTENDANCE_STATUS.PRESENT) {
         presentIds.push(participant.participantId);
      } else {
         absentIds.push(participant.participantId);
      }
   }

   const results = await Promise.allSettled([
      bulkSyncEnrollmentAttendanceRepo(programId, presentIds, ATTENDANCE_LOCKED_STAGES, presentUpdate(now)),
      bulkSyncEnrollmentAttendanceRepo(programId, absentIds, ATTENDANCE_LOCKED_STAGES, absentUpdate(now)),
   ]);
   for (const result of results) {
      if (result.status === "rejected") {
         console.error("[attendance] enrollment sync failed:", result.reason);
      }
   }
};

export const takeAttendanceService = async (
   payload: TakeAttendancePayload
) => {
   // Ownership check (ticket 0032): only the TP who created this program
   // may take attendance for it. Also gets programData.title in one call.
   const programData = await assertProgramOwnershipService(
      payload.programId,
      payload.training_providerId
   );

   const participantIds = payload.participants.map(
      (participant) => participant.participantId
   );

   // validate participants (also enforces the CTD-approval visibility gate)
   await validateParticipantsEnrollmentService(
      payload.programId,
      participantIds
   );

   const result = await upsertAttendanceRepo(payload, programData.title);

   await syncEnrollmentsOnAttendanceService(payload.programId, payload.participants);

   return result;
};

export const getProgramAttendanceService = async (
   programId: string,
   requestingUserId: string
) => {
   await assertProgramOwnershipService(programId, requestingUserId);
   return await getAttendanceByProgramIdRepo(programId);
};

//take single participant attendance

export const updateParticipantAttendanceService =
   async (
      payload: UpdateParticipantAttendancePayload
   ) => {
      // Ownership check (ticket 0032): only the TP who created this program
      // may mark attendance for it.
      await assertProgramOwnershipService(payload.programId, payload.training_providerId);

      // Same CTD-approval visibility gate the bulk path enforces via
      // validateParticipantsEnrollmentService — the single-participant path
      // previously had no enrollment validation at all.
      await validateParticipantsEnrollmentService(payload.programId, [payload.participantId]);

      const updatedAttendance =
         await updateParticipantAttendanceRepository(
            payload
         );

      if (!updatedAttendance) {
         throw new AppError(
            MESSAGES.ATTENDANCE_NOTFOUND,
            HTTP_STATUS.NOT_FOUND
         );
      }

      await syncEnrollmentOnAttendanceService(
         payload.programId,
         payload.participantId,
         payload.present_status
      );
   };
