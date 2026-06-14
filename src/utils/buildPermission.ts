import { OrganizationPolicy } from "../types/organization.js";

export const buildPermissions = (
  userScale: number,
  policy?: OrganizationPolicy
) => {
  const managerApproval = policy?.managerApproval;
  const trainingDeptApproval = policy?.trainingDeptApproval;
  const osdReview = policy?.osdReview;

  return {
    canEnroll: true,

    canRecommend: userScale >= 1,

    canApproveEnrollment:
      managerApproval?.enabled === true &&
      userScale >= managerApproval.minLevelToApprove,

    canReviewTrainingDept:
      trainingDeptApproval?.enabled === true &&
      userScale < trainingDeptApproval.minLevelToApprove,

    canApproveTrainingDept:
      trainingDeptApproval?.enabled === true &&
      userScale >= trainingDeptApproval.minLevelToApprove,

    canReviewOsd:
      osdReview?.enabled === true &&
      userScale < osdReview.minLevelToApprove,

    canApproveOsd:
      osdReview?.enabled === true &&
      userScale >= osdReview.minLevelToApprove,
  };
};