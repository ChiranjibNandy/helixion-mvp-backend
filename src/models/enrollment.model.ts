import mongoose, { Schema } from "mongoose";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import { APPROVAL_STATUS, ENROLLMENT_STATUS } from "../constants/enum.js";

const bookingDetailSchema = new Schema({
   from: { type: String, trim: true },
   to: { type: String, trim: true },
   refNo: { type: String, trim: true },
   departureTime: { type: String, trim: true },
   travelDate: { type: Date },
   travelClass: { type: String, trim: true }
}, { _id: false });

const timelineSchema = new Schema({
   stage: { type: String, required: true },
   actorId: { type: Schema.Types.ObjectId, ref: "User" },
   actorType: { type: String, required: true },
   action: { type: String, required: true },
   note: { type: String, default: "" },
   at: { type: Date, default: Date.now }
}, { _id: false });

const enrollmentSchema = new Schema<IEnrollment>(
   {
      orgId: {
         type: Schema.Types.ObjectId,
         index: true
      },
      employeeId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true,
         index: true
      },
      userId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true,
         index: true
      },
      programId: {
         type: Schema.Types.ObjectId,
         ref: "Program",
         required: true,
         index: true
      },
      providerOrgId: {
         type: Schema.Types.ObjectId,
         index: true
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
      },
      currentStage: {
         type: String,
         default: "submitted"
      },
      statusSummary: {
         enrollmentStatus: { type: String, default: "submitted" },
         tourStatus: { type: String, default: "submitted" },
         attendanceStatus: { type: String, default: "pending" },
         reimbursementStatus: { type: String, default: "not_started" }
      },
      policySnapshot: {
         managerApproval: {
            levels: { type: Number, default: 3 },
            minLevelToApprove: { type: Number, default: 1 }
         },
         trainingDeptApproval: {
            enabled: { type: Boolean, default: true },
            reviewMode: { type: String, default: "junior_senior" }
         },
         osdReview: {
            enabled: { type: Boolean, default: true },
            reviewMode: { type: String, default: "junior_senior" }
         }
      },
      managerApproval: {
         assignedApproverId: { type: Schema.Types.ObjectId, ref: "User" },
         action: { type: String, default: "pending" },
         note: { type: String, default: "" },
         actedAt: { type: Date }
      },
      trainingDeptReview: {
         juniorOfficerId: { type: Schema.Types.ObjectId, ref: "User" },
         juniorNote: { type: String, default: "" },
         juniorStatus: { type: String, default: "pending" },
         seniorOfficerId: { type: Schema.Types.ObjectId, ref: "User" },
         seniorAction: { type: String, default: "waiting" },
         seniorNote: { type: String, default: "" },
         seniorActedAt: { type: Date }
      },
      travelAndStay: {
         stayType: { type: String, required: true },
         placeOfTour: { type: String },
         frequentFlyerNo: { type: String, default: "" },
         modeOfTravel: { type: String },
         purpose: { type: String, default: "To Attend Training Program" },
         bookingDetails: { type: [bookingDetailSchema], default: [] },
         advancePaymentRequired: { type: Number, default: 0 },
         status: { type: String, default: "submitted" },
         managerAction: { type: String, default: "pending" },
         managerReason: { type: String, default: "" }
      },
      attendance: {
         uploadedByProvider: { type: Boolean, default: false },
         uploadedAt: { type: Date },
         status: { type: String, default: "pending" }
      },
      reimbursement: {
         submittedAt: { type: Date },
         expenses: {
            travelCost: { type: Number, default: 0 },
            accommodationCost: { type: Number, default: 0 },
            foodCost: { type: Number, default: 0 }
         },
         receipts: [{ type: String }],
         totalAmount: { type: Number, default: 0 },
         osdJunior: {
            officerId: { type: Schema.Types.ObjectId, ref: "User" },
            action: { type: String, default: "pending" },
            note: { type: String, default: "" },
            actedAt: { type: Date }
         },
         osdSenior: {
            officerId: { type: Schema.Types.ObjectId, ref: "User" },
            action: { type: String, default: "waiting" },
            note: { type: String, default: "" },
            actedAt: { type: Date }
         }
      },
      timeline: { type: [timelineSchema], default: [] }
   },
   {
      timestamps: true
   });

//add compound index with fields userId and status
enrollmentSchema.index({ userId: 1, status: 1 });
enrollmentSchema.index({ employeeId: 1, status: 1 });

export default mongoose.model<IEnrollment>("Enrollment", enrollmentSchema)