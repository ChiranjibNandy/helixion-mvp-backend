import User from "../models/user.model.js";
import { MESSAGES } from "../constants/messages.js";
import { ApprovalStatus } from "../constants/approval-status.js";
import { PendingRegistrationsDto } from "../dtos/registration.dto.js";
import { getPendingRegistrationsRepository } from "../repositories/admin.repository.js";
import { mapUserToPendingRegistrationDto } from "../mapper/admin.mapper.js";
import { getUserByIdRepository, updateApprovalStatusRepository } from "../repositories/user.repository.js";

//get regitered user 
export const getPendingRegistrationsService = async (
  page: number,
  limit: number
): Promise<PendingRegistrationsDto> => {

  const { users, total } =
    await getPendingRegistrationsRepository(
      page,
      limit
    );

  const mappedUsers = users.map(
    mapUserToPendingRegistrationDto
  );

  const totalPages = Math.ceil(total / limit);

  return {
    data: mappedUsers,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};

export const approveUserService = async (userId: string) => {

  const user = await getUserByIdRepository(userId);

  if (!user) {
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }

  await updateApprovalStatusRepository(userId, ApprovalStatus.APPROVED)


  return user;
};