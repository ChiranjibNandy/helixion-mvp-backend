import { Types } from "mongoose";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { findOrgById } from "../repositories/organization.repository.js";
import {
   findSettingsProfileRepo,
   upsertSettingsProfileRepo,
} from "../repositories/settings.repository.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { SettingsProfileInput } from "../types/settings.js";
import { AppError } from "../utils/appError.js";
import { ProfileType } from "../constants/settings.js";


export const getSettingsProfileService = async (
   ownerId: string,
   orgRole: ProfileType
) => {
   const user = await getUserByIdRepo(ownerId)
   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }
   if (orgRole === ProfileType.TRAINING_PROVIDER) {
      const profile = await findSettingsProfileRepo(ownerId); 

      return {
         profileId: profile?._id,
         gstNumber: profile?.gstNumber,
         panNumber: profile?.panNumber,
         location: profile?.location,
         email: user.email,
      };
   }
   if (!user?.orgId) {
      throw new AppError(MESSAGES.USER_NOT_EXIST_ORG, HTTP_STATUS.CONFLICT)
   }
   const [profile, organization] = await Promise.all([
      findSettingsProfileRepo(String(user?.orgId)),
      findOrgById(user?.orgId)
   ])
   return {
      profileId: profile?._id,
      gstNumber: profile?.gstNumber,
      panNumber: profile?.panNumber,
      location: profile?.location,
      email: user.email,
      orgName: organization?.name,
      slug: organization?.slug,
      orgType: organization?.orgType
   };
};

export const updateSettingsProfileService = async (
   payload: SettingsProfileInput
) => {
   return upsertSettingsProfileRepo(payload);
};
