import mongoose, { Schema } from "mongoose";
import { IOrganization } from "../interfaces/organization.interface.js";
import { ASSIGNMENT_MODE, ORGANIZATION_STATUS, ORGANIZATION_TYPE, REVIEW_MODE } from "../constants/enum.js";


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
         enum: [ORGANIZATION_TYPE.CORPORATE, ORGANIZATION_TYPE.TRAINING_PROVIDER, ORGANIZATION_TYPE.OSD_INTERNAL],
         required: true,
      },

      status: {
         type: String,
         enum: [ORGANIZATION_STATUS.ACTIVE, ORGANIZATION_STATUS.INACTIVE],
         default: ORGANIZATION_STATUS.ACTIVE,
      },

      policy: {
         managerApproval: {
            enabled: Boolean,
            levels: Number,
            minLevelToApprove: Number,
            allowRecommendOnlyAtLowerLevels: Boolean,
         },

         trainingDeptApproval: {
            enabled: Boolean,
            reviewMode: {
               type: String,
               enum: [REVIEW_MODE.SINGLE, REVIEW_MODE.JUNIOR_SENIOR],
            },
            juniorCanApprove: Boolean,
            seniorCanApprove: Boolean,
            assignmentMode: {
               type: String,
               enum: [ASSIGNMENT_MODE.POOL, ASSIGNMENT_MODE.LOCATION_BASED],
            },
         },

         osdReview: {
            enabled: Boolean,
            reviewMode: {
               type: String,
               enum: [REVIEW_MODE.SINGLE, REVIEW_MODE.JUNIOR_SENIOR],
            },
            juniorCanApprove: Boolean,
            seniorCanApprove: Boolean,
            assignmentMode: {
               type: String,
               enum: [ASSIGNMENT_MODE.POOL, ASSIGNMENT_MODE.LOCATION_BASED],
            },
         },

         tourForm: {
            enabled: Boolean,
            autoCreateOnEnrollment: Boolean,
            approver: String,
         },

         reimbursement: {
            enabled: Boolean,
            requiresOsdJunior: Boolean,
            requiresOsdSenior: Boolean,
         },
      },
   },
   {
      timestamps: true,
   }
);

export default mongoose.model<IOrganization>(
   "Organization",
   organizationSchema
);