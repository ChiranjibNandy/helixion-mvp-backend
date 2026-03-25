export const MESSAGES = {
  PASSWORDS_DO_NOT_MATCH: "Passwords do not match",
  USER_ALREADY_EXISTS: "User already exists",
  USER_CREATED_SUCCESSFULLY: "User created successfully",
  USER_NOT_FOUND: "User not found",
  INVALID_CREDENTIALS: "Invalid username or password",
  USER_NO_PERMISSION: "You do not have permission to perform this action",
  USER_LOGGED_IN_SUCCESSFULLY: "User logged in successfully",
  INTERNAL_SERVER_ERROR: "Internal server error",
  VALIDATION_FAILED: "Validation failed",
  USERNAME_REQUIRED: "Username is required",
  PASSWORD_REQUIRED: "Password is required",
  PASSWORD_MIN_LENGTH: "Password must be at least 6 characters",
  PASSWORD_COMPLEXITY: "Password must contain at least one letter, one number, and one special character",
  EMAIL_REQUIRED: "Email is required",
  INVALID_EMAIL_FORMAT: "Email must be a valid format",
  USER_APPROVED_SUCCESSFULLY: "User approved successfully",

  PAGE_MUST_BE_A_VALID_NUMBER: "Page must be a valid number",
  PAGE_MUST_BE_GREATER_THAN_ZERO: "Page must be greater than 0",
  LIMIT_MUST_BE_A_VALID_NUMBER: "Limit must be a valid number",
  LIMIT_MUST_BE_GREATER_THAN_ZERO: "Limit must be greater than 0",
  LIMIT_CANNOT_EXCEED_100: "Limit cannot exceed 100",

  PENDING_REGISTRATIONS_FETCHED: "Pending user registrations fetched successfully",

  TOKEN_REQUIRED: "Access token is required",
  INVALID_TOKEN: "Invalid token",
  INVALID_OR_EXPIRED_TOKEN: "Invalid or expired token",
  ADMIN_ACCESS_REQUIRED: "Admin access required",
  USER_ID_REQUIRED: "User Id is required",
  ROLE_REQUIRED:"Role is required"
} as const;