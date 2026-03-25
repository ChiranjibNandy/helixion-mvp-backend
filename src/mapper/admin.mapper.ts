import { IUser } from "../interfaces/user.interface.js";
import { PendingRegistrationResponseDto } from "../dtos/registration.dto.js";

export const mapUserToPendingRegistrationDto = (
  user: IUser
): PendingRegistrationResponseDto => {
  return {
    id: user._id!.toString(),
    username: user.username,
    email: user.email,
    approval_status: user.approval_status,
    createdAt: user.createdAt,
  };
};