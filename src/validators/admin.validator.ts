import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";

export const getQuerySchema = z.object({
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
  search: z
    .string()
    .optional()
    .default("")
    .transform(val => val.trim())
    .refine(
      val => val.length <= 50,
      {
        message:
          MESSAGES.SEARCH_CANNOT_EXCEED_50_CHARACTERS
      }
    )
});

export const searchUsersQuerySchema = z.object({
  q: z.string().optional(),
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
    .min(1, MESSAGES.USER_ID_REQUIRED),
});


export const approveUserBodySchema = z.object({
  role: z
    .string()
    .min(1, MESSAGES.ROLE_REQUIRED),

  description: z
    .string()
    .optional(),
});

export const batchCreateUsersBodySchema = z.object({
  users: z.array(
    z.object({
      email: z
        .string()
        .trim()
        .min(1, { error: MESSAGES.EMAIL_REQUIRED })
        .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT })),
      role: z
        .string()
        .min(1, MESSAGES.ROLE_REQUIRED),
      action: z
        .string()
        .optional()
        .default("approve"),
    })
  ).min(1).max(50),
});