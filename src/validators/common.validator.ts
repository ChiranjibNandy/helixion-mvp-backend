import z from "zod";
import { MESSAGES } from "../constants/messages.js";
import mongoose from "mongoose";

export const searchUsersQuerySchema = z.object({
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

export const objectIdSchema = z.string().refine(
   (val) => mongoose.Types.ObjectId.isValid(val),
   {
      message: MESSAGES.INVALID_OBJECT,
   }
);

