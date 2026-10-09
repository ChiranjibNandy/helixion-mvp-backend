import { ProfileType } from "../constants/settings.js";

export type SettingsProfileInput = {
   ownerId: string;
   profileType: ProfileType;
   gstNumber?: string;
   panNumber?: string;
};