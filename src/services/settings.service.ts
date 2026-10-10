import {
   findSettingsProfileRepo,
   upsertSettingsProfileRepo,
} from "../repositories/settings.repository.js";
import { SettingsProfileInput } from "../types/settings.js";
import { ORG_ROLE } from "../constants/enum.js";


export const getSettingsProfileService = async (
   ownerId: string,
) => {
   const profile = await findSettingsProfileRepo(
      ownerId
   );

   return profile;
};

export const updateSettingsProfileService = async (
   payload: SettingsProfileInput
) => {
   return upsertSettingsProfileRepo(payload);
};
