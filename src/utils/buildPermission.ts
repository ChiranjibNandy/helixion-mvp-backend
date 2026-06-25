import { ROLE } from "../constants/enum.js";
import { IUserWithOrganization } from "../interfaces/user.interface.js";
import { getUsersByOrganizationId } from "../repositories/user.repository.js";

export const checkCanApproveEnrollment = async (
   organizationId: string,
   approverId: string,
   minLevelToApprove: number
): Promise<boolean> => {
   const users = await getUsersByOrganizationId(
      organizationId
   );

   return users.some((employee) =>
      employee.hierarchy?.managerChain?.some(
         (manager) =>
            manager.userId.toString() ===
            approverId &&
            manager.level >=
            minLevelToApprove
      )
   );
};

export const buildPermissions = async (
   user: IUserWithOrganization
) => {
   const organization =
      user.organizationId;

   if (!organization) {
      return {
         canEnroll: false,
         canApproveEnrollment: false,
         canRecommend: false,
         canReviewTrainingDept: false,
         canApproveTrainingDept: false,
         canReviewOsd: false,
         canApproveOsd: false,
      };
   }

   const userId = user._id.toString();

   const trainingDeptEntry =
      organization.policyAssignments.trainingDeptChain.find(
         (item) =>
            item.userId.toString() === userId
      );

   const osdEntry =
      organization.policyAssignments.osdChain.find(
         (item) =>
            item.userId.toString() === userId
      );

   const canApproveEnrollment =
      await checkCanApproveEnrollment(
         organization._id?.toString() ?? "",
         userId,
         organization.policy.managerApproval
            .minLevelToApprove
      );

   return {
      canEnroll:
         user.role === ROLE.EMPLOYEE,

      canApproveEnrollment,

      canRecommend:
         user.role === ROLE.EMPLOYEE,

      canReviewTrainingDept:
         !!trainingDeptEntry &&
         trainingDeptEntry.level <
         organization.policy
            .trainingDeptApproval
            .minLevelToApprove,

      canApproveTrainingDept:
         !!trainingDeptEntry &&
         trainingDeptEntry.level >=
         organization.policy
            .trainingDeptApproval
            .minLevelToApprove,

      canReviewOsd:
         !!osdEntry &&
         osdEntry.level <
         organization.policy.osdReview
            .minLevelToApprove,

      canApproveOsd:
         !!osdEntry &&
         osdEntry.level >=
         organization.policy.osdReview
            .minLevelToApprove,
   };
};