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

export enum PROGRAM_SAVED_STATUS {
  DRAFT = "draft",
  PUBLISHED = "published"
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

export enum ATTENDANCE_STATUS {
  PRESENT = "present",
  ABSENT = "absent",
}

//Organization

export enum ORGANIZATION_TYPE {
  CORPORATE = "corporate",
  TRAINING_PROVIDER = "training_provider",
  OSD_INTERNAL = "osd_internal"
}

export enum ORGANIZATION_STATUS {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum REVIEW_MODE {
  SINGLE = "single",
  JUNIOR_SENIOR = "junior_senior",
}

export enum ASSIGNMENT_MODE {
  POOL = "pool",
  LOCATION_BASED = "location_based",
};