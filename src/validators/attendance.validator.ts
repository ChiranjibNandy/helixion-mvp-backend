import { z } from "zod";
import { ATTENDANCE_STATUS } from "../constants/enum.js";
import { objectIdSchema } from "./common.validator.js";
import { MESSAGES } from "../constants/messages.js";
import { validateParticipantsEnrollmentRepository } from "../repositories/enrollment.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";


export const takeAttendanceBodySchema = z.object({
   date: z.coerce.date({
      message: MESSAGES.VALID_DATE_REQUIRED,
   }),

   participants: z
      .array(
         z.object({
            participantId: objectIdSchema,

            present_status: z.enum(
               Object.values(
                  ATTENDANCE_STATUS
               ) as [string, ...string[]],
               {
                  message:
                     MESSAGES.PRESENT_STATUS_VALUE_VALIDATION,
               }
            ),
         })
      )
      .min(1, {
         message:
            MESSAGES.MIN_PARTICIPANT,
      }),
});

//validate take attendance
export const validateParticipantsEnrollmentService =
   async (
      programId: string,
      participantIds: string[]
   ) => {

      const enrolledParticipants =
         await validateParticipantsEnrollmentRepository(
            programId,
            participantIds
         );

      const enrolledIds = enrolledParticipants.map(
         (item) => item.userId.toString()
      );

      const invalidParticipants = participantIds.filter(
         (id) => !enrolledIds.includes(id)
      );

      if (invalidParticipants.length > 0) {
         throw new AppError(
            `${ MESSAGES.PARTICIPANTS_NOT_ENROLLED }: ${ invalidParticipants.join(", ") }`,
            HTTP_STATUS.NOT_FOUND
         );
      }

      return true;
   };