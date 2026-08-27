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
  activateUserRepo,
  getUsersByEmailsRepo,
  batchCreateUsersRepo,
  searchUsersRepo,
  updateUserRoleRepo,
  getUserByEmailRepo,
  createUserRepo,
  updateOneUser,
  getDistinctManagerIdsRepo,
  getUsersByIdsRepo,
  getOrgUserStatsRepo,
  clearOtherOfficeRoleHoldersRepo,
  getRecentlyAddedUsersRepo,
} from "../repositories/user.repository.js";
import { Types } from "mongoose";
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

const enforceSingleOfficeRoleHolder = async (
  orgId: Types.ObjectId,
  userId: Types.ObjectId,
  officeRoles: { trainingDept: { enabled: boolean }; osd: { enabled: boolean } }
) => {
  if (officeRoles.trainingDept.enabled) {
    await clearOtherOfficeRoleHoldersRepo(orgId, "trainingDept", userId);
  }
  if (officeRoles.osd.enabled) {
    await clearOtherOfficeRoleHoldersRepo(orgId, "osd", userId);
  }
};
import { toObjectId } from "../utils/mongo.js";
import { parseCsvBuffer } from "../utils/csvParser.js";
import { findOrgById } from "../repositories/organization.repository.js";
import { parseExcelBuffer } from "../utils/parseExcelBuffer.js";
import { mapSpreadsheetEmployee } from "../utils/mapSpreadsheetEmployee.js";
import { mapEmployeeHierarchy, buildManagerChain } from "../utils/mapEmployeeHierarchy.js";
import { EmployeeDetailDto } from "../dtos/user.dto.js";



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
  description: string | undefined,
  approvingAdminId: string
) => {
  if (!Object.values(ORG_ROLE).includes(role as ORG_ROLE)) {
    throw new AppError(MESSAGES.INVALID_ROLE, HTTP_STATUS.BAD_REQUEST);
  }


  let orgId: Types.ObjectId | undefined;
  let employeeCode: string | undefined;
  if (role === ORG_ROLE.EMPLOYEE || role === ORG_ROLE.MANAGER) {
    const approvingAdmin = await getUserByIdRepo(approvingAdminId);
    if (!approvingAdmin?.orgId) {
      throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
    }
    orgId = approvingAdmin.orgId as Types.ObjectId;

    const pendingUser = await getUserByIdRepo(id);
    if (!pendingUser?.employeeCode) {
      employeeCode = `EMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  const updatedUser =
    await approveUserRepo(
      id,
      role,
      description,
      orgId,
      employeeCode
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

  if (user.status === USER_STATUS.INACTIVE || user.status === USER_STATUS.DEACTIVE) {
    throw new AppError(MESSAGES.USER_ALREADY_DEACTIVATED, HTTP_STATUS.CONFLICT);
  }

  await deactivateUserRepo(id);
};

export const activateUserService = async (
  id: string,
  requesterId: string
) => {
  const requester = await getUserByIdRepo(requesterId);
  if (!requester) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const user = await getUserByIdRepo(id);
  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // Same-org guard — an admin may only act on users in their own org.
  if (String(user.orgId) !== String(requester.orgId)) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (user.status === USER_STATUS.ACTIVE) {
    throw new AppError(MESSAGES.USER_ALREADY_ACTIVE, HTTP_STATUS.CONFLICT);
  }

  await activateUserRepo(id);
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
  trainingDeptSeniorOfficer?: boolean;
  osdSeniorOfficer?: boolean;
  isManager?: boolean;
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
    if (String(reportingManager.orgId) !== String(org._id)) {
      throw new AppError(MESSAGES.REPORTING_MANAGER_NOT_FOUND, HTTP_STATUS.BAD_REQUEST);
    }
  }

  const officeRoles = {
    trainingDept: {
      enabled: !!data.trainingDeptSeniorOfficer,
      level: data.trainingDeptSeniorOfficer ? 2 : 0,
    },
    osd: {
      enabled: !!data.osdSeniorOfficer,
      level: data.osdSeniorOfficer ? 2 : 0,
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
    orgRole: data.isManager ? ORG_ROLE.MANAGER : ORG_ROLE.EMPLOYEE,
    officeRoles,
    hierarchy: reportingManager
      ? { level: 1, managerId: reportingManager._id, managerChain: [{ userId: reportingManager._id, level: 0 }] }
      : { level: 0, managerChain: [] },
  } as any);

  await enforceSingleOfficeRoleHolder(org._id as Types.ObjectId, created._id as Types.ObjectId, officeRoles);

  sendWelcomeMail(created.email, created.name, DEFAULT_PASSWORD_PLAINTEXT)
    .catch(logMailFailure("welcome-single-user"));

  return {
    id: created._id,
    email: created.email,
    name: created.name,
  };
};

/// employee edit details

const mapEmployeeToDetailDto = (
  employee: any,
  managerChainEmails: { reportingManagerEmail: string | null; skip1Email: string | null; skip2Email: string | null }
): EmployeeDetailDto => ({
  id: String(employee._id),
  name: employee.name,
  email: employee.email,
  employeeCode: employee.employeeCode,
  mobile: employee.mobile,
  placeOfPosting: employee.placeOfPosting,
  designation: employee.designation,
  department: employee.department,
  orgRole: employee.orgRole,
  isManager: employee.orgRole === ORG_ROLE.MANAGER,
  status: employee.status,
  reportingManagerEmail: managerChainEmails.reportingManagerEmail,
  skip1Email: managerChainEmails.skip1Email,
  skip2Email: managerChainEmails.skip2Email,
  trainingDeptSeniorOfficer: !!employee.officeRoles?.trainingDept?.enabled,
  osdSeniorOfficer: !!employee.officeRoles?.osd?.enabled,
});


const resolveManagerChainEmails = async (
  employee: any
): Promise<{ reportingManagerEmail: string | null; skip1Email: string | null; skip2Email: string | null }> => {
  const chain: any[] = employee.hierarchy?.managerChain || [];
  const managerEntry = chain.find((m: any) => m.level === 0);
  const skip1Entry = chain.find((m: any) => m.level === 1);
  const skip2Entry = chain.find((m: any) => m.level === 2);

  const [manager, skip1, skip2] = await Promise.all([
    managerEntry ? getUserByIdRepo(String(managerEntry.userId)) : Promise.resolve(null),
    skip1Entry ? getUserByIdRepo(String(skip1Entry.userId)) : Promise.resolve(null),
    skip2Entry ? getUserByIdRepo(String(skip2Entry.userId)) : Promise.resolve(null),
  ]);

  return {
    reportingManagerEmail: manager?.email ?? null,
    skip1Email: skip1?.email ?? null,
    skip2Email: skip2?.email ?? null,
  };
};

export const getEmployeeByIdService = async (
  id: string,
  adminUserId: string
): Promise<EmployeeDetailDto> => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }

  const employee = await getUserByIdRepo(id);
  if (!employee) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // same org guard , admin may only view employees in their own org
  if (String(employee.orgId) !== String(admin.orgId)) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }


  if (employee.orgRole !== ORG_ROLE.EMPLOYEE && employee.orgRole !== ORG_ROLE.MANAGER) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const managerChainEmails = await resolveManagerChainEmails(employee);
  return mapEmployeeToDetailDto(employee, managerChainEmails);
};

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  employeeCode?: string;
  mobile?: string;
  placeOfPosting?: string;
  designation?: string;
  department?: string;
  reportingManagerEmail?: string;
  skip1Email?: string;
  skip2Email?: string;
  trainingDeptSeniorOfficer?: boolean;
  osdSeniorOfficer?: boolean;
  isManager?: boolean;
}

export const updateEmployeeService = async (
  id: string,
  data: UpdateEmployeeInput,
  adminUserId: string
): Promise<EmployeeDetailDto> => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }

  const employee = await getUserByIdRepo(id);
  if (!employee) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // same org guard , admin may only view employees in their own org
  if (String(employee.orgId) !== String(admin.orgId)) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (employee.orgRole !== ORG_ROLE.EMPLOYEE && employee.orgRole !== ORG_ROLE.MANAGER) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const update: Record<string, unknown> = {};

  if (data.name !== undefined) update.name = data.name.trim();
  if (data.employeeCode !== undefined) update.employeeCode = data.employeeCode.trim();
  if (data.mobile !== undefined) update.mobile = data.mobile.trim();
  if (data.placeOfPosting !== undefined) update.placeOfPosting = data.placeOfPosting.trim();
  if (data.designation !== undefined) update.designation = data.designation.trim();
  if (data.department !== undefined) update.department = data.department.trim();
  if (data.isManager !== undefined) {
    update.orgRole = data.isManager ? ORG_ROLE.MANAGER : ORG_ROLE.EMPLOYEE;
  }

  if (data.email !== undefined) {
    const email = data.email.trim().toLowerCase();
    if (email !== employee.email) {

      const existing = await getUserByEmailRepo(email);
      if (existing && String(existing._id) !== id) {
        throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
      }
      update.email = email;
    }
  }


  const resolveManagerLevel = async (
    provided: string | undefined,
    existingEntry: { userId: any } | undefined,
    notFoundMessage: string
  ): Promise<{ _id: any; email: string } | null> => {
    if (provided === undefined) {
      if (!existingEntry) return null;
      const existingUser = await getUserByIdRepo(String(existingEntry.userId));
      return existingUser ? { _id: existingUser._id, email: existingUser.email } : null;
    }

    const email = provided.trim().toLowerCase();
    if (!email) return null; // explicitly cleared

    const manager = await getUserByEmailRepo(email);
    if (!manager) {
      throw new AppError(notFoundMessage, HTTP_STATUS.BAD_REQUEST);
    }
    if (String(manager._id) === id) {
      throw new AppError(MESSAGES.CANNOT_BE_OWN_MANAGER, HTTP_STATUS.BAD_REQUEST);
    }

    if (String(manager.orgId) !== String(employee.orgId)) {
      throw new AppError(notFoundMessage, HTTP_STATUS.BAD_REQUEST);
    }

    return { _id: manager._id, email: manager.email };
  };

  let managerChainEmails: { reportingManagerEmail: string | null; skip1Email: string | null; skip2Email: string | null } | null = null;
  if (data.reportingManagerEmail !== undefined || data.skip1Email !== undefined || data.skip2Email !== undefined) {
    const chain: any[] = employee.hierarchy?.managerChain || [];
    const managerEntry = chain.find((m: any) => m.level === 0);
    const skip1Entry = chain.find((m: any) => m.level === 1);
    const skip2Entry = chain.find((m: any) => m.level === 2);

    const reportingManager = await resolveManagerLevel(data.reportingManagerEmail, managerEntry, MESSAGES.REPORTING_MANAGER_NOT_FOUND);
    const skip1 = await resolveManagerLevel(data.skip1Email, skip1Entry, MESSAGES.SKIP1_MANAGER_NOT_FOUND);
    const skip2 = await resolveManagerLevel(data.skip2Email, skip2Entry, MESSAGES.SKIP2_MANAGER_NOT_FOUND);

    update.hierarchy = buildManagerChain({ reportingManager, skip1, skip2 });
    managerChainEmails = {
      reportingManagerEmail: reportingManager?.email ?? null,
      skip1Email: skip1?.email ?? null,
      skip2Email: skip2?.email ?? null,
    };
  }

  const trainingDeptTouched = data.trainingDeptSeniorOfficer !== undefined;
  const osdTouched = data.osdSeniorOfficer !== undefined;

  if (trainingDeptTouched || osdTouched) {
    const currentTrainingDept = employee.officeRoles?.trainingDept;
    const currentOsd = employee.officeRoles?.osd;

    update.officeRoles = {
      trainingDept: trainingDeptTouched
        ? { enabled: !!data.trainingDeptSeniorOfficer, level: data.trainingDeptSeniorOfficer ? 2 : 0 }
        : currentTrainingDept,
      osd: osdTouched
        ? { enabled: !!data.osdSeniorOfficer, level: data.osdSeniorOfficer ? 2 : 0 }
        : currentOsd,
    };
  }

  const updated = await updateOneUser(toObjectId(id), update as any);
  if (!updated) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  if (update.officeRoles && employee.orgId) {
    await enforceSingleOfficeRoleHolder(
      employee.orgId as Types.ObjectId,
      toObjectId(id),
      update.officeRoles as { trainingDept: { enabled: boolean }; osd: { enabled: boolean } }
    );
  }

  if (!managerChainEmails) {
    managerChainEmails = await resolveManagerChainEmails(updated);
  }

  return mapEmployeeToDetailDto(updated, managerChainEmails);
};

/// batch create service

const friendlyBatchRowError = (err: any, row: any): string => {
  const message: string = err?.message || "Unknown error";

  if (err?.code === 11000 || /E11000/.test(message)) {
    if (/employeeCode/.test(message)) {
      const rollNo = row?.["Employee Roll No."] ?? "";
      return `Employee Roll No. "${rollNo}" is already used by another employee in this org — use a unique Roll No.`;
    }
    if (/email/i.test(message)) {
      return `Email "${row?.Email ?? ""}" is already in use by another employee.`;
    }
    return "A duplicate value conflicts with an existing employee record.";
  }

  return message;
};

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

  
  const skipped: { email?: string; employeeCode?: string; error: string }[] = [];

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

  const managerRefResolves = async (email: unknown): Promise<boolean> => {
    if (!email) return true;
    const normalized = String(email).trim().toLowerCase();
    if (emailsInFile.has(normalized)) return true;
    const match = await getUserByEmailRepo(normalized);
    return !!match && String(match.orgId) === String(org._id);
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

        if (existing.orgRole !== ORG_ROLE.EMPLOYEE && existing.orgRole !== ORG_ROLE.MANAGER) {
          throw new Error(`Email "${payload.email}" belongs to a ${existing.orgRole} account and cannot be modified via bulk upload`);
        }
        if (existing.orgId && String(existing.orgId) !== String(org._id)) {
          throw new Error(`Email "${payload.email}" already belongs to a user in another organization`);
        }
        const { passwordHash, mustChangePassword, ...detailPayload } = payload;
        await updateOneUser(existing._id, { ...detailPayload, isApproved: true });
        updated++;
        await enforceSingleOfficeRoleHolder(org._id as Types.ObjectId, existing._id as Types.ObjectId, payload.officeRoles);
      } else {
        const createdRow = await createUserRepo({ ...payload, isApproved: true });
        created++;
        await enforceSingleOfficeRoleHolder(org._id as Types.ObjectId, createdRow._id as Types.ObjectId, payload.officeRoles);
        // Only brand-new rows get the welcome email — an existing employee
        // being updated (e.g. role/office-role change) already has an
        // account and a real password; resending "here's your password"
        // would be wrong for them.
        sendWelcomeMail(payload.email, payload.name || payload.email, DEFAULT_PASSWORD_PLAINTEXT)
          .catch(logMailFailure("welcome-bulk-upload"));
      }
    } catch (err: any) {
      skipped.push({ email: row.Email, employeeCode: row["Employee Roll No."], error: friendlyBatchRowError(err, row) });
    }
  }

  const inSameOrg = (user: any) => (user && String(user.orgId) === String(org._id) ? user : null);

  for (const row of rows) {
    try {
      const employee = await getUserByEmailRepo(
        row.Email?.toLowerCase()
      );

      if (!employee) continue;

      const reportingManager = inSameOrg(await getUserByEmailRepo(
        row["Reporting Manager Email"]?.toLowerCase()
      ));

      const skip1 = inSameOrg(await getUserByEmailRepo(
        row["Skip Level 1 Manager Email"]?.toLowerCase()
      ));

      const skip2 = inSameOrg(await getUserByEmailRepo(
        row["Skip Level 2 Manager Email"]?.toLowerCase()
      ));

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
    skippedEmails: skipped.map((s) => s.email).filter((e): e is string => !!e),
    skipped,
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


const deriveDisplayRole = (user: any, managerIds: Set<string>): string => {
  if (user.orgRole === ORG_ROLE.ADMIN) {
    return "Admin";
  }
  if (user.orgRole === ORG_ROLE.TRAINING_PROVIDER) {
    return "Training Provider";
  }

  if (user.officeRoles?.trainingDept?.enabled) {
    return "CTD";
  }
  if (user.officeRoles?.osd?.enabled) {
    return "OSD Officer";
  }
  if (user.orgRole === ORG_ROLE.MANAGER || managerIds.has(String(user._id))) {
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


  const referencedManagerIds = new Set<string>();
  for (const user of users as any[]) {
    for (const entry of user.hierarchy?.managerChain || []) {
      if (entry?.userId) referencedManagerIds.add(String(entry.userId));
    }
    if (user.hierarchy?.managerId) referencedManagerIds.add(String(user.hierarchy.managerId));
  }
  const managerDocs = await getUsersByIdsRepo([...referencedManagerIds]);
  const byId = new Map(managerDocs.map((u: any) => [String(u._id), u]));
  const brief = (id: any) => {
    const u: any = byId.get(String(id));
    return u ? { name: u.name, email: u.email } : null;
  };
  const totalPages = Math.ceil(total / limit);

  return {
    // Field names here (username/role) match the frontend's UserSearchResult
    // contract (hooks/useUsersSearch.ts) — the model's real fields are
    // name/orgRole. Sending those raw previously left every user.username/
    // user.role read on the Deactivate User page as undefined, crashing on
    // any string method called on it (e.g. getInitials' .substring call).
    data: users.map((user: any) => {
      const chain: any[] = user.hierarchy?.managerChain || [];
      const at = (lvl: number) => {
        const entry = chain.find((m: any) => m.level === lvl);
        return entry ? brief(entry.userId) : null;
      };
      return {
        id: user._id,
        username: user.name,
        email: user.email,
        role: deriveDisplayRole(user, managerIds),
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // reporting chain (merged in from the former Employee Directory page)
        reportingManager: at(0) || (user.hierarchy?.managerId ? brief(user.hierarchy.managerId) : null),
        skipLevel1Manager: at(1),
        skipLevel2Manager: at(2),
      };
    }),
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};

/// ─── Admin dashboard stats ───────────────────────────────────────────────────
//
// Org-scoped counts for the admin dashboard cards. "Active today" was dropped —
// there's no last-login/last-active field on the user model to derive it from.

export const getAdminDashboardStatsService = async (adminUserId: string) => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }
  const orgId = String(admin.orgId);

  // recentActivity is scoped to "recently onboarded" only — see the doc
  // comment on getRecentlyAddedUsersRepo for why (no audit-log collection
  // exists to say what changed on a status update, only when a user was
  // created is unambiguous). Reuses deriveDisplayRole (below) so the label
  // matches exactly what the Deactivate/Employee Directory table already
  // calls that person, rather than a second, possibly-drifting role string.
  const [stats, recentUsers, managerIdList] = await Promise.all([
    getOrgUserStatsRepo(orgId),
    getRecentlyAddedUsersRepo(orgId, 8),
    getDistinctManagerIdsRepo(orgId),
  ]);

  const managerIds = new Set(managerIdList);
  const recentActivity = recentUsers.map((user: any) => ({
    id: String(user._id),
    title: `${user.name} joined as ${deriveDisplayRole(user, managerIds)}`,
    time: user.createdAt,
    type: "success" as const,
  }));

  return { ...stats, recentActivity };
};

