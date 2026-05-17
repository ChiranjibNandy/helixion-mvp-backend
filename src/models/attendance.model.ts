import mongoose, { Schema } from "mongoose";
import { IAttendance } from "../interfaces/attendance.interface.js";

const participantAttendanceSchema = new Schema(
   {
      participantId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true
      },

      status: {
         type: String,
         enum: ["present", "absent"],
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

export default mongoose.model<IAttendance>(
   "Attendance",
   attendanceSchema
);