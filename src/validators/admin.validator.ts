import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";


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