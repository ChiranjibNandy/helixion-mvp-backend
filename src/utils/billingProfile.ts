import { IAddress } from "../interfaces/settings.interface.js";

export const getStateCodeFromGstin = (gstin?: string | null): string =>
   gstin && gstin.length >= 2 ? gstin.slice(0, 2) : "";

export const formatBillingAddress = (location?: IAddress): string | undefined => {
   if (!location) return undefined;
   return [location.addressLine1, location.addressLine2, location.city, location.state, location.postalCode]
      .filter(Boolean)
      .join(", ");
};
