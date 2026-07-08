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

      policy: {
         managerApproval: approvalPolicySchema,
         trainingDeptApproval: approvalPolicySchema,
         osdReview: approvalPolicySchema,
         tourForm: approvalPolicySchema,
         reimbursement: approvalPolicySchema,
         tourApproval: {
            managerApprovalRequired: { type: Boolean, default: true },
            osdApprovalRequired: { type: Boolean, default: true }
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