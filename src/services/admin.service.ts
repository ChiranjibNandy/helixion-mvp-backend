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
  batchCreateUsersRepository,
  searchUsersRepository,
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

export const batchCreateUsersService = async (
  usersData: BatchCreateUserDto[]
) => {
  const emails = usersData.map((u) => u.email);
  const uniqueEmails = new Set(emails);

  if (uniqueEmails.size !== emails.length) {
    throw new Error(MESSAGES.DUPLICATE_EMAILS_IN_BATCH);
  }

  const existingUsers = await getUsersByEmailsRepository(emails);

  if (existingUsers.length > 0) {
    const existing = existingUsers.map((u) => u.email).join(", ");
    throw new Error(`${MESSAGES.USERS_ALREADY_EXIST}: ${existing}`);
  }

  const usersWithHashedPasswords = await Promise.all(
    usersData.map(async (user) => ({
      username: user.username,
      email: user.email,
      password: await bcrypt.hash(user.password, 10),
      role: user.role,
      description: user.description,
    }))
  );

  return await batchCreateUsersRepository(usersWithHashedPasswords);
};

export const searchUsersService = async (
  query: string,
  page: number,
  limit: number
) => {
  const { users, total } = await searchUsersRepository(query, page, limit);
  const totalPages = Math.ceil(total / limit);

  return {
    data: users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      approval_status: user.approval_status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};
