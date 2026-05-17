import { z } from "zod";
import { ATTENDANCE_STATUS } from "../constants/enum.js";
import { objectIdSchema } from "./common.validator.js";
import { MESSAGES } from "../constants/messages.js";


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