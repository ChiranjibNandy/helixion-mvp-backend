import mongoose from "mongoose";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { getProgramByIdRepo } from "../repositories/program.repository.js";
import {
   getPendingTpConfirmationsRepo,
   confirmEnrollmentByTpRepo,
   declineEnrollmentByTpRepo,
} from "../repositories/enrollment.repository.js";
import { releaseProgramSlot } from "./quota.service.js";
import { getUserByIdRepo } from "../repositories/user.repository.js";
import { NOTIFICATION_TEMPLATES, buildTpConfirmedEmailBody } from "../constants/notificationTemplates.js";
import { createNotification } from "../repositories/notification.repository.js";
import { sendTrackedMail } from "../utils/sendTrackedMail.js";
import { logMailFailure, resolveProgramTitle } from "../utils/notification.util.js";

export const getPendingTpConfirmationsService = async (providerId: string) => {
   return await getPendingTpConfirmationsRepo(providerId);
};

export const confirmEnrollmentService = async (
   programId: string,
   enrollmentId: string,
   providerId: string,
   notes?: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const updated = await confirmEnrollmentByTpRepo(enrollmentId, programId, providerId, notes);
   if (!updated) {
      throw new AppError(
         MESSAGES.ENROLLMENT_NOT_PENDING_TP_CONFIRMATION,
         HTTP_STATUS.CONFLICT
      );
   }

   const programTitle = resolveProgramTitle(program);
   const employee = await getUserByIdRepo(String(updated.employeeId));

   if (employee) {
      const template = NOTIFICATION_TEMPLATES.TP_CONFIRMED(programTitle);

      sendTrackedMail({
         to: employee.email,
         subject: template.emailSubject,
         templateName: template.title,
         html: buildTpConfirmedEmailBody(employee.name, programTitle),
         relatedEntityId: enrollmentId,
      }).catch(logMailFailure("tp-confirmed"));

      createNotification(String(employee._id), template, enrollmentId).catch(
         logMailFailure("tp-confirmed-notification")
      );
   }

   return {
      status: updated.currentStage,
      tpConfirmationDate: updated.tpConfirmation?.confirmedAt ?? null,
   };
};

const escapeHtml = (value: string) =>
   value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const declineEnrollmentService = async (
   programId: string,
   enrollmentId: string,
   providerId: string,
   notes?: string
) => {
   const program = await getProgramByIdRepo(programId, providerId);
   if (!program) {
      throw new AppError(MESSAGES.PROGRAM_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   let updated;
   const session = await mongoose.startSession();
   try {
      await session.withTransaction(async () => {
         updated = await declineEnrollmentByTpRepo(enrollmentId, programId, providerId, notes, session);
         if (!updated) {
            throw new AppError(
               MESSAGES.ENROLLMENT_NOT_PENDING_TP_CONFIRMATION,
               HTTP_STATUS.CONFLICT
            );
         }
         await releaseProgramSlot(programId, session);
      });
   } finally {
      await session.endSession();
   }

   const declined = updated as unknown as { employeeId: unknown; currentStage: string };
   const programTitle = resolveProgramTitle(program);
   const employee = await getUserByIdRepo(String(declined.employeeId));

   if (employee) {
      const template = NOTIFICATION_TEMPLATES.TP_DECLINED(programTitle);

      sendTrackedMail({
         to: employee.email,
         subject: template.emailSubject,
         templateName: template.title,
         html: `<p>Hi ${escapeHtml(employee.name)},</p><p>${template.emailBody}</p>${notes ? `<p>Note from the Training Provider: ${escapeHtml(notes)}</p>` : ""}`,
         relatedEntityId: enrollmentId,
      }).catch(logMailFailure("tp-declined"));

      createNotification(String(employee._id), template, enrollmentId).catch(
         logMailFailure("tp-declined-notification")
      );
   }

   return { status: declined.currentStage };
};
