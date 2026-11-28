import mongoose from "mongoose";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ENROLLMENT_STAGE, PROGRAM_SAVED_STATUS, PROGRAM_CANCELLATION_REASON, ENROLLMENT_CANCELLATION_REASON } from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { getProgramByIdRepo, updateProgramRepo } from "../repositories/program.repository.js";
import {
   getProgramEnrollmentsForManagementRepo,
   getEnrollmentByIdForProgramRepo,
   cancelEnrollmentByTpRepo,
   cancelProgramEnrollmentsRepo,
   confirmEnrollmentsBulkByTpRepo,
   cancelEnrollmentsBulkByTpRepo,
} from "../repositories/enrollment.repository.js";
import { releaseProgramSlot } from "./quota.service.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { NOTIFICATION_TEMPLATES, buildTpConfirmedEmailBody } from "../constants/notificationTemplates.js";
import { createNotification } from "../repositories/notification.repository.js";
import { sendTrackedMail } from "../utils/sendTrackedMail.js";
import { logMailFailure, resolveProgramTitle, loadNotificationContext } from "../utils/notification.util.js";

const SLOT_RESERVED_STAGES: ENROLLMENT_STAGE[] = [
   ENROLLMENT_STAGE.APPROVED,
   ENROLLMENT_STAGE.TP_PENDING_CONFIRMATION,
   ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE,
   ENROLLMENT_STAGE.TOUR_MANAGER_REVIEW,
   ENROLLMENT_STAGE.TOUR_CTD_REVIEW,
];

const assertNotYetStarted = (program: { startDate?: Date | null }) => {
   if (program.startDate && program.startDate <= new Date()) {
      throw new AppError(MESSAGES.PROGRAM_ALREADY_STARTED, HTTP_STATUS.BAD_REQUEST);
   }
};

// Once frozen, the roster is locked — no further confirm/cancel on individual
// enrolments, and (checked separately in cancelProgramService) the program
// itself can no longer be cancelled either.
const assertNotFrozen = (program: { enrolmentsFrozen?: boolean }) => {
   if (program.enrolmentsFrozen) {
      throw new AppError(MESSAGES.ENROLMENTS_FROZEN, HTTP_STATUS.CONFLICT);
   }
};

export const getProgramEnrollmentsForManagementService = async (programId: string, providerId: string) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   return getProgramEnrollmentsForManagementRepo(programId);
};

export const cancelEnrollmentService = async (
   programId: string,
   enrollmentId: string,
   providerId: string,
   reason: ENROLLMENT_CANCELLATION_REASON,
   notes?: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   assertNotYetStarted(program);
   assertNotFrozen(program);


   const existing = await getEnrollmentByIdForProgramRepo(enrollmentId, programId);
   const priorStage = existing?.currentStage as ENROLLMENT_STAGE | undefined;

   const updated = await cancelEnrollmentByTpRepo(enrollmentId, programId, providerId, reason, notes);
   if (!updated) {
      throw new AppError(MESSAGES.ENROLLMENT_NOT_CANCELLABLE, HTTP_STATUS.CONFLICT);
   }

   const programTitle = resolveProgramTitle(program);
   const employee = await getUserByIdRepo(String(updated.employeeId));

   if (priorStage && SLOT_RESERVED_STAGES.includes(priorStage)) {
      const session = await mongoose.startSession();
      try {
         await session.withTransaction(async () => {
            await releaseProgramSlot(programId, session);
         });
      } finally {
         await session.endSession();
      }
   }

   if (employee) {
      const template = NOTIFICATION_TEMPLATES.ENROLLMENT_CANCELLED_BY_PROVIDER(programTitle);
      sendTrackedMail({
         to: employee.email,
         subject: template.emailSubject,
         templateName: template.title,
         html: template.emailBody,
         relatedEntityId: enrollmentId,
      }).catch(logMailFailure("enrollment-cancelled-by-provider"));

      createNotification(String(employee._id), template, enrollmentId).catch(
         logMailFailure("enrollment-cancelled-by-provider-notification")
      );
   }

   return { status: updated.currentStage };
};

export const cancelProgramService = async (
   programId: string,
   providerId: string,
   reason: PROGRAM_CANCELLATION_REASON,
   note?: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   if (program.status === PROGRAM_SAVED_STATUS.CANCELLED) {
      throw new AppError(MESSAGES.PROGRAM_ALREADY_CANCELLED, HTTP_STATUS.CONFLICT);
   }
   assertNotYetStarted(program);
   assertNotFrozen(program);

   let affected: Awaited<ReturnType<typeof cancelProgramEnrollmentsRepo>> = [];
   const session = await mongoose.startSession();
   try {
      await session.withTransaction(async () => {
         affected = await cancelProgramEnrollmentsRepo(programId, providerId, session);
         await updateProgramRepo(
            programId,
            providerId,
            {
               status: PROGRAM_SAVED_STATUS.CANCELLED,
               cancellation: {
                  reason,
                  note,
                  cancelledBy: toObjectId(providerId),
                  cancelledAt: new Date(),
               },
            },
            session
         );
      });
   } finally {
      await session.endSession();
   }

   const programTitle = resolveProgramTitle(program);
   const template = NOTIFICATION_TEMPLATES.PROGRAM_CANCELLED_BY_PROVIDER(programTitle);

   await Promise.allSettled(
      affected.map(async (enrollment) => {
         const { employee } = await loadNotificationContext(String(enrollment.employeeId), programId);
         if (!employee) return;

         await sendTrackedMail({
            to: employee.email,
            subject: template.emailSubject,
            templateName: template.title,
            html: template.emailBody,
            relatedEntityId: String(enrollment._id),
         }).catch(logMailFailure("program-cancelled-by-provider"));

         return createNotification(String(employee._id), template, String(enrollment._id)).catch(
            logMailFailure("program-cancelled-by-provider-notification")
         );
      })
   );

   return { status: PROGRAM_SAVED_STATUS.CANCELLED, cancelledEnrollmentCount: affected.length };
};

export const confirmEnrollmentsBulkService = async (
   programId: string,
   enrollmentIds: string[],
   providerId: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   assertNotFrozen(program);

   const affected = await confirmEnrollmentsBulkByTpRepo(enrollmentIds, programId, providerId);
   if (affected.length === 0) {
      throw new AppError(MESSAGES.NO_ELIGIBLE_ENROLLMENTS_SELECTED, HTTP_STATUS.CONFLICT);
   }

   const programTitle = resolveProgramTitle(program);
   const template = NOTIFICATION_TEMPLATES.TP_CONFIRMED(programTitle);

   await Promise.allSettled(
      affected.map(async (enrollment) => {
         const employee = await getUserByIdRepo(String(enrollment.employeeId));
         if (!employee) return;

         await sendTrackedMail({
            to: employee.email,
            subject: template.emailSubject,
            templateName: template.title,
            html: buildTpConfirmedEmailBody(employee.name, programTitle),
            relatedEntityId: String(enrollment._id),
         }).catch(logMailFailure("tp-confirmed-bulk"));

         return createNotification(String(employee._id), template, String(enrollment._id)).catch(
            logMailFailure("tp-confirmed-bulk-notification")
         );
      })
   );

   return { confirmedCount: affected.length, requestedCount: enrollmentIds.length };
};

export const cancelEnrollmentsBulkService = async (
   programId: string,
   enrollmentIds: string[],
   providerId: string,
   reason: ENROLLMENT_CANCELLATION_REASON,
   notes?: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   assertNotYetStarted(program);
   assertNotFrozen(program);

   const affected = await cancelEnrollmentsBulkByTpRepo(enrollmentIds, programId, providerId, reason, notes);
   if (affected.length === 0) {
      throw new AppError(MESSAGES.NO_ELIGIBLE_ENROLLMENTS_SELECTED, HTTP_STATUS.CONFLICT);
   }

   const releaseCount = affected.filter((e) => SLOT_RESERVED_STAGES.includes(e.currentStage)).length;
   if (releaseCount > 0) {
      const session = await mongoose.startSession();
      try {
         await session.withTransaction(async () => {
            for (let i = 0; i < releaseCount; i++) {
               await releaseProgramSlot(programId, session);
            }
         });
      } finally {
         await session.endSession();
      }
   }

   const programTitle = resolveProgramTitle(program);
   const template = NOTIFICATION_TEMPLATES.ENROLLMENT_CANCELLED_BY_PROVIDER(programTitle);

   await Promise.allSettled(
      affected.map(async (enrollment) => {
         const employee = await getUserByIdRepo(String(enrollment.employeeId));
         if (!employee) return;

         await sendTrackedMail({
            to: employee.email,
            subject: template.emailSubject,
            templateName: template.title,
            html: template.emailBody,
            relatedEntityId: String(enrollment._id),
         }).catch(logMailFailure("enrollment-cancelled-by-provider-bulk"));

         return createNotification(String(employee._id), template, String(enrollment._id)).catch(
            logMailFailure("enrollment-cancelled-by-provider-bulk-notification")
         );
      })
   );

   return { cancelledCount: affected.length, requestedCount: enrollmentIds.length };
};

export const freezeProgramEnrolmentsService = async (programId: string, providerId: string) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   if (program.enrolmentsFrozen) {
      throw new AppError(MESSAGES.ENROLMENTS_ALREADY_FROZEN, HTTP_STATUS.CONFLICT);
   }
   if (program.status === PROGRAM_SAVED_STATUS.CANCELLED) {
      throw new AppError(MESSAGES.PROGRAM_ALREADY_CANCELLED, HTTP_STATUS.CONFLICT);
   }

   const updated = await updateProgramRepo(programId, providerId, {
      enrolmentsFrozen: true,
      enrolmentsFrozenBy: toObjectId(providerId),
      enrolmentsFrozenAt: new Date(),
   });

   return {
      enrolmentsFrozen: true,
      enrolmentsFrozenAt: updated?.enrolmentsFrozenAt ?? null,
   };
};
