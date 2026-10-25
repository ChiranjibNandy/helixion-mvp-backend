import { findSettingsProfileRepo } from "../repositories/settings.repository.js";
import { getStateCodeFromGstin, formatBillingAddress } from "./billingProfile.js";

export const getProviderBillingDetails = async (providerId: string, providerEmail?: string) => {
   const profile = await findSettingsProfileRepo(providerId);
   const gstin = String(profile?.gstNumber ?? "");

   return {
      gstin,
      pan: String(profile?.panNumber ?? ""),
      stateCode: getStateCodeFromGstin(gstin),
      stateName: profile?.location?.state ?? "",
      address: formatBillingAddress(profile?.location),
      email: providerEmail,
      phone: undefined as string | undefined,
   };
};
