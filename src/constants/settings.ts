export enum ProfileType {
   CORPORATE_ADMIN = 'admin',
   TRADING_PARTNER = 'training_provider',
}

export const SETTINGS_VALIDATION = {
  GST_NUMBER_REGEX:
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  PAN_NUMBER_REGEX: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  GST_NUMBER_MAX_LENGTH: 15,
  PAN_NUMBER_MAX_LENGTH: 10,
} as const;

