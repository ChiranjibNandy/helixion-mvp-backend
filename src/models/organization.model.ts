import mongoose, { Schema } from "mongoose";
import {
   AssignmentMode,
   OrganizationStatus,
   OrganizationType,
} from "../constants/enum.js";
import { IOrganization } from "../interfaces/organization.interface.js";

const approvalPolicySchema = new Schema(
   {
      enabled: {
         type: Boolean,
         default: false,
      },
      levels: {
         type: Number,
         required: true,
      },
      minLevelToApprove: {
         type: Number,
         required: true,
      },
      assignmentMode: {
         type: String,
         enum: Object.values(AssignmentMode),
         required: true,
      },
   },
   { _id: false }
);

const policyAssignmentSchema = new Schema(
   {
      userId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: true,
      },
      level: {
         type: Number,
         required: true,
      },
   },
   { _id: false }
);

const organizationSchema = new Schema<IOrganization>(
   {
      name: {
         type: String,
         required: true,
         trim: true,
      },

      slug: {
         type: String,
         required: true,
         unique: true,
         lowercase: true,
         trim: true,
      },

      orgType: {
         type: String,
         enum: Object.values(OrganizationType),
         required: true,
      },

      status: {
         type: String,
         enum: Object.values(OrganizationStatus),
         default: OrganizationStatus.ACTIVE,
      },

      // Populated by the billing-master-data work on another branch; invoice
      // generation reads this instead of asking the training provider to
      // type it in each time.
      billing: {
         gstin: { type: String, trim: true },
         stateCode: { type: String, trim: true },
         stateName: { type: String, trim: true },
         address: { type: String, trim: true },
         email: { type: String, trim: true },
         phone: { type: String, trim: true },
      },

      policy: {
         managerApproval: approvalPolicySchema,
         trainingDeptApproval: approvalPolicySchema,
         osdReview: approvalPolicySchema,
         tourForm: approvalPolicySchema,
         reimbursement: approvalPolicySchema,
         tourApproval: {
            managerApprovalRequired: { type: Boolean, default: true },
            ctdApprovalRequired: { type: Boolean, default: true }
         },
         reimbursementApproval: {
            managerApprovalRequired: { type: Boolean, default: true },
            osdApprovalRequired: { type: Boolean, default: true }
         }
      },

      policyAssignments: {
         trainingDeptChain: {
            type: [policyAssignmentSchema],
            default: [],
         },

         osdChain: {
            type: [policyAssignmentSchema],
            default: [],
         },
      },
   },
   {
      timestamps: true,
   }
);

export const organizationModel = mongoose.model<IOrganization>(
   "Organization",
   organizationSchema
);