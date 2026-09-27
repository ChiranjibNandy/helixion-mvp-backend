import mongoose, { Schema } from "mongoose";
import { IAttendanceRecord } from "../interfaces/attendanceRecord.interface.js";
import { ATTENDANCE_DAY_STATUS } from "../constants/enum.js";

const attendanceDayEntrySchema = new Schema(
   {
      status: {
         type: String,
         enum: Object.values(ATTENDANCE_DAY_STATUS),
         required: true,
      },
      markedAt: {
         type: Date,
         required: true,
      },
      markedBy: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },
   },
   { _id: false }
);

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
   {
      enrollmentId: {
         type: Schema.Types.ObjectId,
         ref: "Enrollment",
         required: true,
      },

      programId: {
         type: Schema.Types.ObjectId,
         ref: "Program",
         required: true,
      },

      employeeId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },

      attendanceByDay: {
         type: Map,
         of: attendanceDayEntrySchema,
         default: {},
      },

      notes: {
         type: String,
         default: "",
      },
   },
   {
      timestamps: true,
      toJSON: { flattenMaps: true },
      toObject: { flattenMaps: true },
   }
);

// one attendance record per enrollment per program
attendanceRecordSchema.index(
   { enrollmentId: 1, programId: 1 },
   { unique: true, name: "unique_enrollment_program" }
);

attendanceRecordSchema.index({ programId: 1 });
attendanceRecordSchema.index({ employeeId: 1 });

export default mongoose.model<IAttendanceRecord>(
   "AttendanceRecord",
   attendanceRecordSchema
);
