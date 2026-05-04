//role of users

export enum ROLE {
  ADMIN = "admin",
  EMPLOYEE = "employee",
  TRAINING_PROVIDER = "training-provider"
}

export enum STAY_TYPE {
  SINGLE = "single",
  TWIN = "twin"
}

// program saved status

export enum PROGRAM_SAVED_STATUS{
  DRAFT = "draft",
  PUBLISHED = "published"
}

//program status

export enum PROGRAM_STATUS {
   ACTIVE = "active",
   INACTIVE = "inactive"
}

export enum APPROVAL_STATUS {
  APPROVED = "approved",
  DISMISSED = "dismissed",
  PENDING = "pending"
}

export enum ENROLLMENT_STATUS {
   ACTIVE = "active",
   COMPLETED = "completed",
   CANCELLED = "cancelled",
   PENDING = "pending"
}

export enum USER_STATUS {
  ACTIVE = "active",
  DEACTIVE = "deactive"
}