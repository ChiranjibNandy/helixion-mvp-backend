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
import { logMailFailure } from "../utils/notification.util.js";

// Bulk upload and single-employee creation both hash this same default
// password for storage — kept as a separate plaintext constant so the
// welcome email can actually tell the new user what it is, without
// re-deriving/guessing it from the hash.
const DEFAULT_PASSWORD_PLAINTEXT = "Password@123";
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

  const requester = await getUserByIdRepo(requesterId);
  if (!requester) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const user = await getUserByIdRepo(id);

  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // An admin may only act on users in their own org — without this check,
  // any admin could deactivate any user in the system by ID, regardless of
  // which org either of them belongs to.
  if (String(user.orgId) !== String(requester.orgId)) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (user.status === USER_STATUS.DEACTIVE) {
    throw new AppError(MESSAGES.USER_ALREADY_DEACTIVATED, HTTP_STATUS.CONFLICT);
  }

  await deactivateUserRepo(id);
};


/// ─── Single user create service ────────────────────────────────────────────────
//
// Bulk upload requires every row to have a Reporting Manager Email, which
// makes it impossible to create the one person any org hierarchy needs at
// its root — someone with nobody above them. This is that escape hatch:
// reportingManagerEmail is optional here, on purpose.

export interface CreateSingleUserInput {
  name: string;
  email: string;
  employeeCode?: string;
  mobile?: string;
  placeOfPosting?: string;
  designation?: string;
  department?: string;
  reportingManagerEmail?: string;
  trainingDeptJuniorOfficer?: boolean;
  trainingDeptSeniorOfficer?: boolean;
  osdJuniorOfficer?: boolean;
  osdSeniorOfficer?: boolean;
}

export const createSingleUserService = async (
  data: CreateSingleUserInput,
  adminUserId: string
) => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  if (!admin.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }

  const org = await findOrgById(admin.orgId);
  if (!org) {
    throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const email = data.email.trim().toLowerCase();
  const existing = await getUserByEmailRepo(email);
  if (existing) {
    throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  let reportingManager = null;
  if (data.reportingManagerEmail) {
    reportingManager = await getUserByEmailRepo(data.reportingManagerEmail.trim().toLowerCase());
    if (!reportingManager) {
      throw new AppError(MESSAGES.REPORTING_MANAGER_NOT_FOUND, HTTP_STATUS.BAD_REQUEST);
    }
  }

  const officeRoles = {
    trainingDept: {
      enabled: !!(data.trainingDeptJuniorOfficer || data.trainingDeptSeniorOfficer),
      level: data.trainingDeptSeniorOfficer ? 2 : data.trainingDeptJuniorOfficer ? 1 : 0,
    },
    osd: {
      enabled: !!(data.osdJuniorOfficer || data.osdSeniorOfficer),
      level: data.osdSeniorOfficer ? 2 : data.osdJuniorOfficer ? 1 : 0,
    },
  };

  const defaultPassword = await bcrypt.hash(DEFAULT_PASSWORD_PLAINTEXT, 10);

  // The {orgId, employeeCode} unique index treats a missing employeeCode as
  // colliding across different users in the same org (the live index isn't
  // actually sparse, despite the schema declaring it that way — likely
  // created before that option was added and never rebuilt). Always supply
  // a value rather than relying on sparseness to exclude it.
  const employeeCode = data.employeeCode?.trim() || `EMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const created = await createUserRepo({
    orgId: org._id,
    orgType: org.orgType,
    employeeCode,
    name: data.name.trim(),
    email,
    mobile: data.mobile?.trim() || "",
    placeOfPosting: data.placeOfPosting?.trim() || "",
    designation: data.designation?.trim() || "",
    department: data.department?.trim() || "",
    passwordHash: defaultPassword,
    mustChangePassword: true,
    isApproved: true,
    orgRole: ORG_ROLE.EMPLOYEE,
    officeRoles,
    hierarchy: reportingManager
      ? { level: 1, managerId: reportingManager._id, managerChain: [{ userId: reportingManager._id, level: 0 }] }
      : { level: 0, managerChain: [] },
  } as any);

  sendWelcomeMail(created.email, created.name, DEFAULT_PASSWORD_PLAINTEXT)
    .catch(logMailFailure("welcome-single-user"));

  return {
    id: created._id,
    email: created.email,
    name: created.name,
  };
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

  const defaultPassword = await bcrypt.hash(DEFAULT_PASSWORD_PLAINTEXT, 10);
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


  // Every email in this file, collected up front — lets a manager
  // reference resolve to another row in the SAME upload regardless of
  // which order the rows appear in (Pass 1 hasn't created that row yet
  // if it comes later in the file, but its email is already known here).
  const emailsInFile = new Set(
    rows
      .map((r: any) => r.Email?.toString().trim().toLowerCase())
      .filter(Boolean)
  );

  // A manager reference is valid if it's blank (no manager required — a
  // top-of-chain person legitimately has none), matches another row in
  // this file, or matches a user who already exists in the org from a
  // prior upload. Anything else doesn't resolve to anyone, ever.
  const managerRefResolves = async (email: unknown): Promise<boolean> => {
    if (!email) return true;
    const normalized = String(email).trim().toLowerCase();
    if (emailsInFile.has(normalized)) return true;
    return !!(await getUserByEmailRepo(normalized));
  };

  //-------------------------------------------------------
  // PASS 1 — one row failing (duplicate employeeCode, missing/invalid
  // email, unresolvable manager reference, etc.) must not abort every row
  // after it in the same file.
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

      // Reporting Manager Email is mandatory — every uploaded person must
      // have a direct manager, no top-of-chain exceptions via bulk upload.
      // Skip Level 1/2 remain optional, but must resolve if given.
      if (!row["Reporting Manager Email"]) {
        throw new Error("Reporting Manager Email is required");
      }

      for (const [label, managerEmail] of [
        ["Reporting Manager Email", row["Reporting Manager Email"]],
        ["Skip Level 1 Manager Email", row["Skip Level 1 Manager Email"]],
        ["Skip Level 2 Manager Email", row["Skip Level 2 Manager Email"]],
      ] as const) {
        if (managerEmail && !(await managerRefResolves(managerEmail))) {
          throw new Error(`${label} "${managerEmail}" does not match any existing user or row in this file`);
        }
      }

      const existing = await getUserByEmailRepo(payload.email);

      if (existing) {
        await updateOneUser(existing._id, { ...payload, isApproved: true });
        updated++;
      } else {
        await createUserRepo({ ...payload, isApproved: true });
        created++;
        // Only brand-new rows get the welcome email — an existing employee
        // being updated (e.g. role/office-role change) already has an
        // account and a real password; resending "here's your password"
        // would be wrong for them.
        sendWelcomeMail(payload.email, payload.name || payload.email, DEFAULT_PASSWORD_PLAINTEXT)
          .catch(logMailFailure("welcome-bulk-upload"));
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
  search: string,
  adminUserId: string
) => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }

  const { users, pagination } = await getRegisteredUsersRepo(
    page,
    limit,
    search,
    String(admin.orgId)
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
  limit: number,
  adminUserId: string
) => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }
  const orgId = String(admin.orgId);

  const [{ users, total }, managerIdList] = await Promise.all([
    searchUsersRepo(query, page, limit, orgId),
    getDistinctManagerIdsRepo(orgId),
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

