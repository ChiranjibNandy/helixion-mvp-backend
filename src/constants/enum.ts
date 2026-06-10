//role of users

export enum ROLE {
  ADMIN = "admin",
  EMPLOYEE = "employee",
  TRAINING_PROVIDER = "training-provider"
}

export enum STAY_TYPE {
  SINGLE = "single",
  TWIN = "twin",
  SINGLE_OCCUPANCY = "single_occupancy",
  TWIN_SHARING = "twin_sharing",
  NON_RESIDENTIAL = "non_residential",
  NON_RES = "non-res"
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

export enum ENROLLMENT_STAGE {
  SUBMITTED = "submitted",
  MANAGER_REVIEW = "manager_review",
  TRAINING_DEPT_REVIEW = "training_dept_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  ATTENDED = "attended",
  REIMBURSEMENT_SUBMITTED = "reimbursement_submitted",
  OSD_JUNIOR_REVIEW = "osd_junior_review",
  OSD_SENIOR_REVIEW = "osd_senior_review",
  REIMBURSEMENT_APPROVED = "reimbursement_approved",
  COMPLETED = "completed"
}

export enum REVIEW_MODE {
  JUNIOR_SENIOR = "junior_senior"
}

export enum TOUR_STATUS {
  SUBMITTED = "submitted",
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected"
}

export enum REIMBURSEMENT_STATUS {
  NOT_STARTED = "not_started",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected"
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