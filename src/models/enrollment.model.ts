import mongoose, { Schema } from "mongoose";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import { APPROVAL_STATUS, ENROLLMENT_STATUS } from "../constants/enum.js";

const enrollmentSchema = new Schema(
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
         enum: Object.values(ENROLLMENT_STATUS),
         default: ENROLLMENT_STATUS.PENDING
      },

      approvalStatus: {
         type: String,
         enum: Object.values(APPROVAL_STATUS),
         default: APPROVAL_STATUS.PENDING
      }
   },
   {
      timestamps: true
   });

//add compound index with fields userId and status
enrollmentSchema.index({ userId: 1, status: 1 });

export default mongoose.model<IEnrollment>("Enrollment", enrollmentSchema)