import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import {
   createUserRepo,
   getUserByEmailRepo,
   getUserByIdRepo,
   updatePasswordRepo,
} from "../repositories/user.repository.js";
import { CreateUserDto, UserResponseDto } from "../dtos/user.dto.js";
import { IUser } from "../interfaces/user.interface.js";
import { sendResetMail } from "../utils/sendMail.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { USER_STATUS } from "../constants/enum.js";

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

   try {
      return await createUserRepo({
         name: userData.name || (userData as any).username,
         email: userData.email,
         passwordHash: hashedPassword,
         orgRole: (userData as any).orgRole || (userData as any).role,
         mustChangePassword: false,
         status: USER_STATUS.ACTIVE,
         hierarchy: { level: 0, managerChain: [] },
         officeRoles: {
            trainingDept: { enabled: false, level: null },
            osd: { enabled: false, level: null },
         },
      });
   } catch (err: any) {
      // MongoDB duplicate key — concurrent request registered the same email
      // between our getUserByEmail check and the insert above
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
): Promise<IUser> => {
   const user = await getUserByEmailRepo(email);

   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

   if (!isPasswordValid) {
      throw new AppError(MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.CONFLICT);
   }

   if (user.status !== USER_STATUS.ACTIVE) {
      throw new AppError(MESSAGES.NOT_APPROVED, HTTP_STATUS.CONFLICT);
   }

   return user;
};

// ─────────────────────────────────────────────────────────────────────────────
// Send password reset link
// ─────────────────────────────────────────────────────────────────────────────
export const sendResetLinkService = async (email: string) => {
   const user = await getUserByEmailRepo(email);

   if (!user) {
      throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   await sendResetMail(email, user._id.toString(), user.name);
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
