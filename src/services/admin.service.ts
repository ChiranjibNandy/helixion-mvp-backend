import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import { ApprovalStatus } from "../constants/approval-status.js";
import { UserStatus } from "../constants/user-status.js";
import { PendingRegistrationsDto } from "../dtos/registration.dto.js";
import { BulkProcessUserDto } from "../dtos/user.dto.js";
import { getPendingRegistrationsRepository } from "../repositories/admin.repository.js";
import { mapUserToPendingRegistrationDto } from "../mapper/admin.mapper.js";
import {
  approveUserRepository,
  getUserByIdRepository,
  deactivateUserRepository,
  getUsersByEmailsRepository,
  bulkProcessUsersRepository,
} from "../repositories/user.repository.js";

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

export const approveUserAndAddRoleService = async (
  id: string,
  role: string,
  description?: string
) => {
  const updatedUser =
    await approveUserRepository(
      id,
      role,
      description
    );

  if (!updatedUser) {
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }
};

export const deactivateUserService = async (
  id: string,
  requesterId: string
) => {
  if (id === requesterId) {
    throw new Error(MESSAGES.CANNOT_DEACTIVATE_SELF);
  }

  const user = await getUserByIdRepository(id);

  if (!user) {
    throw new Error(MESSAGES.USER_NOT_FOUND);
  }

  if (user.status === UserStatus.DEACTIVE) {
    throw new Error(MESSAGES.USER_ALREADY_DEACTIVATED);
  }

  await deactivateUserRepository(id);
};

export const bulkProcessUsersService = async (
  usersData: BulkProcessUserDto[]
) => {
  return await bulkProcessUsersRepository(usersData);
};
