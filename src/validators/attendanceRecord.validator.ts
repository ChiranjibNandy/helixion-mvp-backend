import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";
import { ATTENDANCE_DAY_STATUS } from "../constants/enum.js";
import { objectIdSchema } from "./common.validator.js";

const DATE_STRING_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const attendanceGridQuerySchema = z.object({
   page: z
      .string()
      .optional()
      .default("1")
      .transform((val) => Number(val))
      .refine((val) => !isNaN(val) && val > 0, { message: MESSAGES.PAGE_MUST_BE_GREATER_THAN_ZERO }),

   limit: z
      .string()
      .optional()
      .default("50")
      .transform((val) => Number(val))
      .refine((val) => !isNaN(val) && val > 0 && val <= 100, { message: MESSAGES.LIMIT_CANNOT_EXCEED_100 }),

   search: z
      .string()
      .optional()
      .default("")
      .transform((val) => val.trim())
      .refine((val) => val.length <= 50, { message: MESSAGES.SEARCH_CANNOT_EXCEED_50_CHARACTERS }),

   sortBy: z.enum(["name", "email"]).optional(),
   sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const attendanceParamsSchema = z.object({
   id: objectIdSchema,
   enrollmentId: objectIdSchema,
});

export const markAttendanceDayBodySchema = z.object({
   date: z.string().regex(DATE_STRING_REGEX, { message: MESSAGES.VALID_DATE_REQUIRED }),

   status: z
      .enum(Object.values(ATTENDANCE_DAY_STATUS) as [string, ...string[]], {
         message: MESSAGES.ATTENDANCE_DAY_STATUS_INVALID,
      })
      .nullable()
      .refine((val) => val !== ATTENDANCE_DAY_STATUS.PENDING, {
         message: MESSAGES.ATTENDANCE_DAY_STATUS_INVALID,
      }),
});

export const updateAttendanceNotesBodySchema = z.object({
   notes: z.string().max(500, { message: MESSAGES.NOTES_MAX_LENGTH }),
});
