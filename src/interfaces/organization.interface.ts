import { Types } from "mongoose";
import { OrganizationStatus, OrganizationType } from "../constants/enum.js";
import { ApprovalPolicy } from "../types/organization.js";

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

      tourForm: ApprovalPolicy,

      reimbursement: ApprovalPolicy
   };

   createdAt: Date;
   updatedAt: Date;
}