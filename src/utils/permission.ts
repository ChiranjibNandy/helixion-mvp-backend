import { ORG_ROLE, ROLE } from "../constants/enum.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { IUser } from "../interfaces/user.interface.js";
import { findOrganizationById, hasApproveOsd, hasApproveTrainingDept, hasReportingTrainingDept, hasReviewOsd } from "../repositories/organization.repository.js";
import { hasApproveEmployees, hasReportingEmployees } from "../repositories/user.repository.js";
import { AppError } from "./appError.js";

export const canEnroll = (user: IUser): boolean => {
   if(!user.orgRole) return false
   return user.orgRole === ORG_ROLE.EMPLOYEE;
};

export const canRecommend = async (user: IUser) => {
   if (!user.orgId) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }
   const exists = await hasReportingEmployees(
      user.orgId,
      user._id
   );

   return !!exists;
};

export const canEnrollmentApproval = async (user: IUser) => {
   if (!user.orgId) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }
   const organization = await findOrganizationById(user.orgId)
   if (!organization) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
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
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
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
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }

   const organization = await findOrganizationById(user.orgId);

   if (!organization) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
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

export const canReviewOsd = async (user: IUser) => {
   if (!user.orgId) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }

   const exists = await hasReviewOsd(
      user.orgId,
      user._id
   );

   return !!exists;
};

export const canApproveOsd = async (user: IUser) => {
   if (!user.orgId) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
   }

   const organization = await findOrganizationById(user.orgId);

   if (!organization) {
      throw new AppError(
         MESSAGES.ORG_NOT_FOUND,
         HTTP_STATUS.NOT_FOUND
      );
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
      canReviewOsdPermission,
      canApproveOsdPermission,
   ] = await Promise.all([
      canEnroll(user),
      canRecommend(user),
      canEnrollmentApproval(user),
      canReviewTrainingDept(user),
      canApproveTrainingDept(user),
      canReviewOsd(user),
      canApproveOsd(user),
   ]);

   return {
      canEnroll: canEnrollPermission,
      canRecommend: canRecommendPermission,
      canApproveEnrollment: canApproveEnrollmentPermission,
      canReviewTrainingDept: canReviewTrainingDeptPermission,
      canApproveTrainingDept: canApproveTrainingDeptPermission,
      canReviewOsd: canReviewOsdPermission,
      canApproveOsd: canApproveOsdPermission,
   };
};