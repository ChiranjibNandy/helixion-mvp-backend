import mongoose from "mongoose";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ENROLLMENT_STAGE, PROGRAM_SAVED_STATUS, PROGRAM_CANCELLATION_REASON } from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { getProgramByIdRepo, updateProgramRepo } from "../repositories/program.repository.js";
import {
   getProgramEnrollmentsForManagementRepo,
   getEnrollmentByIdForProgramRepo,
   cancelEnrollmentByTpRepo,
   cancelProgramEnrollmentsRepo,
} from "../repositories/enrollment.repository.js";
import { releaseProgramSlot } from "./quota.service.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { NOTIFICATION_TEMPLATES } from "../constants/notificationTemplates.js";
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

export const getProgramEnrollmentsForManagementService = async (programId: string, providerId: string) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   return getProgramEnrollmentsForManagementRepo(programId);
};

export const cancelEnrollmentService = async (
   programId: string,
   enrollmentId: string,
   providerId: string,
   notes?: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   assertNotYetStarted(program);


   const existing = await getEnrollmentByIdForProgramRepo(enrollmentId, programId);
   const priorStage = existing?.currentStage as ENROLLMENT_STAGE | undefined;

   const updated = await cancelEnrollmentByTpRepo(enrollmentId, programId, providerId, notes);
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
