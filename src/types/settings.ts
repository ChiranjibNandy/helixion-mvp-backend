import { ProfileType } from "../constants/settings.js";

export type AddressInput = {
   addressLine1: string;
   addressLine2?: string;
   city: string;
   state: string;
   postalCode: string;
};

export type SettingsProfileInput = {
   ownerId: string;
   profileType: ProfileType;
   gstNumber?: string;
   panNumber?: string;
   location?: AddressInput;
};