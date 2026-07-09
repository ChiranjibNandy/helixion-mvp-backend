import { getUserByIdRepo } from "../repositories/user.repository.js";
import { findProgramById } from "../repositories/program.repository.js";
import { REIMBURSEMENT_ACTION, TIMELINE_ACTION } from "../constants/enum.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers for ticket 0033 (employee notifications). Kept in one place
// so the "is this training local or outstation" decision — which drives both
// which email template gets sent (write-time, in trainingDept.service.ts) and
// how the in-app notification is worded (read-time, in employee.service.ts)
// — can never silently diverge between the two call sites.
// ─────────────────────────────────────────────────────────────────────────────

// Case/whitespace-insensitive equality only — this does NOT resolve city
// aliases or naming variants (e.g. "Bangalore" vs "Bengaluru", "Mumbai" vs
// "Mumbai City"). Fixing that would require a canonical location/city-mapping
// system, which doesn't exist in this codebase; until one does, placeOfPosting
// and program.city must be entered consistently for this comparison to be
// accurate.
export const isLocalTraining = (
   placeOfPosting?: string | null,
   city?: string | null
): boolean => {
   if (!placeOfPosting || !city) return false;
   const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
   return normalize(placeOfPosting) === normalize(city);
};

const DEFAULT_PROGRAM_TITLE = "your training program";

// Single source of truth for the "untitled program" fallback — used both
// here and by the read-time notification derivation in employee.service.ts,
// so the two can't drift to different fallback text.
export const resolveProgramTitle = (program?: { title?: string } | null): string =>
   program?.title ?? DEFAULT_PROGRAM_TITLE;

// Every workflow-transition notification email needs the same two lookups
// (the employee to mail, the program to name) with the same "untitled
// program" fallback. Centralized so each service doesn't repeat the
// Promise.all + fallback boilerplate.
export const loadNotificationContext = async (
   employeeId: string,
   programId: string
) => {
   const [employee, program] = await Promise.all([
      getUserByIdRepo(employeeId),
      findProgramById(programId),
   ]);

   return {
      employee,
      program,
      programTitle: resolveProgramTitle(program),
   };
};

// All notification emails are fire-and-forget (never block the workflow
// response on an SMTP round-trip); failures are logged, not surfaced. This
// gives every call site the same log format instead of a hand-rolled
// `.catch(err => console.error(...))` each time.
export const logMailFailure = (label: string) => (err: unknown) => {
   console.error(`[notifications] ${label} mail failed:`, err);
};

// A manager/OSD rejecting a REIMBURSEMENT claim and a manager/OSD acting on
// an ENROLLMENT both write actorType MANAGER/OSD to the timeline — reusing
// the bare REIMBURSEMENT_ACTION value would make them indistinguishable to
// employee.service.ts's NOTIFICATION_RULES (this collided once already; see
// the fix in manager.service.ts/osd.service.ts). Single source for both
// reimbursement gates so the mapping can't drift between the two call sites.
export const reimbursementTimelineAction = (
   actor: "manager" | "osd",
   action: REIMBURSEMENT_ACTION
): TIMELINE_ACTION => {
   const reject = action === REIMBURSEMENT_ACTION.REJECT;
   return actor === "manager"
      ? (reject ? TIMELINE_ACTION.REIMBURSEMENT_MANAGER_REJECT : TIMELINE_ACTION.REIMBURSEMENT_MANAGER_APPROVE)
      : (reject ? TIMELINE_ACTION.REIMBURSEMENT_OSD_REJECT : TIMELINE_ACTION.REIMBURSEMENT_OSD_APPROVE);
};
