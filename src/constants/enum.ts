// ─── Org-level roles (top-level role of the user in their org) ───────────────
export enum ORG_ROLE {
  ADMIN             = "admin",
  EMPLOYEE          = "employee",
  TRAINING_PROVIDER = "training_provider",
}

/**
 * @deprecated Use ORG_ROLE instead. Kept for backward-compat during migration.
 */
export enum ROLE {
  ADMIN             = "admin",
  EMPLOYEE          = "employee",
  TRAINING_PROVIDER = "training-provider",
  MANAGER           = "manager",
}

// ─── Office role levels (1 = junior / 2 = senior) ────────────────────────────
export enum OFFICE_ROLE_LEVEL {
  JUNIOR = 1,
  SENIOR = 2,
}

// ─── Manager approval chain ───────────────────────────────────────────────────
export enum MANAGER_CHAIN_STATUS {
  PENDING  = "pending",
  WAITING  = "waiting",   // not yet their turn
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum MANAGER_ACTION {
  PENDING   = "pending",
  RECOMMEND = "recommend",
  APPROVE   = "approve",
  REJECT    = "reject",
}

// ─── Training dept actions ────────────────────────────────────────────────────
export enum TRAINING_DEPT_JUNIOR_ACTION {
  PENDING  = "pending",
  REVIEWED = "reviewed",
}

export enum TRAINING_DEPT_SENIOR_ACTION {
  WAITING  = "waiting",
  APPROVE  = "approve",
  REJECT   = "reject",
}

// ─── OSD actions ──────────────────────────────────────────────────────────────
export enum OSD_JUNIOR_ACTION {
  PENDING   = "pending",
  RETURN    = "return",
  RECOMMEND = "recommend",
}

export enum OSD_SENIOR_ACTION {
  WAITING = "waiting",
  APPROVE = "approve",
  REJECT  = "reject",
}

// ─── Actor types (for timeline entries) ──────────────────────────────────────
export enum ACTOR_TYPE {
  EMPLOYEE      = "employee",
  MANAGER       = "manager",
  TRAINING_DEPT = "training_dept",
  OSD           = "osd",
  PROVIDER      = "provider",
  SYSTEM        = "system",
}

// ─── Stay types ───────────────────────────────────────────────────────────────
export enum STAY_TYPE {
  SINGLE_OCCUPANCY = "single_occupancy",
  TWIN_SHARING     = "twin_sharing",
  NON_RESIDENTIAL  = "non_residential",
}

/**
 * @deprecated Use STAY_TYPE. Kept for backward-compat during migration.
 */
export enum STAY_TYPE_LEGACY {
  SINGLE  = "single",
  TWIN    = "twin",
  NON_RES = "non-res",
}

// ─── Program ──────────────────────────────────────────────────────────────────
export enum PROGRAM_SAVED_STATUS {
  DRAFT     = "draft",
  PUBLISHED = "published",
  COMPLETED = "completed",
}

// ─── User status ──────────────────────────────────────────────────────────────
export enum USER_STATUS {
  ACTIVE   = "active",
  INACTIVE = "inactive",
  /**
   * @deprecated Use INACTIVE. Kept for backward-compat during migration.
   */
  DEACTIVE = "deactive",
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export enum ATTENDANCE_STATUS {
  PRESENT = "present",
  ABSENT  = "absent",
}

// ─── Enrollment lifecycle stage ───────────────────────────────────────────────
export enum ENROLLMENT_STAGE {
  SUBMITTED              = "submitted",
  MANAGER_REVIEW         = "manager_review",
  TRAINING_DEPT_REVIEW   = "training_dept_review",
  APPROVED               = "approved",
  REJECTED               = "rejected",
  ATTENDANCE_PENDING     = "attendance_pending",
  ATTENDED               = "attended",
  REIMBURSEMENT_SUBMITTED = "reimbursement_submitted",
  OSD_JUNIOR_REVIEW      = "osd_junior_review",
  OSD_SENIOR_REVIEW      = "osd_senior_review",
  REIMBURSEMENT_APPROVED = "reimbursement_approved",
  COMPLETED              = "completed",
}

// ─── Status summaries ─────────────────────────────────────────────────────────
export enum ENROLLMENT_STATUS_SUMMARY {
  SUBMITTED    = "submitted",
  RECOMMENDED  = "recommended",
  APPROVED     = "approved",
  REJECTED     = "rejected",
}

export enum TRAVEL_TYPE {
  LOCAL            = "local",
  SELF_TRAVEL      = "self_travel",
  COMPANY_ASSISTED = "company_assisted",
}

export enum TOUR_OSD_ACTION {
  WAITING = "waiting",
  APPROVE = "approve",
  REJECT  = "reject",
}

export enum TOUR_STATUS {
  NOT_REQUIRED            = "not_required",
  PENDING_EMPLOYEE_CHOICE = "pending_employee_choice",
  SUBMITTED               = "submitted",
  MANAGER_APPROVED        = "manager_approved",
  MANAGER_REJECTED        = "manager_rejected",
  OSD_APPROVED            = "osd_approved",
  OSD_REJECTED            = "osd_rejected",
  OSD_TIMEOUT             = "osd_timeout",
  APPROVED                = "approved",
  REJECTED                = "rejected",
}

export enum ATTENDANCE_RECORD_STATUS {
  PENDING  = "pending",
  ATTENDED = "attended",
  ABSENT   = "absent",
}

export enum REIMBURSEMENT_STATUS {
  NOT_STARTED = "not_started",
  SUBMITTED   = "submitted",
  RETURNED    = "returned",
  RECOMMENDED = "recommended",
  APPROVED    = "approved",
  REJECTED    = "rejected",
}

// ─── Legacy enums (kept for backward-compat during migration) ─────────────────
/**
 * @deprecated Use stage-specific action enums (MANAGER_ACTION, OSD_JUNIOR_ACTION, etc.)
 */
export enum APPROVAL_STATUS {
  APPROVED  = "approved",
  DISMISSED = "dismissed",
  PENDING   = "pending",
}

/**
 * @deprecated Use ENROLLMENT_STAGE as the single source of truth for stage.
 */
export enum ENROLLMENT_STATUS {
  ACTIVE    = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  PENDING   = "pending",
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

export enum REVIEW_MODE {
  JUNIOR_SENIOR = "junior_senior",
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