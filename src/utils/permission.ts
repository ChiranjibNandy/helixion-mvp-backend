import { ORG_ROLE } from "../constants/enum.js";
import { IUser } from "../interfaces/user.interface.js";
import { findOrgById, hasApproveOsd, hasApproveTrainingDept, hasReportingTrainingDept, hasReviewOsd } from "../repositories/organization.repository.js";
import { hasApproveEmployees, hasReportingEmployees } from "../repositories/user.repository.js";

export const canEnroll = (user: IUser): boolean => {
   if(!user.orgRole) return false
   return user.orgRole === ORG_ROLE.EMPLOYEE;
};

export const canRecommend = async (user: IUser) => {
   if (!user.orgId) {
     return false
   }
   const exists = await hasReportingEmployees(
      user.orgId,
      user._id
   );

   return !!exists;
};

export const canEnrollmentApproval = async (user: IUser) => {
   if (!user.orgId) {
      return false
   }
   const organization = await findOrgById(user.orgId)
   if (!organization) {
      return false
   }
   const exists = await hasApproveEmployees(
      user.orgId,
      user._id,
      organization?.policy.managerApproval.minLevelToApprove
   )
   return !!exists
};

export const canReviewTrainingDept = async (user: IUser) => {
   if (!user.orgId) {
      return false
   }
   const exists = await hasReportingTrainingDept(
      user.orgId,
      user._id
   );

   return !!exists;
};

export const canApproveTrainingDept = async (
   user: IUser
) => {
   if (!user.orgId) {
      return false
   }

   const organization = await findOrgById(user.orgId);

   if (!organization) {
      return false
   }

   const policy = organization.policy.trainingDeptApproval;

   if (!policy.enabled) {
      return false;
   }

   return !!await hasApproveTrainingDept(
      user.orgId,
      user._id,
      policy.minLevelToApprove
   );
};

// Tour approval (CTD's final approval on the tour leg) is governed by
// org.policy.tourApproval.ctdApprovalRequired, NOT trainingDeptApproval.enabled
// (that gates the separate main-enrollment CTD approval step). Deliberately
// does not check trainingDeptApproval.enabled — an officer must not lose
// tour-approval access just because the org has disabled the unrelated
// main-approval step. Level 2 matches the PATCH tour-action route's
// authorizeOfficeRole("trainingDept", 2) gate.
export const canApproveTourCtd = async (user: IUser) => {
   if (!user.orgId) {
      return false
   }

   return !!await hasApproveTrainingDept(
      user.orgId,
      user._id,
      2
   );
};

export const canReviewOsd = async (user: IUser) => {
   if (!user.orgId) {
      return false
   }

   const exists = await hasReviewOsd(
      user.orgId,
      user._id
   );

   return !!exists;
};

export const canApproveOsd = async (user: IUser) => {
   if (!user.orgId) {
      return false
   }

   const organization = await findOrgById(user.orgId);

   if (!organization) {
      return false
   }

   const policy = organization.policy.osdReview;

   if (!policy.enabled) {
      return false;
   }

   const exists = await hasApproveOsd(
      user.orgId,
      user._id,
      policy.minLevelToApprove
   );

   return !!exists;
};

export const buildPermission = async (user: IUser) => {
   const [
      canEnrollPermission,
      canRecommendPermission,
      canApproveEnrollmentPermission,
      canReviewTrainingDeptPermission,
      canApproveTrainingDeptPermission,
      canApproveTourCtdPermission,
      canReviewOsdPermission,
      canApproveOsdPermission,
   ] = await Promise.all([
      canEnroll(user),
      canRecommend(user),
      canEnrollmentApproval(user),
      canReviewTrainingDept(user),
      canApproveTrainingDept(user),
      canApproveTourCtd(user),
      canReviewOsd(user),
      canApproveOsd(user),
   ]);

   return {
      canEnroll: canEnrollPermission,
      canRecommend: canRecommendPermission,
      canApproveEnrollment: canApproveEnrollmentPermission,
      canReviewTrainingDept: canReviewTrainingDeptPermission,
      canApproveTrainingDept: canApproveTrainingDeptPermission,
      canApproveTourCtd: canApproveTourCtdPermission,
      canReviewOsd: canReviewOsdPermission,
      canApproveOsd: canApproveOsdPermission,
   };
};