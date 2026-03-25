import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";

export const pendingRegistrationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val), {
      message: MESSAGES.PAGE_MUST_BE_A_VALID_NUMBER,
    })
    .refine((val) => val > 0, {
      message: MESSAGES.PAGE_MUST_BE_GREATER_THAN_ZERO,
    }),

  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val), {
      message: MESSAGES.LIMIT_MUST_BE_A_VALID_NUMBER,
    })
    .refine((val) => val > 0, {
      message: MESSAGES.LIMIT_MUST_BE_GREATER_THAN_ZERO,
    })
    .refine((val) => val <= 100, {
      message: MESSAGES.LIMIT_CANNOT_EXCEED_100,
    }),
});

export const approveUserParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, {
      message: MESSAGES.USER_ID_REQUIRED,
    }),
});