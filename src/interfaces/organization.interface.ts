import { Types } from "mongoose";
import { OrganizationStatus, OrganizationType } from "../constants/enum.js";
import { ApprovalPolicy } from "../types/organization.js";
import mongoose from "mongoose";

export interface IPolicyAssignment {
   userId: mongoose.Types.ObjectId;
   level: number;
}


export interface IOrganization {
   _id?: Types.ObjectId
   name: string;
   slug: string;
   orgType: OrganizationType;
   status: OrganizationStatus;

   policy: {
      managerApproval: ApprovalPolicy;
      trainingDeptApproval: ApprovalPolicy;
      osdReview: ApprovalPolicy;
      tourForm: ApprovalPolicy;
      reimbursement: ApprovalPolicy;
      tourApproval?: {
         managerApprovalRequired: boolean;
         osdApprovalRequired: boolean;
      };
      reimbursementApproval?: {
         managerApprovalRequired: boolean;
         osdApprovalRequired: boolean;
      };
   };
   policyAssignments: {
      trainingDeptChain: IPolicyAssignment[];
      osdChain: IPolicyAssignment[];
   };
   createdAt: Date;
   updatedAt: Date;
}