import bcrypt from "bcryptjs";
import User from '../models/user.model.js'
import { MESSAGES } from "../constants/messages.js";
import { ApprovalStatus } from "../constants/approval-status.js";
import { UserStatus } from "../constants/user-status.js";

// -----------------------------
// Register User Service
// -----------------------------
export const signupService = async (
  username: string,
  email:string,
  password: string,
) => {

  const existingUser = await User.findOne({ email });

  // Check if user already exists
  if (existingUser) {
    throw new Error(MESSAGES.USER_ALREADY_EXISTS);
  }

  // Hash the password before storing
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  return user;
};

// -----------------------------
// Login User Service
// -----------------------------
export const loginService = async (
  email: string,
  password: string
) => {

  const user = await User.findOne({ email });

  // Find user by username
  if (!user) {
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error(MESSAGES.INVALID_CREDENTIALS);
  }

  // Check user approval and status
  if (user.approval_status !== ApprovalStatus.APPROVED || user.status !== UserStatus.ACTIVE) {
    throw new Error(MESSAGES.USER_NO_PERMISSION);
  }

  return user;
};