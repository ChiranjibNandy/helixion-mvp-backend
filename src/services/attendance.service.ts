import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getAttendanceByProgramIdRepo, updateParticipantAttendanceRepository, upsertAttendanceRepo } from "../repositories/attendance.repository.js";
import { findProgramById } from "../repositories/program.repository.js";
import enrollmentModel from "../models/enrollment.model.js";
import { TakeAttendancePayload, UpdateParticipantAttendancePayload } from "../types/attendance.js";
import { AppError } from "../utils/appError.js";
import { validateParticipantsEnrollmentService } from "../validators/attendance.validator.js";
import { ATTENDANCE_RECORD_STATUS, ATTENDANCE_STATUS, ENROLLMENT_STAGE } from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";

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
// marking Absent ends the workflow. Single atomic updateOne — no read-
// modify-write race. No-op (0 matched) if no matching non-terminal
// enrollment exists (e.g. the participant isn't enrolled, or the enrollment
// already advanced past the point where attendance should still drive it).
export const syncEnrollmentOnAttendanceService = async (
   programId: string,
   participantId: string,
   present_status: string
) => {
   const now = new Date();
   await enrollmentModel.updateOne(
      {
         programId:    toObjectId(programId),
         employeeId:   toObjectId(participantId),
         currentStage: { $nin: ATTENDANCE_LOCKED_STAGES },
      },
      { $set: present_status === ATTENDANCE_STATUS.PRESENT ? presentUpdate(now) : absentUpdate(now) }
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
   const presentIds = participants
      .filter((p) => p.present_status === ATTENDANCE_STATUS.PRESENT)
      .map((p) => toObjectId(p.participantId));
   const absentIds = participants
      .filter((p) => p.present_status !== ATTENDANCE_STATUS.PRESENT)
      .map((p) => toObjectId(p.participantId));

   const ops: Promise<unknown>[] = [];

   if (presentIds.length > 0) {
      ops.push(
         enrollmentModel.updateMany(
            { programId: toObjectId(programId), employeeId: { $in: presentIds }, currentStage: { $nin: ATTENDANCE_LOCKED_STAGES } },
            { $set: presentUpdate(now) }
         )
      );
   }
   if (absentIds.length > 0) {
      ops.push(
         enrollmentModel.updateMany(
            { programId: toObjectId(programId), employeeId: { $in: absentIds }, currentStage: { $nin: ATTENDANCE_LOCKED_STAGES } },
            { $set: absentUpdate(now) }
         )
      );
   }

   const results = await Promise.allSettled(ops);
   for (const result of results) {
      if (result.status === "rejected") {
         console.error("[attendance] enrollment sync failed:", result.reason);
      }
   }
};

export const takeAttendanceService = async (
   payload: TakeAttendancePayload
) => {
   const participantIds = payload.participants.map(
      (participant) => participant.participantId
   );

   // validate participants
   await validateParticipantsEnrollmentService(
      payload.programId,
      participantIds
   );
   const programData = await findProgramById(payload.programId)
   if (!programData) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND)
   }
   const result = await upsertAttendanceRepo(payload, programData.title);

   await syncEnrollmentsOnAttendanceService(payload.programId, payload.participants);

   return result;
};

export const getProgramAttendanceService = async (programId: string) => {
   return await getAttendanceByProgramIdRepo(programId);
};

//take single participant attendance

export const updateParticipantAttendanceService =
   async (
      payload: UpdateParticipantAttendancePayload
   ) => {

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
