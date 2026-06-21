import { AssignmentMode, OrganizationStatus, OrganizationType } from "../constants/enum.js";

export interface ApprovalPolicy {
   enabled: boolean;
   levels: number;
   minLevelToApprove: number;
   assignmentMode: AssignmentMode;
}

export interface OrganizationPolicy {
   managerApproval: ApprovalPolicy;
   trainingDeptApproval: ApprovalPolicy;
   osdReview: ApprovalPolicy;
   tourForm: ApprovalPolicy
   reimbursement: ApprovalPolicy
}

export interface CreateOrganization {
   name: string;
   slug: string;
   orgType: OrganizationType;
   status: OrganizationStatus;
   policy: OrganizationPolicy;
}

export interface UpdatePolicyParams {
   organizationId: string;
}