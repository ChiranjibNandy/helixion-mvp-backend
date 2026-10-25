import mongoose from "mongoose";
import SettingsProfile from "../models/settingProfile.model.js";
import { ISettingsProfile } from "../interfaces/settings.interface.js";
import { SettingsProfileInput } from "../types/settings.js";


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

export const findSettingsProfilesByOwnerIdsRepo = async (
   ownerIds: string[],
): Promise<ISettingsProfile[]> => {
   return SettingsProfile.find({
      ownerId: { $in: ownerIds.map((id) => new mongoose.Types.ObjectId(id)) },
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
