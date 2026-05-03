import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import { UserStatus } from "../constants/user-status.js";
import { ApprovalStatus } from "../constants/approval-status.js";
import { PendingRegistrationsDto } from "../dtos/registration.dto.js";
import { BulkUploadUserDto } from "../dtos/user.dto.js";
import { getPendingRegistrationsRepository, getRegisteredUsersRepository } from "../repositories/admin.repository.js";
import { mapUserToPendingRegistrationDto } from "../mapper/admin.mapper.js";
import {
  approveUserRepository,
  getUserByIdRepository,
  deactivateUserRepository,
  getUsersByEmailsRepository,
  batchCreateUsersRepository,
  searchUsersRepository,
  updateUserRoleRepository,
} from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ENV } from "../config/env.js";
import { sendWelcomeMail } from "../utils/sendMail.js";


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
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
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
  usersData: BulkUploadUserDto[]
) => {
  // 1. Check for duplicate emails within the batch
  const emails = usersData.map((u) => u.email.toLowerCase());
  const uniqueEmails = new Set(emails);

  if (uniqueEmails.size !== emails.length) {
    throw new AppError(MESSAGES.DUPLICATE_EMAILS_IN_BATCH, HTTP_STATUS.BAD_REQUEST);
  }

  // 2. Look up which emails already exist in the DB
  const existingUsers = await getUsersByEmailsRepository(emails);
  const existingEmailSet = new Set(
    existingUsers.map((u) => u.email.toLowerCase())
  );

  // 3. Separate rows into "create" and "update" buckets
  const toCreate: BulkUploadUserDto[] = [];
  const toUpdate: BulkUploadUserDto[] = [];
  const skipped: string[] = [];

  for (const row of usersData) {
    const emailLower = row.email.toLowerCase();
    const action = (row.action || "approve").toLowerCase();

    if (action === "approve") {
      if (existingEmailSet.has(emailLower)) {
        // Email already exists — skip creation
        skipped.push(row.email);
      } else {
        toCreate.push(row);
      }
    } else if (action === "update") {
      if (existingEmailSet.has(emailLower)) {
        // Email exists — update role
        toUpdate.push(row);
      } else {
        // Email doesn't exist — skip update
        skipped.push(row.email);
      }
    } else {
      skipped.push(row.email);
    }
  }

  // 4. Create new users — derive username & hash default password
  let createdCount = 0;
  const defaultPassword = ENV.DEFAULT_PASSWORD;

  if (toCreate.length > 0) {
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newUsers = toCreate.map((row) => ({
      username: row.email.split("@")[0],
      email: row.email.toLowerCase(),
      password: hashedPassword,
      role: row.role,
      status: UserStatus.ACTIVE,
      approval_status: ApprovalStatus.APPROVED,
    }));

    const created = await batchCreateUsersRepository(newUsers);
    createdCount = created.length;

    // 5. Send welcome emails (fire-and-forget — don't block response)
    for (const row of toCreate) {
      const username = row.email.split("@")[0];
      sendWelcomeMail(row.email, username, defaultPassword).catch((err) => {
        console.error(
          `${MESSAGES.WELCOME_EMAIL_SEND_FAILED}: ${row.email}`,
          err
        );
      });
    }
  }

  // 6. Update roles for existing users
  let updatedCount = 0;

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((row) =>
        updateUserRoleRepository(row.email.toLowerCase(), row.role)
      )
    );
    updatedCount = toUpdate.length;
  }

  return {
    createdCount,
    updatedCount,
    skippedCount: skipped.length,
    skippedEmails: skipped,
  };
};

//get all user
export const getUsersService = async (
  page: number,
  limit: number,
  search: string
) => {

  return await getRegisteredUsersRepository(
    page,
    limit,
    search
  );

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

