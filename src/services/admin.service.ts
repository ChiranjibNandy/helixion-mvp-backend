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
  getUserByEmailRepo,
  createUserRepo,
  updateOneUser,
} from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ORG_ROLE, USER_STATUS } from "../constants/enum.js";
import { ENV } from "../config/env.js";
import { sendWelcomeMail } from "../utils/sendMail.js";
import { toObjectId } from "../utils/mongo.js";
import { parseCsvBuffer } from "../utils/csvParser.js";
import { findOrgById } from "../repositories/organization.repository.js";



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
    throw new AppError(MESSAGES.CANNOT_DEACTIVATE_SELF, HTTP_STATUS.CONFLICT);
  }

  const user = await getUserByIdRepo(id);

  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (user.status === USER_STATUS.DEACTIVE) {
    throw new AppError(MESSAGES.USER_ALREADY_DEACTIVATED, HTTP_STATUS.CONFLICT);
  }

  await deactivateUserRepo(id);
};


/// ─── Batch create service ──────────────────────────────────────────────────────

export const batchCreateUsersService = async (
  buffer: Buffer, userId: string
) => {
  const rows = await parseCsvBuffer(buffer);

  let created = 0;
  let updated = 0;

  const defaultPassword = await bcrypt.hash("Password@123", 10);
  const user = await getUserByIdRepo(userId)
  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND)
  }
  if (!user.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND)
  }

  const org = await findOrgById(user.orgId)
  if (!org) {
    throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND)
  }


  //-------------------------------------------------------
  // PASS 1
  //-------------------------------------------------------

  for (const row of rows) {

    row.orgId = org._id


    const officeRoles = {
      trainingDept: {
        enabled: false,
        level: 0
      },
      osd: {
        enabled: false,
        level: 0
      }
    };

    //------------------------------------------------
    // Training Junior
    //------------------------------------------------

    if (row["Training Department Junior Officer"]?.trim()?.toLowerCase() === "yes") {

      officeRoles.trainingDept.enabled = true;
      officeRoles.trainingDept.level = 1;
    }

    //------------------------------------------------

    if (row["Training Department Senior Officer"]?.trim()?.toLowerCase() === "yes") {

      officeRoles.trainingDept.enabled = true;
      officeRoles.trainingDept.level = 2;
    }

    //------------------------------------------------

    if (row["OSD Team Junior Officer"]?.trim()?.toLowerCase() === "yes") {

      officeRoles.osd.enabled = true;
      officeRoles.osd.level = 1;
    }

    //------------------------------------------------

    if (row["OSD Team Senior Officer"]?.trim()?.toLowerCase() === "yes") {

      officeRoles.osd.enabled = true;
      officeRoles.osd.level = 2;
    }

    const payload = {

      orgId: org._id,
      orgType: org.orgType,

      employeeCode: row["Employee Roll No."],

      name: row["Name of the employee"],

      email: row.Email.toLowerCase(),

      mobile: row.Mobile,

      placeOfPosting: row["Place of Posting"],

      designation: row.Designation || "",

      department: row.Department || "",

      passwordHash: defaultPassword,

      mustChangePassword: true,

      orgRole: ORG_ROLE.EMPLOYEE,

      officeRoles
    };

    const existing = await getUserByEmailRepo(payload.email);

    if (existing) {

      await updateOneUser(
        existing._id,
        payload
      );

      updated++;

    } else {

      await createUserRepo(payload);

      created++;
    }
  }


  for (const row of rows) {

    const employee = await getUserByEmailRepo(row.Email.toLowerCase());

    if (!employee) continue;

    const reportingManager = await getUserByEmailRepo(row["Reporting Manager Email"]?.toLowerCase());

    const skip1 = await getUserByEmailRepo(row["Skip Level 1 Manager Email"]?.toLowerCase());

    const skip2 = await getUserByEmailRepo(row["Skip Level 2 Manager Email"]?.toLowerCase());

    const managerChain: any[] = [];

    if (reportingManager) {

      managerChain.push({
        userId: reportingManager._id,
        level: 0
      });
    }

    if (skip1) {

      managerChain.push({
        userId: skip1._id,
        level: 1
      });
    }

    if (skip2) {

      managerChain.push({
        userId: skip2._id,
        level: 2
      });
    }

    await updateOneUser(
      employee._id,
      {
        hierarchy: {
          level: managerChain.length,
          managerId: reportingManager?._id,
          managerChain
        }
      }
    );
  }
  return {
    createdCount: created,
    updatedCount: updated,
    skippedCount: 0,
    skippedEmails: []
  };
};


//get all user
export const getUsersService = async (
  page: number,
  limit: number,
  search: string
) => {

  const { users, pagination } = await getRegisteredUsersRepo(
    page,
    limit,
    search
  );

  // Maps to `username` here, matching the frontend's table column (hooks/useUser.ts
  // reads row.username) — the model's real field is `name`.
  return {
    users: users.map((user: any) => ({
      _id: user._id,
      username: user.name,
      email: user.email,
    })),
    pagination,
  };

};

export const searchUsersService = async (
  query: string,
  page: number,
  limit: number
) => {
  const { users, total } = await searchUsersRepo(query, page, limit);
  const totalPages = Math.ceil(total / limit);

  return {
    // Field names here (username/role) match the frontend's UserSearchResult
    // contract (hooks/useUsersSearch.ts) — the model's real fields are
    // name/orgRole. Sending those raw previously left every user.username/
    // user.role read on the Deactivate User page as undefined, crashing on
    // any string method called on it (e.g. getInitials' .substring call).
    data: users.map(user => ({
      id: user._id,
      username: user.name,
      email: user.email,
      role: user.orgRole,
      status: user.status,
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

