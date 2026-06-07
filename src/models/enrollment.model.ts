import mongoose, { Schema } from "mongoose";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import {
  ENROLLMENT_STATUS,
  ENROLLMENT_APPROVAL_STATUS,
  ENROLLMENT_SOURCE,
  STAY_TYPE_KEY,
  CURRENCY,
} from "../constants/enum.js";

const programSnapshotSchema = new Schema(
  {
    title:               { type: String, required: true },
    startDate:           { type: Date },
    endDate:             { type: Date },
    venue:               { type: String },
    training_providerId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const enrollmentSchema = new Schema<IEnrollment>(
  {
    
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ENROLLMENT_STATUS),
      default: ENROLLMENT_STATUS.ACTIVE,
    },

    // accomodation
    stayType: {
      type: String,
      enum: Object.values(STAY_TYPE_KEY),
      required: true,
    },

    // fee 
    feeAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: Object.values(CURRENCY),
      default: CURRENCY.INR,
      uppercase: true,
      trim: true,
    },

    // program snpshot
    programSnapshot: {
      type: programSnapshotSchema,
      required: true,
    },

    // workflow
    approvalStatus: {
      type: String,
      enum: Object.values(ENROLLMENT_APPROVAL_STATUS),
      default: ENROLLMENT_APPROVAL_STATUS.NOT_REQUIRED,
    },

    // program location match
    locationMatched: {
      type: Boolean,
      default: false,
    },

    // trace
    source: {
      type: String,
      enum: Object.values(ENROLLMENT_SOURCE),
      default: ENROLLMENT_SOURCE.WEB,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ userId: 1, status: 1 });
enrollmentSchema.index({ programId: 1, status: 1 });
enrollmentSchema.index({ userId: 1, approvalStatus: 1 });
enrollmentSchema.index({ "programSnapshot.training_providerId": 1, createdAt: -1 });

export default mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
