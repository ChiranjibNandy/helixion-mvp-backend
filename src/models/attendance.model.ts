import mongoose, { Schema } from "mongoose";
import { IAttendance } from "../interfaces/attendance.interface.js";
import { ATTENDANCE_STATUS } from "../constants/enum.js";

const participantAttendanceSchema = new Schema(
   {
      participantId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true
      },

      present_status: {
         type: String,
         enum: Object.values(ATTENDANCE_STATUS),
         required: true
      }
   },
   {
      _id: false
   }
);

const attendanceSchema = new Schema<IAttendance>(
   {
      programId: {
         type: Schema.Types.ObjectId,
         ref: "Program",
         required: true
      },

      date: {
         type: Date,
         required: true
      },
      training_providerId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true
      },
      program_title: {
         type: String,
      },

      participants: {
         type: [participantAttendanceSchema],
         default: []
      }
   },
   {
      timestamps: true
   }
);

// one attendance per program per day
attendanceSchema.index(
   { programId: 1, date: 1 },
   { unique: true }
);

attendanceSchema.index({
   training_providerId: 1,
   createdAt: -1
});

attendanceSchema.index({
   training_providerId: 1,
   date: -1
});

attendanceSchema.index({
   programId: 1,
   createdAt: -1
});

export default mongoose.model<IAttendance>(
   "Attendance",
   attendanceSchema
);