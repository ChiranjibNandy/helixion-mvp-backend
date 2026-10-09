import mongoose, { Schema } from "mongoose";
import { ISettingsProfile } from "../interfaces/settings.interface.js";
import { ProfileType, SETTINGS_VALIDATION } from "../constants/settings.js";
import { MESSAGES } from "../constants/messages.js";

const SettingsProfileSchema = new Schema<ISettingsProfile>(
   {
      ownerId: {
         type: Schema.Types.ObjectId,
         ref: "User",
         required: [true, MESSAGES.OWNER_ID_REQUIRED],
         index: true,
      },
      profileType: {
         type: String,
         enum: {
            values: Object.values(ProfileType),
            message: MESSAGES.INVALID_PROFILE_TYPE,
         },
         required: [true, MESSAGES.PROFILE_TYPE_REQUIRED],
         index: true
      },
      gstNumber: {
         type: String,
         trim: true,
         uppercase: true,
         minlength: SETTINGS_VALIDATION.GST_NUMBER_MAX_LENGTH,
         maxlength: SETTINGS_VALIDATION.GST_NUMBER_MAX_LENGTH,
         match: [
            SETTINGS_VALIDATION.GST_NUMBER_REGEX,
            MESSAGES.GST_NUMBER_INVALID,
         ],
      },
      panNumber: {
         type: String,
         trim: true,
         uppercase: true,
         minlength: SETTINGS_VALIDATION.PAN_NUMBER_MAX_LENGTH,
         maxlength: SETTINGS_VALIDATION.PAN_NUMBER_MAX_LENGTH,
         match: [
            SETTINGS_VALIDATION.PAN_NUMBER_REGEX,
            MESSAGES.PAN_NUMBER_INVALID,
         ],
      },
   },
   {
      timestamps: true
   }
);

const SettingsProfile = mongoose.model<ISettingsProfile>(
  "Settings",
  SettingsProfileSchema
);

export default SettingsProfile;