import User from "../models/user.model.js";
import { MESSAGES } from "../constants/messages.js";
import { ApprovalStatus } from "../constants/approval-status.js";

export const approveUserService = async (userId: string) => {

  const user = await User.findById(userId);

  if (!user) {
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }

  user.approval_status = ApprovalStatus.APPROVED;

  await user.save();

  return user;
};