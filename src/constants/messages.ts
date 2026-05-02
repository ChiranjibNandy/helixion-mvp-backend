export const MESSAGES = {
  PASSWORDS_DO_NOT_MATCH: "Passwords do not match",
  USER_ALREADY_EXISTS: "User already exists",
  USER_CREATED_SUCCESSFULLY: "User created successfully",
  USER_NOT_FOUND: "User not found",
  INVALID_CREDENTIALS: "Invalid Credential",
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
  NOT_APPROVED: "Your ID is awaiting role assignment and approval by Administrator",

  PAGE_MUST_BE_A_VALID_NUMBER: "Page must be a valid number",
  PAGE_MUST_BE_GREATER_THAN_ZERO: "Page must be greater than 0",
  LIMIT_MUST_BE_A_VALID_NUMBER: "Limit must be a valid number",
  LIMIT_MUST_BE_GREATER_THAN_ZERO: "Limit must be greater than 0",
  LIMIT_CANNOT_EXCEED_100: "Limit cannot exceed 100",

  PENDING_REGISTRATIONS_FETCHED: "Pending user registrations fetched successfully",

  TOKEN_REQUIRED: "Access token is required",
  INVALID_TOKEN: "Invalid token",
  INVALID_OR_EXPIRED_TOKEN: "Invalid or expired token",
  ACCESS_DENIED: "Access denied",
  USER_ID_REQUIRED: "User Id is required",
  ROLE_REQUIRED: "Role is required",

  ACTIVE_ENROLL_AND_AVAILABLE_PROGRAM: "Active enrollments and available programs fetched successfully",

  USER_DEACTIVATED_SUCCESSFULLY: "User deactivated successfully",
  USER_ALREADY_DEACTIVATED: "User is already deactivated",
  CANNOT_DEACTIVATE_SELF: "Cannot deactivate your own account",

  BATCH_USERS_CREATED: "Bulk users created successfully",
  DUPLICATE_EMAILS_IN_BATCH: "Duplicate emails found in the batch",
  USERS_ALREADY_EXIST: "Some users already exist",

  USERS_FETCHED: "users fetched successfully",
  RESET_LINK_SENT: "Password reset link sent successfully",
  PASSWORD_UPDATED: "Password updated successfully",
  SEARCH_CANNOT_EXCEED_50_CHARACTERS: "Search cannot exceed 50 characters",

  RATE_LIMIT : "Too many reset attempts, try later"
} as const;