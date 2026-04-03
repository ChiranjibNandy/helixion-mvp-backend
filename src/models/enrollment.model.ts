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

//add compound index with fields userId and status
enrollmentSchema.index({ userId: 1, status: 1 });

export default mongoose.model<IEnrollment>("Enrollment", enrollmentSchema)