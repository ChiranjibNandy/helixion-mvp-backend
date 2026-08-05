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
  getDistinctManagerIdsRepo,
} from "../repositories/user.repository.js";
import { AppError } from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ORG_ROLE, USER_STATUS } from "../constants/enum.js";
import { ENV } from "../config/env.js";
import { sendWelcomeMail } from "../utils/sendMail.js";
import { toObjectId } from "../utils/mongo.js";
import { parseCsvBuffer } from "../utils/csvParser.js";
import { findOrgById } from "../repositories/organization.repository.js";
import { parseExcelBuffer } from "../utils/parseExcelBuffer.js";
import { mapSpreadsheetEmployee } from "../utils/mapSpreadsheetEmployee.js";
import { mapEmployeeHierarchy } from "../utils/mapEmployeeHierarchy.js";



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
  file: Express.Multer.File, userId: string
) => {
  let rows;

  if (file.originalname.endsWith(".csv")) {
    rows = await parseCsvBuffer(file.buffer);
  } else if (
    file.originalname.endsWith(".xlsx") ||
    file.originalname.endsWith(".xls")
  ) {
    rows = await parseExcelBuffer(file.buffer);
  } else {
    throw new AppError("Unsupported file type", 400);
  }

  let created = 0;
  let updated = 0;
  const skipped: { email?: string; error: string }[] = [];

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
  // PASS 1 — one row failing (duplicate employeeCode, missing/invalid
  // email, etc.) must not abort every row after it in the same file.
  //-------------------------------------------------------

  for (const row of rows) {
    try {
      const payload = mapSpreadsheetEmployee(
        row,
        org,
        defaultPassword
      );

      if (!payload.email) {
        throw new Error("Missing or invalid email");
      }

      const existing = await getUserByEmailRepo(payload.email);

      if (existing) {
        await updateOneUser(existing._id, { ...payload, isApproved: true });
        updated++;
      } else {
        await createUserRepo({ ...payload, isApproved: true });
        created++;
      }
    } catch (err: any) {
      skipped.push({ email: row.Email, error: err?.message || "Unknown error" });
    }
  }


  for (const row of rows) {
    try {
      const employee = await getUserByEmailRepo(
        row.Email?.toLowerCase()
      );

      if (!employee) continue;

      const reportingManager = await getUserByEmailRepo(
        row["Reporting Manager Email"]?.toLowerCase()
      );

      const skip1 = await getUserByEmailRepo(
        row["Skip Level 1 Manager Email"]?.toLowerCase()
      );

      const skip2 = await getUserByEmailRepo(
        row["Skip Level 2 Manager Email"]?.toLowerCase()
      );

      await updateOneUser(employee._id, {
        hierarchy: mapEmployeeHierarchy(
          reportingManager,
          skip1,
          skip2
        ),
      });
    } catch (err: any) {
      // The employee row itself was already created/updated in PASS 1 above —
      // only the manager-chain linking failed, so this is logged rather than
      // added to `skipped` (which means "this person doesn't exist at all").
      console.error(`[batchCreateUsers] hierarchy link failed for ${row.Email}:`, err?.message || err);
    }
  }

  if (skipped.length > 0) {
    console.error(`[batchCreateUsers] ${skipped.length} row(s) skipped:`, skipped);
  }

  return {
    createdCount: created,
    updatedCount: updated,
    skippedCount: skipped.length,
    skippedEmails: skipped.map((s) => s.email).filter((e): e is string => !!e)
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

// "Manager", "CTD", and "OSD officer" are not orgRole values — every
// bulk-uploaded person is stored as orgRole: employee regardless of what
// they actually do (see officeRoles/hierarchy). Sending orgRole straight
// through here (as this used to) made every single row in the Deactivate
// Users table show "Employee", with no way to tell a CTD or manager apart
// from a plain employee. This derives a human-facing label instead —
// picks one label per user (a person can hold more than one of these at
// once, e.g. be both a Manager and a CTD; only the highest-priority one
// is shown).
const deriveDisplayRole = (user: any, managerIds: Set<string>): string => {
  if (user.orgRole !== ORG_ROLE.EMPLOYEE) {
    return user.orgRole === ORG_ROLE.TRAINING_PROVIDER ? "Training Provider" : "Admin";
  }
  if (user.officeRoles?.trainingDept?.enabled) {
    return user.officeRoles.trainingDept.level >= 2 ? "CTD" : "Training Dept Officer";
  }
  if (user.officeRoles?.osd?.enabled) {
    return user.officeRoles.osd.level >= 2 ? "OSD Senior" : "OSD Officer";
  }
  if (managerIds.has(String(user._id))) {
    return "Manager";
  }
  return "Employee";
};

export const searchUsersService = async (
  query: string,
  page: number,
  limit: number
) => {
  const [{ users, total }, managerIdList] = await Promise.all([
    searchUsersRepo(query, page, limit),
    getDistinctManagerIdsRepo(),
  ]);
  const managerIds = new Set(managerIdList);
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
      role: deriveDisplayRole(user, managerIds),
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

