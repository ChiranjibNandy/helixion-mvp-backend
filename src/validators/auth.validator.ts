import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";

export const signupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, { error: MESSAGES.USERNAME_REQUIRED }),

    email: z
      .string()
      .trim()
      .min(1, { error: MESSAGES.EMAIL_REQUIRED })
      .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT })),

    password: z
      .string()
      .trim()
      .min(8, { error: MESSAGES.PASSWORD_MIN_LENGTH })
      .regex(
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        { error: MESSAGES.PASSWORD_COMPLEXITY }
      ),

    confirmPassword: z
      .string()
      .trim()
      .min(1, { error: MESSAGES.PASSWORD_REQUIRED }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: MESSAGES.PASSWORDS_DO_NOT_MATCH,
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: MESSAGES.EMAIL_REQUIRED })
    .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT })),

  password: z
    .string()
    .trim()
    .min(1, { error: MESSAGES.PASSWORD_REQUIRED }),
});

// validate only the email is required and in correct format or not
export const sendResetMailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: MESSAGES.EMAIL_REQUIRED })
    .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT })),
});

//validate UserId password
export const resetPasswordSchema = z.object({
  userId: z.string(),
  newPassword: z
    .string()
    .trim()
    .min(8, { error: MESSAGES.PASSWORD_MIN_LENGTH })
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      { error: MESSAGES.PASSWORD_COMPLEXITY }
    ),

  confirmPassword: z
    .string()
    .trim()
    .min(1, { error: MESSAGES.PASSWORD_REQUIRED }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: MESSAGES.PASSWORDS_DO_NOT_MATCH,
  path: ["confirmPassword"],
});
