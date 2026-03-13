import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";

export const signupSchema = z
   .object({
      username: z.string().trim().min(1, MESSAGES.USERNAME_REQUIRED),

      email: z
         .email(MESSAGES.INVALID_EMAIL_FORMAT)
         .min(1, MESSAGES.EMAIL_REQUIRED),

      password: z
         .string()
         .trim()
         .min(6, MESSAGES.PASSWORD_MIN_LENGTH)
         .regex(
            /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/,
            MESSAGES.PASSWORD_COMPLEXITY
         ),

      confirmPassword: z.string().trim()
   })
   .refine((data) => data.password === data.confirmPassword, {
      message: MESSAGES.PASSWORDS_DO_NOT_MATCH,
      path: ["confirmPassword"]
   });


export const loginSchema = z.object({
   username: z
      .string()
      .trim()
      .min(1, MESSAGES.USERNAME_REQUIRED),

   password: z
      .string()
      .trim()
      .min(1, MESSAGES.PASSWORD_REQUIRED)
});