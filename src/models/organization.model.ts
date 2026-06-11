import mongoose, { Schema, Document } from "mongoose";
import { AssignmentMode, OrganizationStatus, OrganizationType } from "../constants/enum.js";

export interface OrganizationDocument extends Document {
   name: string;
   slug: string;
   orgType: OrganizationType;
   status: OrganizationStatus;

   policy: {
      managerApproval: ApprovalPolicy;
      trainingDeptApproval: ApprovalPolicy;
      osdReview: ApprovalPolicy;

      tourForm: {
         enabled: boolean;
         approvalStage: ApprovalPolicy;
      };

      reimbursement: {
         enabled: boolean;
         approvalStage: ApprovalPolicy;
      };
   };

   createdAt: Date;
   updatedAt: Date;
}

interface ApprovalPolicy {
   enabled: boolean;
   levels: number;
   minLevelToApprove: number;
   assignmentMode: AssignmentMode;
}

const approvalPolicySchema = new Schema(
   {
      enabled: { type: Boolean, default: true },
      levels: { type: Number, required: true },
      minLevelToApprove: { type: Number, required: true },
      assignmentMode: {
         type: String,
         enum: Object.values(AssignmentMode),
         required: true,
      },
   },
   { _id: false }
);

const organizationSchema = new Schema<OrganizationDocument>(
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
         enum:Object.values(OrganizationStatus),
         default: OrganizationStatus.ACTIVE,
      },

      policy: {
         managerApproval: approvalPolicySchema,
         trainingDeptApproval: approvalPolicySchema,
         osdReview: approvalPolicySchema,

         tourForm: {
            enabled: Boolean,
            approvalStage: approvalPolicySchema,
         },

         reimbursement: {
            enabled: Boolean,
            approvalStage: approvalPolicySchema,
         },
      },
   },
   {
      timestamps: true,
   }
);

export const organizationModel =
   mongoose.model<OrganizationDocument>(
      "Organization",
      organizationSchema
   );