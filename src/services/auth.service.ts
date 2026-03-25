import bcrypt from "bcryptjs";
import User from '../models/user.model.js'
import { MESSAGES } from "../constants/messages.js";
import { ApprovalStatus } from "../constants/approval-status.js";
import { UserStatus } from "../constants/user-status.js";
import { createUserRepository, getUserByEmailRepository } from "../repositories/user.repository.js";
import { mapUserToResponseDto } from "../mapper/user.mapper.js";
import { CreateUserDto, UserResponseDto } from "../dtos/user.dto.js";
import { IUser } from "../interfaces/user.interface.js";

// -----------------------------
// Register User Service
// -----------------------------
export const signupService = async (
  userData: CreateUserDto
): Promise<UserResponseDto> => {

  const existingUser = await getUserByEmailRepository(userData.email);

  if (existingUser) {
    throw new Error(MESSAGES.USER_ALREADY_EXISTS);
  }

  const hashedPassword = await bcrypt.hash(
    userData.password,
    10
  );

  const user = await createUserRepository({
    ...userData,
    password: hashedPassword,
  });

  return mapUserToResponseDto(user);
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
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new Error(MESSAGES.INVALID_CREDENTIALS);
  }

  // Check approval and status
  if (
    user.approval_status !== ApprovalStatus.APPROVED ||
    user.status !== UserStatus.ACTIVE
  ) {
    throw new Error(MESSAGES.USER_NO_PERMISSION);
  }

  return user;
};