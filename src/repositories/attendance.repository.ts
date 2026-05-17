import attendanceModel from "../models/attendance.model.js";
import { TakeAttendancePayload } from "../types/attendance.js";


//take attendance on corresponding project for multiple participant at a time
export const upsertAttendanceRepository = async (
   payload: TakeAttendancePayload
) => {
   const { programId, date, participants } = payload;

   return await attendanceModel.findOneAndUpdate(
      {
         programId,
         date,
      },
      {
         $set: {
            participants,
         },
      },
      {
         upsert: true,
         new: true,
         runValidators: true,
      }
   );
};