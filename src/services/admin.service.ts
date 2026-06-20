import bcrypt from "bcryptjs";
import { MESSAGES } from "../constants/messages.js";
import { PendingRegistrationsDto } from "../dtos/registration.dto.js";
import { BulkUploadUserDto } from "../dtos/user.dto.js";
import { getPendingRegistrationsRepo, getRegisteredUsersRepo } from "../repositories/admin.repository.js";
import { mapUserToPendingRegistrationDto } from "../mapper/user.mapper.js";
import {
  approveUserRepo,
  getUserByIdRepo,
  deactivateUserRepo,
  getUsersByEmailsRepo,
  batchCreateUsersRepo,
  searchUsersRepo,
  updateUserRoleRepo,
} from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { USER_STATUS } from "../constants/enum.js";
import { ENV } from "../config/env.js";
import { sendWelcomeMail } from "../utils/sendMail.js";
import { toObjectId } from "../utils/mongo.js";



export const getPendingRegistrationsService = async (
  page: number,
  limit: number
): Promise<PendingRegistrationsDto> => {

  const { users, total } =
    await getPendingRegistrationsRepo(
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
    await approveUserRepo(
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
    throw new AppError(MESSAGES.CANNOT_DEACTIVATE_SELF,HTTP_STATUS.CONFLICT);
  }

  const user = await getUserByIdRepo(id);

  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND,HTTP_STATUS.NOT_FOUND);
  }

  if (user.status === USER_STATUS.DEACTIVE) {
    throw new AppError(MESSAGES.USER_ALREADY_DEACTIVATED,HTTP_STATUS.CONFLICT);
  }

  await deactivateUserRepo(id);
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
  const existingUsers = await getUsersByEmailsRepo(emails);
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
        skipped.push(row.email);
      } else {
        toCreate.push(row);
      }
    } else if (action === "update") {
      if (existingEmailSet.has(emailLower)) {
        toUpdate.push(row);
      } else {
        skipped.push(row.email);
      }
    } else {
      skipped.push(row.email);
    }
  }

  // 4. Create new users — hash default password, map all new schema fields
  let createdCount = 0;
  const defaultPassword = ENV.DEFAULT_PASSWORD;

  if (toCreate.length > 0) {
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newUsers = toCreate.map((row) => {
      const tdEnabled = row.trainingDeptEnabled === true || row.trainingDeptEnabled === "true" || row.trainingDeptEnabled === "Yes";
      const osdEnabled = row.osdEnabled === true || row.osdEnabled === "true" || row.osdEnabled === "Yes";

      return {
        name:               row.name || row.email.split("@")[0],
        email:              row.email.toLowerCase(),
        passwordHash:       hashedPassword,
        orgRole:            row.orgRole,
        employeeCode:       row.employeeCode,
        placeOfPosting:     row.placeOfPosting,
        mobile:             row.mobile,
        mustChangePassword: true,        // batch-imported users must set their own pw
        status:             USER_STATUS.ACTIVE,
        hierarchy: {
          level:        0,
          managerId:    row.managerId ? toObjectId(row.managerId) : undefined,
          managerChain: [],              // populated in a second pass once all users exist
        },
        officeRoles: {
          trainingDept: {
            enabled: tdEnabled,
            level:   tdEnabled ? Number(row.trainingDeptLevel) || 1 : null,
          },
          osd: {
            enabled: osdEnabled,
            level:   osdEnabled ? Number(row.osdLevel) || 1 : null,
          },
        },
      };
    });

    const created = await batchCreateUsersRepo(newUsers as any);
    createdCount = created.length;

    // Send welcome emails (fire-and-forget)
    for (const row of toCreate) {
      const displayName = row.name || row.email.split("@")[0];
      sendWelcomeMail(row.email, displayName, defaultPassword).catch((err) => {
        console.error(`${MESSAGES.WELCOME_EMAIL_SEND_FAILED}: ${row.email}`, err);
      });
    }
  }

  // 5. Update existing users' roles
  let updatedCount = 0;

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((row) =>
        updateUserRoleRepo(row.email.toLowerCase(), row.orgRole)
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

  return await getRegisteredUsersRepo(
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
  const { users, total } = await searchUsersRepo(query, page, limit);
  const totalPages = Math.ceil(total / limit);

  return {
    data: users.map(user => ({
      id:       user._id,
      name:     user.name,
      email:    user.email,
      orgRole:  user.orgRole,
      status:   user.status,
      mustChangePassword: user.mustChangePassword,
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

