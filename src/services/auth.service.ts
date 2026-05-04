import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import { createUserRepository, getUserByEmailRepository, getUserByIdRepository, updatePasswordRepository } from "../repositories/user.repository.js";
import { CreateUserDto, UserResponseDto } from "../dtos/user.dto.js";
import { IUser } from "../interfaces/user.interface.js";
import { sendResetMail } from "../utils/sendMail.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { APPROVAL_STATUS, USER_STATUS } from "../constants/enum.js";

// -----------------------------
// Register User Service
// -----------------------------
export const signupService = async (
  userData: CreateUserDto
): Promise<UserResponseDto> => {

  const existingUser = await getUserByEmailRepository(userData.email);

  if (existingUser) {
    throw new AppError(MESSAGES.USER_ALREADY_EXISTS,HTTP_STATUS.CONFLICT);
  }

  const hashedPassword = await bcrypt.hash(
    userData.password,
    10
  );

  return await createUserRepository({
    ...userData,
    password: hashedPassword,
  });

};

// -----------------------------
// Login User Service
// -----------------------------
export const loginService = async (
  email: string,
  password: string
): Promise<IUser> => {

  // Find user by email
  const user = await getUserByEmailRepository(email);

  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND,HTTP_STATUS.NOT_FOUND);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError(MESSAGES.INVALID_CREDENTIALS,HTTP_STATUS.CONFLICT);
  }

  // Check approval and status
  if (
    user.approval_status !== APPROVAL_STATUS.APPROVED ||
    user.status !== USER_STATUS.ACTIVE
  ) {
    throw new AppError(MESSAGES.NOT_APPROVED,HTTP_STATUS.CONFLICT);
  }

  return user;
};

//send password reset link for the user email address
export const sendResetLinkService = async (
  email: string
) => {

  const user =
    await getUserByEmailRepository(email);

  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }


  await sendResetMail(
    email,
    user._id.toString(),
    user.username,
  );
};

//Reset password 
export const resetPasswordService = async (
  userId: string,
  newPassword: string,
  confirmPassword: string
) => {

  if (newPassword !== confirmPassword) {
    throw new AppError(
      MESSAGES.PASSWORDS_DO_NOT_MATCH,HTTP_STATUS.CONFLICT
    );
  }

  const user =
    await getUserByIdRepository(userId);

  if (!user) {
    throw new AppError(
      MESSAGES.USER_NOT_FOUND,HTTP_STATUS.NOT_FOUND
    );
  }

  const hashedPassword =
    await bcrypt.hash(newPassword, 10);

  await updatePasswordRepository(
    userId,
    hashedPassword
  );

};

