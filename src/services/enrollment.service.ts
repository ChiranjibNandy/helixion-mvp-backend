import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getEnrollmentByUserIdInManagerChain } from "../repositories/enrollment.repository.js";
import { findOrganizationById } from "../repositories/organization.repository.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";

export const getRelevantEnrollmentService = async (managerId: string) => {
   const user = await getUserByIdRepo(managerId)
   if (!user?.orgId) {
      throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND)
   }
   //Get the organization
   const organization = await findOrganizationById(user.orgId);
   if (!organization) {
      throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND)
   }
   const minLevel =
      organization.policy.managerApproval.minLevelToApprove;
   // Fetch enrollments where the logged-in user is in the manager chain
   const enrollments = await getEnrollmentByUserIdInManagerChain(user)
   //Compute the permission
   const result = enrollments.map((enrollment) => {
      const manager = enrollment.managerChain.find(
         (m) => m.userId.equals(user._id)
      );

      return {
         ...enrollment.toObject(),
         approve: manager
            ? manager.level >= minLevel
            : false,
      };
   });
   return result
}