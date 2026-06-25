import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import { createUserRepo, getUserByEmailRepo, getUserByIdRepo, updatePasswordRepo } from "../repositories/user.repository.js";
import { CreateUserDto, UserResponseDto } from "../dtos/user.dto.js";
import { sendResetMail } from "../utils/sendMail.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { APPROVAL_STATUS, USER_STATUS } from "../constants/enum.js";
import { LoginResponse } from "../types/auth.js";
import { buildPermissions } from "../utils/buildPermission.js";



// -----------------------------
// Register User Service
// -----------------------------
export const signupService = async (
  userData: CreateUserDto
): Promise<UserResponseDto> => {

  const existingUser = await getUserByEmailRepo(userData.email);

  if (existingUser) {
    throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  const hashedPassword = await bcrypt.hash(
    userData.password,
    10
  );

  return await createUserRepo({
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
): Promise<LoginResponse> => {

  const user = await getUserByEmailRepo(email);

  if (!user) {
    throw new AppError(
      MESSAGES.USER_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND
    );
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError(
      MESSAGES.INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  if (user.approval_status !== APPROVAL_STATUS.APPROVED) {
    throw new AppError(
      MESSAGES.NOT_APPROVED,
      HTTP_STATUS.FORBIDDEN
    );
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(
      MESSAGES.USER_ALREADY_DEACTIVATED,
      HTTP_STATUS.FORBIDDEN
    );
  }

  const permissions =
    await buildPermissions(user);



  return {
    user,
    permissions,
  };
};
//send password reset link for the user email address
export const sendResetLinkService = async (
  email: string
) => {

  const user =
    await getUserByEmailRepo(email);

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
      MESSAGES.PASSWORDS_DO_NOT_MATCH, HTTP_STATUS.CONFLICT
    );
  }

  const user =
    await getUserByIdRepo(userId);

  if (!user) {
    throw new AppError(
      MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND
    );
  }

  const hashedPassword =
    await bcrypt.hash(newPassword, 10);

  await updatePasswordRepo(
    userId,
    hashedPassword
  );

};

