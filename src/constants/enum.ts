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

export enum STAY_TYPE_KEY {
  SINGLE_OCCUPANCY = "single_occupancy",
  TWIN_SHARING     = "twin_sharing",
  NON_RESIDENTIAL  = "non_residential"
}


// program saved status

export enum PROGRAM_SAVED_STATUS{
  DRAFT = "draft",
  PUBLISHED = "published"
}


export enum APPROVAL_STATUS {
  APPROVED = "approved",
  DISMISSED = "dismissed",
  PENDING = "pending"
}

export enum ENROLLMENT_STATUS {
   ACTIVE = "active", //enrolled
   COMPLETED = "completed",
   CANCELLED = "cancelled",
   PENDING = "pending" //pending to approval
}

export enum USER_STATUS {
  ACTIVE = "active",
  DEACTIVE = "deactive"
}

export enum ATTENDANCE_STATUS {
   PRESENT = "present",
   ABSENT = "absent",
}

export enum ENROLLMENT_APPROVAL_STATUS {
  PENDING_APPROVAL = "pending_approval",
  APPROVED         = "approved",
  REJECTED         = "rejected",
  NOT_REQUIRED     = "not_required",
}

export enum ENROLLMENT_SOURCE {
  WEB    = "web",
  MOBILE = "mobile",
  API    = "api",
  ADMIN  = "admin",
}

export enum CURRENCY {
  INR = "INR",
}

export enum OrganizationType {
   CORPORATE = "corporate",
   TRAINING_PROVIDER = "training_provider",
   OSD_INTERNAL = "osd_internal",
}

export enum OrganizationStatus {
   ACTIVE = "active",
   INACTIVE = "inactive",
}

export enum AssignmentMode {
   ASSIGNED = "assigned",
   POOL = "pool",
}