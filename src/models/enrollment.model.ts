import mongoose, { Schema } from "mongoose";
import { IEnrollment } from "../interfaces/enrollment.interface.js";

const enrollmentSchema = new Schema<IEnrollment>(
   {
      userId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true
      },

      programId: {
         type: Schema.Types.ObjectId,
         ref: "Program",
         required: true
      },

      status: {
         type: String,
         enum: ["active", "completed", "cancelled", "pending"],
         default: "active"
      }
   },
   {
      timestamps: true
   }
);

export default mongoose.model<IEnrollment>("Enrollment", enrollmentSchema)