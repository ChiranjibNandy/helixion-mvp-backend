import { getAttendanceByIdRepository, upsertAttendanceRepository } from "../repositories/attendance.repository.js";
import { TakeAttendancePayload } from "../types/attendance.js";

export const takeAttendanceService = async (
   payload: TakeAttendancePayload
) => {
   return await upsertAttendanceRepository(payload);
};

export const getProgramAttendanceService = async (
   attendanceId: string
) => {
   const attendance =
      await getAttendanceByIdRepository(attendanceId);

   return attendance;
};