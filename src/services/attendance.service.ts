import { upsertAttendanceRepository } from "../repositories/attendance.repository.js";
import { TakeAttendancePayload } from "../types/attendance.js";

export const takeAttendanceService = async (
   payload: TakeAttendancePayload
) => {
   return await upsertAttendanceRepository(payload);
};