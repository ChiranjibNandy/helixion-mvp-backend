import mongoose, { Schema } from "mongoose";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import {
   ENROLLMENT_STAGE,
   TOUR_STATUS,
   REIMBURSEMENT_STATUS,
   MANAGER_ACTION,
   MANAGER_CHAIN_STATUS,
   TRAINING_DEPT_JUNIOR_ACTION,
   TRAINING_DEPT_SENIOR_ACTION,
   OSD_JUNIOR_ACTION,
   OSD_SENIOR_ACTION,
   ACTOR_TYPE,
   ATTENDANCE_RECORD_STATUS,
} from "../constants/enum.js";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const managerChainItemSchema = new Schema(
   {
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      level:  { type: Number, required: true },
      status: {
         type:    String,
         enum:    Object.values(MANAGER_CHAIN_STATUS),
         default: MANAGER_CHAIN_STATUS.WAITING,
      },
   },
   { _id: false }
);

const bookingDetailSchema = new Schema(
   {
      from:          { type: String, trim: true },
      to:            { type: String, trim: true },
      refNo:         { type: String, trim: true },
      departureTime: { type: String, trim: true },
      travelDate:    { type: Date },
      travelClass:   { type: String, trim: true },
   },
   { _id: false }
);

const timelineSchema = new Schema(
   {
      stage:     { type: String, required: true },
      actorId:   { type: Schema.Types.ObjectId, ref: "User" },
      actorType: { type: String, enum: Object.values(ACTOR_TYPE), required: true },
      action:    { type: String, required: true },
      note:      { type: String, default: "" },
      at:        { type: Date, default: Date.now },
   },
   { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const enrollmentSchema = new Schema<IEnrollment>(
   {
      orgId: {
         type:  Schema.Types.ObjectId,
         index: true,
      },

      employeeId: {
         type:     Schema.Types.ObjectId,
         ref:      "User",
         required: true,
         index:    true,
      },

      programId: {
         type:     Schema.Types.ObjectId,
         ref:      "Program",
         required: true,
         index:    true,
      },

      providerOrgId: {
         type:  Schema.Types.ObjectId,
         index: true,
      },

      /**
       * SINGLE SOURCE OF TRUTH for the enrollment's position in the workflow.
       * All stage transitions must go through service-layer methods that update
       * this field atomically together with any sub-document action fields.
       * Never update sub-document action fields without also updating currentStage.
       */
      currentStage: {
         type:    String,
         enum:    Object.values(ENROLLMENT_STAGE),
         default: ENROLLMENT_STAGE.SUBMITTED,
         index:   true,
      },

      /**
       * Denormalized read-optimized cache for dashboard and list queries.
       * Always updated atomically alongside currentStage in the same DB operation.
       * Not a driver of workflow logic — currentStage is authoritative.
       *
       * Sub-document fields (attendance.status, reimbursement.osdJunior.action, etc.)
       * are granular action logs, not workflow state — they record WHO did WHAT
       * at each step; the workflow position is always currentStage.
       */
      statusSummary: {
         enrollmentStatus:   { type: String, default: "submitted" },
         tourStatus:         { type: String, enum: Object.values(TOUR_STATUS), default: TOUR_STATUS.SUBMITTED },
         attendanceStatus:   { type: String, enum: Object.values(ATTENDANCE_RECORD_STATUS), default: ATTENDANCE_RECORD_STATUS.PENDING },
         reimbursementStatus: { type: String, enum: Object.values(REIMBURSEMENT_STATUS), default: REIMBURSEMENT_STATUS.NOT_STARTED },
      },

      policySnapshot: {
         managerApproval: {
            levels:            { type: Number },
            minLevelToApprove: { type: Number },
         },
         trainingDeptApproval: {
            enabled:           { type: Boolean },
            levels:            { type: Number },
            minLevelToApprove: { type: Number },
         },
         osdReview: {
            enabled:           { type: Boolean },
            levels:            { type: Number },
            minLevelToApprove: { type: Number },
         },
      },

      /**
       * Frozen copy of the employee's manager chain at enrollment creation time.
       * Enables approval queries without joining Users at every request.
       *
       * Query pattern (see design doc):
       *   { "managerChain.userId": req.userId, "managerChain.status": "pending" }
       */
      managerChain: {
         type:    [managerChainItemSchema],
         default: [],
      },

      /**
       * managerApproval — summary of the most recent manager action taken.
       *
       * Relationship to managerChain:
       *   managerChain  → granular per-level state (one entry per approver).
       *   managerApproval → denormalized "last action" summary for quick reads.
       *
       * These two structures MUST be updated atomically in the same DB operation
       * (use $set on both fields in one findOneAndUpdate call). Updating only one
       * will cause them to drift out of sync.
       */
      managerApproval: {
         assignedApproverId: { type: Schema.Types.ObjectId, ref: "User" },
         action:    { type: String, enum: Object.values(MANAGER_ACTION), default: MANAGER_ACTION.PENDING },
         note:      { type: String, default: "" },
         actedAt:   { type: Date },
      },

      trainingDeptReview: {
         juniorOfficerId: { type: Schema.Types.ObjectId, ref: "User" },
         juniorAction:    { type: String, enum: Object.values(TRAINING_DEPT_JUNIOR_ACTION), default: TRAINING_DEPT_JUNIOR_ACTION.PENDING },
         juniorNote:      { type: String, default: "" },
         juniorActedAt:   { type: Date },
         seniorOfficerId: { type: Schema.Types.ObjectId, ref: "User" },
         seniorAction:    { type: String, enum: Object.values(TRAINING_DEPT_SENIOR_ACTION), default: TRAINING_DEPT_SENIOR_ACTION.WAITING },
         seniorNote:      { type: String, default: "" },
         seniorActedAt:   { type: Date },
      },

      travelAndStay: {
         stayType:               { type: String },
         placeOfTour:            { type: String },
         frequentFlyerNo:        { type: String, default: "" },
         modeOfTravel:           { type: String },
         purpose:                { type: String, default: "To Attend Training Program" },
         bookingDetails:         { type: [bookingDetailSchema], default: [] },
         advancePaymentRequired: { type: Number, default: 0 },
         status:                 { type: String, enum: Object.values(TOUR_STATUS), default: TOUR_STATUS.SUBMITTED },
         managerAction:          { type: String, enum: Object.values(MANAGER_ACTION), default: MANAGER_ACTION.PENDING },
         managerReason:          { type: String, default: "" },
      },

      attendance: {
         uploadedByProvider: { type: Boolean, default: false },
         uploadedAt:         { type: Date },
         status:             { type: String, enum: Object.values(ATTENDANCE_RECORD_STATUS), default: ATTENDANCE_RECORD_STATUS.PENDING },
      },

      reimbursement: {
         submittedAt: { type: Date },
         expenses: {
            travelCost:         { type: Number, default: 0 },
            accommodationCost:  { type: Number, default: 0 },
            foodCost:           { type: Number, default: 0 },
         },
         receipts:    [{ type: String }],
         totalAmount: { type: Number, default: 0 },
         osdJunior: {
            officerId: { type: Schema.Types.ObjectId, ref: "User" },
            action:    { type: String, enum: Object.values(OSD_JUNIOR_ACTION), default: OSD_JUNIOR_ACTION.PENDING },
            note:      { type: String, default: "" },
            actedAt:   { type: Date },
         },
         osdSenior: {
            officerId: { type: Schema.Types.ObjectId, ref: "User" },
            action:    { type: String, enum: Object.values(OSD_SENIOR_ACTION), default: OSD_SENIOR_ACTION.WAITING },
            note:      { type: String, default: "" },
            actedAt:   { type: Date },
         },
      },

      timeline: { type: [timelineSchema], default: [] },
   },
   {
      timestamps: true,
   }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Employee's own enrollments
enrollmentSchema.index({ employeeId: 1, currentStage: 1 });
enrollmentSchema.index({ orgId: 1, employeeId: 1 });

// Manager approval queue — core query pattern
enrollmentSchema.index({ orgId: 1, "managerChain.userId": 1, "managerChain.status": 1 });

// Training dept queue
enrollmentSchema.index({ orgId: 1, currentStage: 1 });

// Provider-side queries
enrollmentSchema.index({ providerOrgId: 1, currentStage: 1 });
enrollmentSchema.index({ programId: 1, currentStage: 1 });

export default mongoose.model<IEnrollment>("Enrollment", enrollmentSchema);
