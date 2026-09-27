import { Document, Types } from "mongoose";
import { ATTENDANCE_DAY_STATUS } from "../constants/enum.js";

export interface IAttendanceDayEntry {
   status: ATTENDANCE_DAY_STATUS;
   markedAt: Date;
   markedBy: Types.ObjectId;
}

export interface IAttendanceRecord extends Document {
   enrollmentId: Types.ObjectId;
   programId: Types.ObjectId;
   employeeId: Types.ObjectId;
   // Keyed by "YYYY-MM-DD". A day with no entry is pending — an entry is only
   // written once a TP has actually touched that day (including clearing it).
   attendanceByDay: Map<string, IAttendanceDayEntry>;
   notes: string;
   createdAt: Date;
   updatedAt: Date;
}
