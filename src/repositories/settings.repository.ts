import mongoose from "mongoose";
import SettingsProfile from "../models/settingProfile.model.js";
import { ISettingsProfile } from "../interfaces/settings.interface.js";
import { SettingsProfileInput } from "../types/settings.js";
import { ProfileType } from "../constants/settings.js";
import { ORG_ROLE } from "../constants/enum.js";



/**
 * Get settings profile for an owner and profile type.
 */
export const findSettingsProfileRepo = async (
   ownerId: string,
): Promise<ISettingsProfile | null> => {
   return SettingsProfile.findOne({
      ownerId: new mongoose.Types.ObjectId(ownerId),
   }).exec();
};

/**
 * Create a settings profile if it does not exist,
 * otherwise update the existing profile.
 */
export const upsertSettingsProfileRepo = async (
   payload: SettingsProfileInput
): Promise<ISettingsProfile> => {
   const { ownerId, profileType, ...profileData } = payload;

   const settingsProfile = await SettingsProfile.findOneAndUpdate(
      {
         ownerId: new mongoose.Types.ObjectId(ownerId),
         profileType,
      },
      {
         $set: profileData,
         $setOnInsert: {
            ownerId: new mongoose.Types.ObjectId(ownerId),
            profileType,
         },
      },
      {
         new: true,
         upsert: true,
         runValidators: true,
         setDefaultsOnInsert: true,
      }
   ).exec();

   return settingsProfile;
};
