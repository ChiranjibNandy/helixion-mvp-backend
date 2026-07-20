import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getAttendanceByProgramIdRepo, updateParticipantAttendanceRepository, upsertAttendanceRepo } from "../repositories/attendance.repository.js";
import { assertProgramOwnershipService } from "./program.service.js";
import { findProgramById } from "../repositories/program.repository.js";
import { getUsersByIdsRepo } from "../repositories/user.repository.js";
import { syncEnrollmentAttendanceRepo, bulkSyncEnrollmentAttendanceRepo, findEligibleAttendanceEmployeeIdsRepo } from "../repositories/enrollment.repository.js";
import { TakeAttendancePayload, UpdateParticipantAttendancePayload } from "../types/attendance.js";
import { AppError } from "../utils/appError.js";
import { validateParticipantsEnrollmentService } from "../validators/attendance.validator.js";
import { ACTOR_TYPE, ATTENDANCE_RECORD_STATUS, ATTENDANCE_STATUS, ENROLLMENT_STAGE, TIMELINE_ACTION } from "../constants/enum.js";
import { sendAttendanceAbsentMail, sendAttendancePresentMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure, resolveProgramTitle } from "../utils/notification.util.js";
import { IUser } from "../interfaces/user.interface.js";

// Enrollment stages at or past which a (re-)mark of attendance must not
// clobber forward progress (e.g. TP re-marking attendance after the
// reimbursement claim has already been submitted/reviewed).
const ATTENDANCE_LOCKED_STAGES: ENROLLMENT_STAGE[] = [
   ENROLLMENT_STAGE.ABSENT,
   ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
   ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW,
   ENROLLMENT_STAGE.COMPLETED,
   ENROLLMENT_STAGE.REJECTED,
];

// The frontend used to hide any program whose endDate hadn't passed yet from
// the "Update Attendance" list — that filter was removed (it was also hiding
// genuinely in-progress programs), but nothing replaced the one invariant it
// incidentally enforced: attendance shouldn't be marked before a program has
// even started. Only guards against startDate, not endDate, so marking
// attendance while a program is in progress or already finished is fine.
const assertProgramHasStarted = (program: { startDate?: Date | string | null }) => {
   if (program.startDate && new Date(program.startDate) > new Date()) {
      throw new AppError(
         "Attendance cannot be marked before the program has started.",
         HTTP_STATUS.BAD_REQUEST
      );
   }
};

const presentUpdate = (now: Date) => ({
   "attendance.uploadedByProvider":  true,
   "attendance.uploadedAt":          now,
   "attendance.status":              ATTENDANCE_RECORD_STATUS.ATTENDED,
   "statusSummary.attendanceStatus": ATTENDANCE_RECORD_STATUS.ATTENDED,
   "reimbursement.enabled":          true,
   currentStage:                     ENROLLMENT_STAGE.ATTENDED,
});

const absentUpdate = (now: Date) => ({
   "attendance.uploadedByProvider":  true,
   "attendance.uploadedAt":          now,
   "attendance.status":              ATTENDANCE_RECORD_STATUS.ABSENT,
   "statusSummary.attendanceStatus": ATTENDANCE_RECORD_STATUS.ABSENT,
   currentStage:                     ENROLLMENT_STAGE.ABSENT,
});

// System-actor timeline entries so the notification-derivation logic (ticket
// 0033) has something to read for attendance transitions — provider-uploaded
// attendance isn't attributable to a specific human actor, hence SYSTEM.
const presentTimelineEntry = (now: Date) => ({
   stage:     ENROLLMENT_STAGE.ATTENDED,
   actorType: ACTOR_TYPE.SYSTEM,
   action:    TIMELINE_ACTION.ATTENDANCE_PRESENT,
   note:      "",
   at:        now,
});

const absentTimelineEntry = (now: Date) => ({
   stage:     ENROLLMENT_STAGE.ABSENT,
   actorType: ACTOR_TYPE.SYSTEM,
   action:    TIMELINE_ACTION.ATTENDANCE_ABSENT,
   note:      "",
   at:        now,
});

// Fire-and-forget attendance-notification email — never blocks the caller,
// failures are logged rather than surfaced (matches the pattern used for
// other workflow-transition emails in manager/trainingDept/osd services).
// Takes an already-resolved employee + programTitle (rather than IDs) so
// bulk callers can fetch the program (and, in the bulk path, every
// participant) once for the whole roster instead of once per participant.
const dispatchAttendanceMail = (
   employee: IUser | null,
   programTitle: string,
   present: boolean
) => {
   if (!employee) return Promise.resolve();
   return present
      ? sendAttendancePresentMail(employee.email, employee.name, programTitle)
      : sendAttendanceAbsentMail(employee.email, employee.name, programTitle);
};

// Marking attendance Present unlocks reimbursement (reimbursement.enabled);
// marking Absent ends the workflow. Single atomic update (in the repository
// layer) — no read-modify-write race. No-op (0 matched) if no matching
// non-terminal enrollment exists (e.g. the participant isn't enrolled, or
// the enrollment already advanced past the point where attendance should
// still drive it) — in that case nothing was actually synced, so no
// notification email is sent either (there'd be nothing for the bell to
// show, since no timeline entry was pushed).
export const syncEnrollmentOnAttendanceService = async (
   programId: string,
   participantId: string,
   present_status: string
) => {
   const now = new Date();
   const present = present_status === ATTENDANCE_STATUS.PRESENT;
   const result = await syncEnrollmentAttendanceRepo(
      programId,
      participantId,
      ATTENDANCE_LOCKED_STAGES,
      present ? presentUpdate(now) : absentUpdate(now),
      present ? presentTimelineEntry(now) : absentTimelineEntry(now)
   );

   if (!result || result.matchedCount === 0) return;

   loadNotificationContext(participantId, programId)
      .then(({ employee, programTitle }) => dispatchAttendanceMail(employee, programTitle, present))
      .catch(logMailFailure("attendance"));
};

// Bulk variant for takeAttendanceService — batches the whole roster into at
// most two updateMany calls (present group, absent group) instead of one
// round trip per participant, so a 500-person roster costs 2 writes instead
// of 500. Best-effort: the attendance roster itself is already persisted
// (the source of truth) by the time this runs, so a sync failure here is
// logged rather than surfaced as a failure of an otherwise-successful
// attendance save — and one bad group doesn't block the other.
export const syncEnrollmentsOnAttendanceService = async (
   programId: string,
   participants: { participantId: string; present_status: string }[],
   // Callers that already have the program in hand (e.g. takeAttendanceService,
   // which fetches it for the attendance-save title) can pass its title
   // through here so the whole roster shares one lookup instead of each
   // participant's notification email re-fetching the same document.
   knownProgramTitle?: string
) => {
   const now = new Date();
   const presentIds: string[] = [];
   const absentIds: string[] = [];

   for (const participant of participants) {
      if (participant.present_status === ATTENDANCE_STATUS.PRESENT) {
         presentIds.push(participant.participantId);
      } else {
         absentIds.push(participant.participantId);
      }
   }

   // updateMany only reports an aggregate matchedCount, not which specific
   // ids matched — so eligibility (same filter the writes below use) is
   // checked BEFORE the writes to know exactly which participants' syncs
   // will actually take effect. Anyone not in this set (e.g. their
   // enrollment is already in a locked stage) gets no timeline entry from
   // the write below, so they must not get a "you've been marked
   // Present/Absent" email either.
   const eligibleIds = new Set(
      await findEligibleAttendanceEmployeeIdsRepo(programId, [...presentIds, ...absentIds], ATTENDANCE_LOCKED_STAGES)
   );
   const eligiblePresentIds = presentIds.filter((id) => eligibleIds.has(id));
   const eligibleAbsentIds = absentIds.filter((id) => eligibleIds.has(id));

   const results = await Promise.allSettled([
      bulkSyncEnrollmentAttendanceRepo(programId, presentIds, ATTENDANCE_LOCKED_STAGES, presentUpdate(now), presentTimelineEntry(now)),
      bulkSyncEnrollmentAttendanceRepo(programId, absentIds, ATTENDANCE_LOCKED_STAGES, absentUpdate(now), absentTimelineEntry(now)),
   ]);
   for (const result of results) {
      if (result.status === "rejected") {
         console.error("[attendance] enrollment sync failed:", result.reason);
      }
   }

   if (eligiblePresentIds.length === 0 && eligibleAbsentIds.length === 0) return;

   Promise.all([
      knownProgramTitle ? knownProgramTitle : findProgramById(programId).then(resolveProgramTitle),
      getUsersByIdsRepo([...eligiblePresentIds, ...eligibleAbsentIds]),
   ])
      .then(([programTitle, employees]) => {
         const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
         eligiblePresentIds.forEach((id) => {
            dispatchAttendanceMail(employeeById.get(id) ?? null, programTitle, true).catch(logMailFailure("attendance"));
         });
         eligibleAbsentIds.forEach((id) => {
            dispatchAttendanceMail(employeeById.get(id) ?? null, programTitle, false).catch(logMailFailure("attendance"));
         });
      })
      .catch(logMailFailure("attendance"));
};

export const takeAttendanceService = async (
   payload: TakeAttendancePayload
) => {
   // Ownership check (ticket 0032): only the TP who created this program
   // may take attendance for it. Also gets programData.title in one call.
   const programData = await assertProgramOwnershipService(
      payload.programId,
      payload.training_providerId
   );
   assertProgramHasStarted(programData);

   const participantIds = payload.participants.map(
      (participant) => participant.participantId
   );

   // validate participants (also enforces the CTD-approval visibility gate)
   await validateParticipantsEnrollmentService(
      payload.programId,
      participantIds
   );

   const result = await upsertAttendanceRepo(payload, programData.title);

   await syncEnrollmentsOnAttendanceService(payload.programId, payload.participants, programData.title);

   return result;
};

export const getProgramAttendanceService = async (
   programId: string,
   requestingUserId: string
) => {
   await assertProgramOwnershipService(programId, requestingUserId);
   return await getAttendanceByProgramIdRepo(programId);
};

//take single participant attendance

export const updateParticipantAttendanceService =
   async (
      payload: UpdateParticipantAttendancePayload
   ) => {
      // Ownership check (ticket 0032): only the TP who created this program
      // may mark attendance for it.
      const programData = await assertProgramOwnershipService(payload.programId, payload.training_providerId);
      assertProgramHasStarted(programData);

      // Same CTD-approval visibility gate the bulk path enforces via
      // validateParticipantsEnrollmentService — the single-participant path
      // previously had no enrollment validation at all.
      await validateParticipantsEnrollmentService(payload.programId, [payload.participantId]);

      const updatedAttendance =
         await updateParticipantAttendanceRepository(
            payload
         );

      if (!updatedAttendance) {
         throw new AppError(
            MESSAGES.ATTENDANCE_NOTFOUND,
            HTTP_STATUS.NOT_FOUND
         );
      }

      await syncEnrollmentOnAttendanceService(
         payload.programId,
         payload.participantId,
         payload.present_status
      );
   };
