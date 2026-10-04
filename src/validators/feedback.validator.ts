import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";

export const addFeedbackSchema = z.object({
   programId: z.string().regex(
      /^[0-9a-fA-F]{24}$/,
      MESSAGES.INVALID_PROGRAM_ID
   ),

   rating: z
      .number()
      .int()
      .min(1)
      .max(5),

   remark: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .default(""),
});