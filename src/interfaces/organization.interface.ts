import { ASSIGNMENT_MODE, ORGANIZATION_STATUS, ORGANIZATION_TYPE, REVIEW_MODE } from "../constants/enum.js";

export interface IOrganization {
  name: string;
  slug: string;
  orgType: ORGANIZATION_TYPE.CORPORATE | ORGANIZATION_TYPE.TRAINING_PROVIDER | ORGANIZATION_TYPE.OSD_INTERNAL;
  status: ORGANIZATION_STATUS.ACTIVE | ORGANIZATION_STATUS.INACTIVE;

  policy: {
    managerApproval: {
      enabled: boolean;
      levels: number;
      minLevelToApprove: number;
      allowRecommendOnlyAtLowerLevels: boolean;
    };

    trainingDeptApproval: {
      enabled: boolean;
      reviewMode: REVIEW_MODE.SINGLE | REVIEW_MODE.JUNIOR_SENIOR;
      juniorCanApprove: boolean;
      seniorCanApprove: boolean;
      assignmentMode: ASSIGNMENT_MODE.POOL | ASSIGNMENT_MODE.LOCATION_BASED;
    };

    osdReview: {
      enabled: boolean;
      reviewMode: REVIEW_MODE.SINGLE | REVIEW_MODE.JUNIOR_SENIOR;
      juniorCanApprove: boolean;
      seniorCanApprove: boolean;
      assignmentMode: ASSIGNMENT_MODE.POOL | ASSIGNMENT_MODE.LOCATION_BASED;
    };

    tourForm: {
      enabled: boolean;
      autoCreateOnEnrollment: boolean;
      approver: string;
    };

    reimbursement: {
      enabled: boolean;
      requiresOsdJunior: boolean;
      requiresOsdSenior: boolean;
    };
  };
}