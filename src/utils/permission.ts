import { ORG_ROLE } from "../constants/enum.js";
import { IUser } from "../interfaces/user.interface.js";
import { findOrgById } from "../repositories/organization.repository.js";
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
      organization.policy.managerApproval.minLevelToApprove
   )
   return !!exists
};

// Reads officeRoles directly off the user — the same field bulk upload sets
// and the same field the actual route gate (authorizeOfficeRole) checks.
// Previously this checked organization.policyAssignments.trainingDeptChain, a
// separate manually-curated list set at org creation that bulk upload never
// updates — so a bulk-uploaded CTD/junior officer could call the API
// successfully but the frontend nav item stayed hidden, since it's gated on
// this permission flag. See authorizeOfficeRole in authorizeRole.middleware.ts.
export const canReviewTrainingDept = async (user: IUser) => {
   return !!user.officeRoles?.trainingDept?.enabled;
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

   if (!policy?.enabled) {
      return false;
   }

   const officer = user.officeRoles?.trainingDept;
   return !!(officer?.enabled && officer.level != null && officer.level >= policy.minLevelToApprove);
};

// Tour approval (CTD's final approval on the tour leg) is governed by
// org.policy.tourApproval.ctdApprovalRequired, NOT trainingDeptApproval.enabled
// (that gates the separate main-enrollment CTD approval step). Deliberately
// does not check trainingDeptApproval.enabled — an officer must not lose
// tour-approval access just because the org has disabled the unrelated
// main-approval step. Level 2 matches the PATCH tour-action route's
// authorizeOfficeRole("trainingDept", 2) gate.
export const canApproveTourCtd = async (user: IUser) => {
   const officer = user.officeRoles?.trainingDept;
   return !!(officer?.enabled && officer.level != null && officer.level >= 2);
};

export const canReviewOsd = async (user: IUser) => {
   return !!user.officeRoles?.osd?.enabled;
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

   if (!policy?.enabled) {
      return false;
   }

   const officer = user.officeRoles?.osd;
   return !!(officer?.enabled && officer.level != null && officer.level >= policy.minLevelToApprove);
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