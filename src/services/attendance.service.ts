import { getAttendanceByIdRepository, upsertAttendanceRepository } from "../repositories/attendance.repository.js";
import { TakeAttendancePayload } from "../types/attendance.js";
import { validateParticipantsEnrollmentService } from "../validators/attendance.validator.js";


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
   return await upsertAttendanceRepository(payload);
};

export const getProgramAttendanceService = async (
   attendanceId: string
) => {
   const attendance =
      await getAttendanceByIdRepository(attendanceId);

   return attendance;
};