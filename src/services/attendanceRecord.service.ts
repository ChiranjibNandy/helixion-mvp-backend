import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/appError.js";
import { assertProgramOwnershipService } from "./program.service.js";
import {
   getProgramEnrollmentsForGridRepo,
   countEligibleEnrollmentsRepo,
   getEligibleEnrollmentForAttendanceRepo,
   getAllAttendanceRecordsForProgramRepo,
   getAttendanceRecordsByEnrollmentIdsRepo,
   upsertAttendanceDayRepo,
   updateAttendanceNotesRepo,
   markProgramAttendanceUpdatedRepo,
   markEnrollmentAttendanceStartedRepo,
} from "../repositories/attendanceRecord.repository.js";
import { syncEnrollmentAttendanceRepo } from "../repositories/enrollment.repository.js";
import { GetAttendanceGridQuery, MarkAttendanceDayPayload, UpdateAttendanceNotesPayload } from "../types/attendanceRecord.js";
import { ACTOR_TYPE, ATTENDANCE_DAY_STATUS, ATTENDANCE_RECORD_STATUS, ENROLLMENT_STAGE, TIMELINE_ACTION } from "../constants/enum.js";
import { getDateRangeStrings, toDateString, todayDateString } from "../utils/date.js";
import { sendAttendanceAbsentMail, sendAttendancePresentMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure } from "../utils/notification.util.js";
import { IUser } from "../interfaces/user.interface.js";
import { IAttendanceDayEntry } from "../interfaces/attendanceRecord.interface.js";
import { toObjectId } from "../utils/mongo.js";

const ATTENDANCE_LOCKED_STAGES: ENROLLMENT_STAGE[] = [
   ENROLLMENT_STAGE.ABSENT,
   ENROLLMENT_STAGE.REIMBURSEMENT_MANAGER_REVIEW,
   ENROLLMENT_STAGE.REIMBURSEMENT_OSD_REVIEW,
   ENROLLMENT_STAGE.COMPLETED,
   ENROLLMENT_STAGE.REJECTED,
];

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

const dispatchAttendanceMail = (employee: IUser | null, programTitle: string, present: boolean) => {
   if (!employee) return Promise.resolve();
   return present
      ? sendAttendancePresentMail(employee.email, employee.name, programTitle)
      : sendAttendanceAbsentMail(employee.email, employee.name, programTitle);
};

const tallyAttendanceByDay = (
   attendanceByDay: Record<string, IAttendanceDayEntry> | undefined,
   dateRange: string[]
) => {
   let present = 0;
   let absent = 0;

   for (const date of dateRange) {
      const entry = attendanceByDay?.[date];
      if (entry?.status === ATTENDANCE_DAY_STATUS.PRESENT) present++;
      else if (entry?.status === ATTENDANCE_DAY_STATUS.ABSENT) absent++;
   }

   return { present, absent, pending: dateRange.length - present - absent };
};

const ATTENDANCE_PASS_THRESHOLD = 0.5;

const computeAttendanceOutcome = (present: number, totalDays: number): boolean /* isPresent */ => {
   if (totalDays === 0) return false;
   return present / totalDays >= ATTENDANCE_PASS_THRESHOLD;
};

const maybeFinalizeEnrollmentAttendance = async (
   programId: string,
   programEndDate: Date | null | undefined,
   enrollmentId: string,
   employeeId: string,
   attendanceByDay: Record<string, IAttendanceDayEntry> | undefined,
   dateRange: string[]
) => {
   const { present, pending } = tallyAttendanceByDay(attendanceByDay, dateRange);
   const programHasEnded = !!programEndDate && toDateString(programEndDate) < todayDateString();

   if (pending > 0 && !programHasEnded) return;

   const now = new Date();
   const isPresent = computeAttendanceOutcome(present, dateRange.length);

   const result = await syncEnrollmentAttendanceRepo(
      programId,
      employeeId,
      ATTENDANCE_LOCKED_STAGES,
      isPresent ? presentUpdate(now) : absentUpdate(now),
      isPresent ? presentTimelineEntry(now) : absentTimelineEntry(now)
   );

   if (!result || result.matchedCount === 0) return;

   loadNotificationContext(employeeId, programId)
      .then(({ employee, programTitle }) => dispatchAttendanceMail(employee, programTitle, isPresent))
      .catch(logMailFailure("attendance"));
};

const buildEnrollmentDayView = (
   attendanceByDay: Record<string, IAttendanceDayEntry> | undefined,
   dateRange: string[]
) => {
   const byDay: Record<string, { status: ATTENDANCE_DAY_STATUS; markedAt: Date } | null> = {};
   for (const date of dateRange) {
      const entry = attendanceByDay?.[date];
      byDay[date] = entry && entry.status !== ATTENDANCE_DAY_STATUS.PENDING
         ? { status: entry.status, markedAt: entry.markedAt }
         : null;
   }
   return byDay;
};

export const getProgramAttendanceGridService = async (
   programId: string,
   requestingUserId: string,
   query: GetAttendanceGridQuery
) => {
   const program = await assertProgramOwnershipService(programId, requestingUserId);
   const dateRange = getDateRangeStrings(program.startDate, program.endDate);

   const sortBy = query.sortBy || "name";
   const sortOrder = query.sortOrder === "desc" ? -1 : 1;

   const [{ enrollments, total }, totalEligibleEnrollments, allRecords] = await Promise.all([
      getProgramEnrollmentsForGridRepo(programId, query.page, query.limit, query.search, sortBy, sortOrder),
      countEligibleEnrollmentsRepo(programId),
      getAllAttendanceRecordsForProgramRepo(programId),
   ]);

   const recordsByEnrollmentId = new Map(
      (await getAttendanceRecordsByEnrollmentIdsRepo(enrollments.map((e: { _id: unknown }) => String(e._id))))
         .map((record) => [String(record.enrollmentId), record])
   );

   const enrollmentViews = enrollments.map((enrollment: {
      _id: unknown;
      employeeId: unknown;
      employeeName: string;
      employeeEmail: string;
      department?: string;
      hasAttendanceMarked?: boolean;
   }) => {
      const record = recordsByEnrollmentId.get(String(enrollment._id));
      const attendanceByDay = record?.attendanceByDay as unknown as Record<string, IAttendanceDayEntry> | undefined;
      const { present, absent, pending } = tallyAttendanceByDay(attendanceByDay, dateRange);

      return {
         enrollmentId: String(enrollment._id),
         employeeId: String(enrollment.employeeId),
         employeeName: enrollment.employeeName,
         employeeEmail: enrollment.employeeEmail,
         department: enrollment.department ?? "",
         attendanceByDay: buildEnrollmentDayView(attendanceByDay, dateRange),
         notes: record?.notes ?? "",
         totalPresent: present,
         totalAbsent: absent,
         totalPending: pending,
         isComplete: pending === 0,
         hasAttendanceMarked: !!enrollment.hasAttendanceMarked,
      };
   });


   const summaryByDay: Record<string, { present: number; absent: number; pending: number }> = {};
   for (const date of dateRange) {
      summaryByDay[date] = { present: 0, absent: 0, pending: totalEligibleEnrollments };
   }
   for (const record of allRecords) {
      const attendanceByDay = record.attendanceByDay as unknown as Record<string, IAttendanceDayEntry> | undefined;
      for (const date of dateRange) {
         const status = attendanceByDay?.[date]?.status;
         if (status === ATTENDANCE_DAY_STATUS.PRESENT) {
            summaryByDay[date].present++;
            summaryByDay[date].pending--;
         } else if (status === ATTENDANCE_DAY_STATUS.ABSENT) {
            summaryByDay[date].absent++;
            summaryByDay[date].pending--;
         }
      }
   }

   return {
      programId,
      programTitle: program.title,
      programDates: {
         start: toDateString(program.startDate),
         end: program.endDate ? toDateString(program.endDate) : toDateString(program.startDate),
         totalDays: dateRange.length,
      },
      enrollments: enrollmentViews,
      summary: {
         byDay: summaryByDay,
         totalEnrollments: totalEligibleEnrollments,
         programHasAttendance: !!program.attendanceMarked,
      },
      pagination: {
         page: query.page,
         limit: query.limit,
         total,
         totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
   };
};

export const markAttendanceDayService = async (payload: MarkAttendanceDayPayload) => {
   const program = await assertProgramOwnershipService(payload.programId, payload.training_providerId);

   if (payload.date > todayDateString()) {
      throw new AppError(MESSAGES.ATTENDANCE_FUTURE_DATE_NOT_ALLOWED, HTTP_STATUS.BAD_REQUEST);
   }

   const enrollment = await getEligibleEnrollmentForAttendanceRepo(payload.programId, payload.enrollmentId);
   if (!enrollment) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_ELIGIBLE_FOR_ATTENDANCE, HTTP_STATUS.NOT_FOUND);
   }

   const entry: IAttendanceDayEntry = {
      status: payload.status ?? ATTENDANCE_DAY_STATUS.PENDING,
      markedAt: new Date(),
      markedBy: toObjectId(payload.training_providerId),
   };

   const record = await upsertAttendanceDayRepo(
      payload.enrollmentId,
      payload.programId,
      String(enrollment.employeeId),
      payload.date,
      entry
   );

   await Promise.all([
      markProgramAttendanceUpdatedRepo(payload.programId),
      markEnrollmentAttendanceStartedRepo(payload.enrollmentId),
   ]);

   const dateRange = getDateRangeStrings(program.startDate, program.endDate);
   await maybeFinalizeEnrollmentAttendance(
      payload.programId,
      program.endDate,
      payload.enrollmentId,
      String(enrollment.employeeId),
      record.attendanceByDay as unknown as Record<string, IAttendanceDayEntry>,
      dateRange
   );

   const { present, absent, pending } = tallyAttendanceByDay(record.attendanceByDay as unknown as Record<string, IAttendanceDayEntry>, dateRange);

   return {
      enrollmentId: payload.enrollmentId,
      attendanceByDay: buildEnrollmentDayView(record.attendanceByDay as unknown as Record<string, IAttendanceDayEntry>, dateRange),
      totalPresent: present,
      totalAbsent: absent,
      totalPending: pending,
      isComplete: pending === 0,
   };
};

export const updateAttendanceNotesService = async (payload: UpdateAttendanceNotesPayload) => {
   await assertProgramOwnershipService(payload.programId, payload.training_providerId);

   const enrollment = await getEligibleEnrollmentForAttendanceRepo(payload.programId, payload.enrollmentId);
   if (!enrollment) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_ELIGIBLE_FOR_ATTENDANCE, HTTP_STATUS.NOT_FOUND);
   }

   const record = await updateAttendanceNotesRepo(
      payload.enrollmentId,
      payload.programId,
      String(enrollment.employeeId),
      payload.notes
   );

   return { enrollmentId: payload.enrollmentId, notes: record.notes };
};
