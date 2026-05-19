import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getAttendanceByProgramIdRepo, updateParticipantAttendanceRepository, upsertAttendanceRepo } from "../repositories/attendance.repository.js";
import { TakeAttendancePayload, UpdateParticipantAttendancePayload } from "../types/attendance.js";
import { AppError } from "../utils/appError.js";
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
   return await upsertAttendanceRepo(payload);
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
   };