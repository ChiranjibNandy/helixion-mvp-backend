import { Types } from "mongoose";
import { AssignmentMode, OrganizationStatus, OrganizationType } from "../constants/enum.js";

export interface ApprovalPolicy {
   enabled: boolean;
   levels: number;
   minLevelToApprove: number;
   assignmentMode: AssignmentMode;
}

export interface PolicyAssignment {
   userId: Types.ObjectId;
   level: number;
};

export interface OrganizationPolicy {
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
}

export type CreateOrganization = {
   name: string;
   slug: string;
   orgType: OrganizationType;
   status: OrganizationStatus;
   policy: OrganizationPolicy;
   policyAssignments?: {
      trainingDeptChain: PolicyAssignment[];
      osdChain: PolicyAssignment[];
   };
};

export interface UpdatePolicyParams {
   organizationId: string;
}