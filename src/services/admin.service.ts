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
  bulkWriteUsersRepo,
} from "../repositories/user.repository.js";
import UploadJob from "../models/uploadJob.model.js";
import { uploadQueue } from "../queue/bullConfig.js";
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

const parseBulkUploadFile = async (file: { originalname: string; buffer: Buffer }) => {
  if (file.originalname.endsWith(".csv")) {
    return await parseCsvBuffer(file.buffer);
  }
  if (file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
    return await parseExcelBuffer(file.buffer);
  }
  throw new AppError("Unsupported file type", 400);
};

const MANAGER_EMAIL_COLUMNS = [
  ["Reporting Manager Email", true],
  ["Skip Level 1 Manager Email", false],
  ["Skip Level 2 Manager Email", false],
] as const;

const BULK_WRITE_CHUNK_SIZE = 200;

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

type BulkRowPlan = {
  row: any;
  payload: ReturnType<typeof mapSpreadsheetEmployee>;
  isUpdate: boolean;
  existingId?: any;
};

export const processBulkUserRows = async (
  rows: any[],
  org: any,
  onProgress?: (progressPercent: number) => Promise<void>
) => {
  const defaultPassword = await bcrypt.hash(DEFAULT_PASSWORD_PLAINTEXT, 10);
  const skipped: { email?: string; employeeCode?: string; error: string }[] = [];

  const emailsInFile = new Set(
    rows.map((r: any) => r.Email?.toString().trim().toLowerCase()).filter(Boolean)
  );

  const referencedEmails = new Set<string>();
  for (const row of rows) {
    const own = row.Email?.toString().trim().toLowerCase();
    if (own) referencedEmails.add(own);
    for (const [column] of MANAGER_EMAIL_COLUMNS) {
      const email = row[column]?.toString().trim().toLowerCase();
      if (email) referencedEmails.add(email);
    }
  }

  const existingUsers = referencedEmails.size > 0 ? await getUsersByEmailsRepo([...referencedEmails]) : [];
  const byEmail = new Map<string, any>(existingUsers.map((u) => [u.email, u]));

  const managerRefResolves = (email: unknown): boolean => {
    if (!email) return true;
    const normalized = String(email).trim().toLowerCase();
    if (emailsInFile.has(normalized)) return true;
    const match = byEmail.get(normalized);
    return !!match && String(match.orgId) === String(org._id);
  };

  const plans: BulkRowPlan[] = [];
  const seenNewEmails = new Set<string>();
  const updatePlansByEmail = new Map<string, BulkRowPlan>();

  for (const row of rows) {
    try {
      const payload = mapSpreadsheetEmployee(row, org, defaultPassword);

      if (!payload.email) {
        throw new Error("Missing or invalid email");
      }
      if (!payload.name) {
        throw new Error("Name of the employee is required");
      }

      // Reporting Manager Email is mandatory — every uploaded person must
      // have a direct manager, no top-of-chain exceptions via bulk upload.
      // Skip Level 1/2 remain optional, but must resolve if given.
      for (const [column, required] of MANAGER_EMAIL_COLUMNS) {
        const managerEmail = row[column];
        if (!managerEmail) {
          if (required) throw new Error(`${column} is required`);
          continue;
        }
        if (!managerRefResolves(managerEmail)) {
          throw new Error(`${column} "${managerEmail}" does not match any existing user or row in this file`);
        }
      }

      const existing = byEmail.get(payload.email);
      if (existing) {
        if (existing.orgRole !== ORG_ROLE.EMPLOYEE && existing.orgRole !== ORG_ROLE.MANAGER) {
          throw new Error(`Email "${payload.email}" belongs to a ${existing.orgRole} account and cannot be modified via bulk upload`);
        }
        if (existing.orgId && String(existing.orgId) !== String(org._id)) {
          throw new Error(`Email "${payload.email}" already belongs to a user in another organization`);
        }
        const priorDuplicate = updatePlansByEmail.get(payload.email);
        if (priorDuplicate) {
          skipped.push({
            email: priorDuplicate.row.Email,
            employeeCode: priorDuplicate.row["Employee Roll No."],
            error: `Email "${payload.email}" appears more than once in this file — only the last occurrence was applied`,
          });
        }
        updatePlansByEmail.set(payload.email, { row, payload, isUpdate: true, existingId: existing._id });
      } else {
        if (seenNewEmails.has(payload.email)) {
          throw new Error(`Email "${payload.email}" appears more than once in this file for a new employee — only the first occurrence was processed`);
        }
        seenNewEmails.add(payload.email);
        plans.push({ row, payload, isUpdate: false });
      }
    } catch (err: any) {
      skipped.push({ email: row.Email, employeeCode: row["Employee Roll No."], error: friendlyBatchRowError(err, row) });
    }
  }
  plans.push(...updatePlansByEmail.values());

  const resolvedIds = new Map<string, any>(existingUsers.map((u) => [u.email, u._id]));
  const succeeded: BulkRowPlan[] = [];
  let createdCount = 0;
  let updatedCount = 0;

  const applyChunkResult = (
    batch: BulkRowPlan[],
    result: any,
    writeErrorsByIndex: Map<number, any>
  ) => {
    const validationResults: any[] = result?.mongoose?.results ?? [];
    const insertedIds: Record<number, any> = result?.insertedIds ?? {};

    let sentIndex = 0;   
    let insertCursor = 0;

    batch.forEach((plan, originalIndex) => {
      const validationError = validationResults[originalIndex];
      if (validationError) {
        skipped.push({ email: plan.row.Email, employeeCode: plan.row["Employee Roll No."], error: friendlyBatchRowError(validationError, plan.row) });
        return;
      }

      const writeError = writeErrorsByIndex.get(sentIndex++);
      if (writeError) {
        skipped.push({ email: plan.row.Email, employeeCode: plan.row["Employee Roll No."], error: friendlyBatchRowError(writeError, plan.row) });
        return;
      }

      if (plan.isUpdate) {
        updatedCount++;
        resolvedIds.set(plan.payload.email, plan.existingId);
      } else {
        createdCount++;
        resolvedIds.set(plan.payload.email, insertedIds[insertCursor++]);
      }
      succeeded.push(plan);
    });
  };


  const writeChunks = chunkArray(plans, BULK_WRITE_CHUNK_SIZE);
  for (let c = 0; c < writeChunks.length; c++) {
    const batch = writeChunks[c];
    const ops = batch.map((plan) => {
      if (plan.isUpdate) {
        const { passwordHash, mustChangePassword, ...detailPayload } = plan.payload;
        return { updateOne: { filter: { _id: plan.existingId }, update: { $set: { ...detailPayload, isApproved: true } } } };
      }
      return { insertOne: { document: { ...plan.payload, isApproved: true } } };
    });

    try {
      const result: any = await bulkWriteUsersRepo(ops);
      applyChunkResult(batch, result, new Map());
    } catch (err: any) {
      if (!err.writeErrors?.length && !err.mongoose?.results) {
        const message = friendlyBatchRowError(err, {});
        batch.forEach((plan) => {
          skipped.push({ email: plan.row.Email, employeeCode: plan.row["Employee Roll No."], error: `Batch write failed: ${message}` });
        });
        if (onProgress) await onProgress(Math.round(((c + 1) / Math.max(writeChunks.length, 1)) * 50));
        continue;
      }

      const writeErrorsByIndex = new Map<number, any>((err.writeErrors || []).map((e: any) => [e.index, e]));
      applyChunkResult(batch, err, writeErrorsByIndex);
    }

    if (onProgress) await onProgress(Math.round(((c + 1) / Math.max(writeChunks.length, 1)) * 50));
  }

  const newHireEmails = succeeded.filter((plan) => !plan.isUpdate);
  const EMAIL_BATCH_SIZE = 20;
  (async () => {
    for (const batch of chunkArray(newHireEmails, EMAIL_BATCH_SIZE)) {
      await Promise.allSettled(
        batch.map((plan) =>
          sendWelcomeMail(plan.payload.email, plan.payload.name || plan.payload.email, DEFAULT_PASSWORD_PLAINTEXT)
            .catch(logMailFailure("welcome-bulk-upload"))
        )
      );
    }
  })();

  for (const plan of succeeded) {
    const { trainingDept, osd } = plan.payload.officeRoles;
    if (!trainingDept.enabled && !osd.enabled) continue;
    const id = resolvedIds.get(plan.payload.email);
    if (!id) {
      console.error(`[batchCreateUsers] skipping office-role enforcement for ${plan.payload.email} — no resolved id`);
      continue;
    }
    await enforceSingleOfficeRoleHolder(org._id as Types.ObjectId, id, plan.payload.officeRoles);
  }

  const existingUsersById = new Map(existingUsers.map((u) => [String(u._id), u]));
  const resolveManagerRef = (id: any): { _id: any } | null => {
    if (!id) return null;
    const existing = existingUsersById.get(String(id));
    if (existing) {
      return String(existing.orgId) === String(org._id) ? existing : null;
    }
    return { _id: id };
  };

  const hierarchyChunks = chunkArray(succeeded, BULK_WRITE_CHUNK_SIZE);
  for (let c = 0; c < hierarchyChunks.length; c++) {
    const batch = hierarchyChunks[c];
    const ops = batch.map((plan) => {
      const employeeId = resolvedIds.get(plan.payload.email);
      const reportingManagerId = resolvedIds.get(String(plan.row["Reporting Manager Email"] || "").trim().toLowerCase());
      const skip1Id = resolvedIds.get(String(plan.row["Skip Level 1 Manager Email"] || "").trim().toLowerCase());
      const skip2Id = resolvedIds.get(String(plan.row["Skip Level 2 Manager Email"] || "").trim().toLowerCase());

      const reportingManager = resolveManagerRef(reportingManagerId);
      const skip1 = resolveManagerRef(skip1Id);
      const skip2 = resolveManagerRef(skip2Id);

      return {
        updateOne: {
          filter: { _id: employeeId },
          update: { $set: { hierarchy: mapEmployeeHierarchy(reportingManager, skip1, skip2) } },
        },
      };
    });

    try {
      await bulkWriteUsersRepo(ops);
    } catch (err: any) {
      console.error(`[batchCreateUsers] hierarchy link failed for a chunk:`, err?.message || err);
    }

    if (onProgress) await onProgress(50 + Math.round(((c + 1) / Math.max(hierarchyChunks.length, 1)) * 50));
  }

  if (skipped.length > 0) {
    console.error(`[batchCreateUsers] ${skipped.length} row(s) skipped:`, skipped);
  }

  return {
    createdCount,
    updatedCount,
    skippedCount: skipped.length,
    skippedEmails: skipped.map((s) => s.email).filter((e): e is string => !!e),
    skipped,
  };
};

const resolveAdminOrg = async (userId: string) => {
  const user = await getUserByIdRepo(userId);
  if (!user) {
    throw new AppError(MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  if (!user.orgId) {
    throw new AppError(MESSAGES.ORG_NOT_ADD_USER, HTTP_STATUS.NOT_FOUND);
  }
  const org = await findOrgById(user.orgId);
  if (!org) {
    throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  return { user, org };
};

export const batchCreateUsersService = async (
  file: Express.Multer.File, userId: string
) => {
  const rows = await parseBulkUploadFile(file);
  const { org } = await resolveAdminOrg(userId);
  return processBulkUserRows(rows, org);
};

export const createBulkUploadJobService = async (file: Express.Multer.File, userId: string) => {
  const rows = await parseBulkUploadFile(file);
  const { user, org } = await resolveAdminOrg(userId);

  const job = await UploadJob.create({
    status: "pending",
    totalRows: rows.length,
    fileName: file.originalname,
    fileBuffer: file.buffer,
    createdBy: user._id,
    orgId: org._id,
  });

  await uploadQueue.add({ jobId: String(job._id) }, { attempts: 1 });

  return { jobId: job._id };
};

export const processBulkUploadJobService = async (jobId: string, preParsedRows?: any[]) => {
  const job = await UploadJob.findById(jobId);
  if (!job) return;

  try {
    await UploadJob.updateOne({ _id: jobId }, { $set: { status: "processing", startedAt: new Date() } });

    const rows = preParsedRows ?? await parseBulkUploadFile({ originalname: job.fileName, buffer: job.fileBuffer });
    const org = await findOrgById(job.orgId);
    if (!org) {
      throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const result = await processBulkUserRows(rows, org, async (progressPercent) => {
      await UploadJob.updateOne(
        { _id: jobId },
        { $set: { processedRows: Math.round((progressPercent / 100) * job.totalRows) } }
      );
    });

    await UploadJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: "completed",
          processedRows: job.totalRows,
          createdCount: result.createdCount,
          updatedCount: result.updatedCount,
          skippedCount: result.skippedCount,
          skippedEmails: result.skippedEmails,
          skipped: result.skipped,
          completedAt: new Date(),
        },
      }
    );
  } catch (err: any) {
    await UploadJob.updateOne(
      { _id: jobId },
      { $set: { status: "failed", error: err?.message || "Bulk upload failed", completedAt: new Date() } }
    );
  }
};

export const getBulkUploadJobStatusService = async (jobId: string, userId: string) => {
  const job = await UploadJob.findById(jobId);
  if (!job || String(job.createdBy) !== String(userId)) {
    throw new AppError(MESSAGES.BULK_UPLOAD_JOB_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return {
    jobId: job._id,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    progress: job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0,
    createdCount: job.createdCount,
    updatedCount: job.updatedCount,
    skippedCount: job.skippedCount,
    skippedEmails: job.skippedEmails,
    skipped: job.skipped,
    error: job.error,
  };
};

export const reconcileOrphanedBulkUploadJobsService = async () => {
  const result = await UploadJob.updateMany(
    { status: { $in: ["pending", "processing"] } },
    { $set: { status: "failed", error: "Server restarted while this upload was processing.", completedAt: new Date() } }
  );
  if (result.modifiedCount > 0) {
    console.error(`[bulkUploadJob] marked ${result.modifiedCount} orphaned job(s) from a prior process as failed`);
  }
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

