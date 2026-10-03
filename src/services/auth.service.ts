import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import {
   createUserRepo,
   findAdminUser,
   getUserByEmailRepo,
   getUserByIdRepo,
   getUsersByEmailsRepo,
   updatePasswordRepo,
} from "../repositories/user.repository.js";
import { CreateUserDto, UserResponseDto } from "../dtos/user.dto.js";
import { sendResetMail } from "../utils/sendMail.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ORG_ROLE, USER_STATUS } from "../constants/enum.js";
import { buildPermission } from "../utils/permission.js";
import { LoginResponse, ResetLinkResult } from "../types/auth.js";
import { createNotification } from "../repositories/notification.repository.js";
import { NOTIFICATION_TEMPLATES } from "../constants/notificationTemplates.js";

// ─────────────────────────────────────────────────────────────────────────────
// Register User
// ─────────────────────────────────────────────────────────────────────────────
export const signupService = async (
   userData: CreateUserDto
): Promise<UserResponseDto> => {
   const existingUser = await getUserByEmailRepo(userData.email);

   if (existingUser) {
      throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
   }

   const hashedPassword = await bcrypt.hash(userData.password, 10);
   const orgRole = (userData as any).orgRole || (userData as any).role;

   try {
      const newUser = await createUserRepo({
         name: userData.name || (userData as any).username,
         email: userData.email,
         passwordHash: hashedPassword,
         orgRole,
         isApproved: orgRole === ORG_ROLE.ADMIN,
         mustChangePassword: false,
         status: USER_STATUS.ACTIVE,
         hierarchy: { level: 0, managerChain: [] },
         officeRoles: {
            trainingDept: { enabled: false, level: 0 },
            osd: { enabled: false, level: 0 },
         },
      });

      const adminUser = await findAdminUser();
      if (adminUser) {
         await createNotification(
            adminUser._id.toString(),
            NOTIFICATION_TEMPLATES.USER_REGISTERED(newUser.name),
            newUser._id.toString()
         )
      }

      return newUser;
   } catch (err: any) {
      if (err?.code === 11000) {
         throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
      }
      throw err;
   }
};

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
export const loginService = async (
   email: string,
   password: string
): Promise<LoginResponse> => {
   const user = await getUserByEmailRepo(email);

   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

   if (!isPasswordValid) {
      throw new AppError(MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.CONFLICT);
   }

   if (user.isRejected) {
      throw new AppError(MESSAGES.REJECTED, HTTP_STATUS.CONFLICT);
   }

   if (!user.isApproved) {
      throw new AppError(MESSAGES.NOT_APPROVED, HTTP_STATUS.CONFLICT);
   }

   if (user.status !== USER_STATUS.ACTIVE) {
      throw new AppError(MESSAGES.NOT_ACTIVE_USER, HTTP_STATUS.CONFLICT);
   }
   const permissions = await buildPermission(user);


   return {
      user,
      permissions,
   };
};

// ─────────────────────────────────────────────────────────────────────────────
// Send password reset link
// ─────────────────────────────────────────────────────────────────────────────
export const sendResetLinkService = async (
   emails: string[]
): Promise<ResetLinkResult> => {
   const MAX_RESET_LINK_RECIPIENTS = 30;
   const results: ResetLinkResult = {
      successful: [],
      failed: [],
   };

   // Normalize emails before deduplication so that:
   // user@example.com and User@Example.com are treated as the same user.
   const uniqueEmails = [
      ...new Set(
         emails
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
      ),
   ];

   if (uniqueEmails.length > MAX_RESET_LINK_RECIPIENTS) {
      return {
         successful: [],
         failed: uniqueEmails.map((email) => ({
            email,
            reason: `A maximum of ${MAX_RESET_LINK_RECIPIENTS} reset links can be requested at once`,
         })),
      };
   }

   if (uniqueEmails.length === 0) {
      return results;
   }

   // Fetch all users in a single database query.
   const users = await getUsersByEmailsRepo(uniqueEmails);

   const usersByEmail = new Map(
      users.map((user) => [
         user.email.trim().toLowerCase(),
         user,
      ])
   );

   const resetResults = await Promise.all(
      uniqueEmails.map(async (email) => {
         const user = usersByEmail.get(email);

         if (!user) {
            return {
               email,
               success: false,
               reason: MESSAGES.USER_NOT_FOUND,
            };
         }

         try {
            await sendResetMail(
               email,
               user._id.toString(),
               user.name
            );

            return {
               email,
               success: true,
            };
         } catch {

            return {
               email,
               success: false,
               reason: MESSAGES.EMAIL_RESET_LINK_ERROR,
            };
         }
      })
   );

   for (const result of resetResults) {
      if (result.success) {
         results.successful.push(result.email);
      } else {
         results.failed.push({
            email: result.email,
            reason: result.reason!,
         });
      }
   }

   return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset password
// ─────────────────────────────────────────────────────────────────────────────
export const resetPasswordService = async (
   userId: string,
   newPassword: string,
   confirmPassword: string
) => {
   if (newPassword !== confirmPassword) {
      throw new AppError(MESSAGES.PASSWORDS_DO_NOT_MATCH, HTTP_STATUS.CONFLICT);
   }

   const user = await getUserByIdRepo(userId);

   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const hashedPassword = await bcrypt.hash(newPassword, 10);

   await updatePasswordRepo(userId, hashedPassword);
};
