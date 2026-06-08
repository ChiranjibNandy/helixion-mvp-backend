import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { IOrganization } from "../interfaces/organization.interface.js";
import { createOrganizationRepo, findOrganizationByIdRepo, findOrganizationBySlugRepo, updateOrganizationPolicyRepo } from "../repositories/organization.repository.js";
import { AppError } from "../utils/appError.js";

export const createOrganizationService = async (
   payload: IOrganization
) => {
   const existing =
      await findOrganizationBySlugRepo(
         payload.slug
      );

   if (existing) {
      throw new AppError(MESSAGES.ORG_SLUG_ALREADY_EXIST, HTTP_STATUS.NOT_FOUND);
   }

   return createOrganizationRepo(
      payload
   );
};

export const updatePolicyService = async (
   organizationId: string,
   policy: Partial<IOrganization["policy"]>
) => {
   const organization =
      await findOrganizationByIdRepo(
         organizationId
      );

   if (!organization) {
      throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return updateOrganizationPolicyRepo(
      organizationId,
      policy
   );
};