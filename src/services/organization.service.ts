import { Types } from "mongoose";
import { OrganizationStatus } from "../constants/enum.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { bulkCreateOrganizations, createOrganization, findOneOrgBySlug, findOrgById, getOrganizationsRepo, updateOrganizationDetails, updateOrganizationPolicy } from "../repositories/organization.repository.js";
import { getUserByIdRepo, updateOneUser } from "../repositories/user.repository.js";
import { CreateOrganization } from "../types/organization.js";
import { AppError } from "../utils/appError.js";
import { buildOrganizationPolicy } from "../utils/buildOrganizationPolicy.js";
import { parseCsvBuffer } from "../utils/csvParser.js";
import { toObjectId } from "../utils/mongo.js";
import { organizationCsvRowSchema } from "../validators/organization.validator.js";
import { ENV } from "../config/env.js";

//Create org
export const createOrganizationService = async (
  data: CreateOrganization,
  creatingAdminId: string
) => {
  const existingOrganization =
    await findOneOrgBySlug(data.slug);

  if (existingOrganization) {
    throw new AppError(
      MESSAGES.ORG_EXIST,
      HTTP_STATUS.CONFLICT
    );
  }
  const org = await createOrganization(data);

  // Without this, the admin who just created the org has no orgId on their
  // own user record — every org-scoped route (bulk upload, policy update,
  // etc.) reads orgId straight off the JWT (see authenticate middleware),
  // and nothing else in the app ever assigns orgId to an admin account.
  await updateOneUser(toObjectId(creatingAdminId), { orgId: org._id } as any);

  return org;
};

// Whether THIS admin (not "any org in the system") has an org set up yet —
// drives the frontend's Bulk Import gating (admin/layout.tsx). Previously
// this endpoint didn't exist at all; the frontend's fetch failed and
// "failed open" to true unconditionally, so Bulk Import always looked
// unlocked even for an admin with no orgId, and the real error only
// surfaced later at actual upload time.
export const getOrganizationStatusService = async (adminId: string) => {
  const admin = await getUserByIdRepo(adminId);
  return { hasOrgPolicySetup: !!admin?.orgId, orgId: admin?.orgId ? String(admin.orgId) : null };
};

export const getOrganizationsService = async (
  page: number,
  limit: number,
  search: string,
  adminUserId: string
) => {
  const admin = await getUserByIdRepo(adminUserId);

  if (!admin?.orgId) {
    return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
  }

  const { organizations, total } = await getOrganizationsRepo(page, limit, search, admin.orgId as Types.ObjectId);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: organizations.map((org: any) => ({
      id: org._id,
      name: org.name,
      slug: org.slug,
      orgType: org.orgType,
      status: org.status,
      createdAt: org.createdAt,
    })),
    meta: { total, page, limit, totalPages },
  };
};


export const getAllOrganizationsService = async (
  page: number,
  limit: number,
  search: string,
  adminUserId: string
) => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.email || !ENV.SUPERADMIN_EMAILS.includes(admin.email.toLowerCase())) {
    throw new AppError(MESSAGES.USER_NO_PERMISSION, HTTP_STATUS.FORBIDDEN);
  }

  const { organizations, total } = await getOrganizationsRepo(page, limit, search);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: organizations.map((org: any) => ({
      id: org._id,
      name: org.name,
      slug: org.slug,
      orgType: org.orgType,
      status: org.status,
      createdAt: org.createdAt,
    })),
    meta: { total, page, limit, totalPages },
  };
};

const assertAdminOwnsOrg = async (organizationId: string, adminUserId: string) => {
  const admin = await getUserByIdRepo(adminUserId);
  if (!admin?.orgId || String(admin.orgId) !== String(organizationId)) {
    throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
};

const mapOrgToDetailDto = (org: any) => ({
  id: String(org._id),
  name: org.name,
  slug: org.slug,
  orgType: org.orgType,
  status: org.status,
  policy: org.policy,
  policyAssignments: org.policyAssignments,
  createdAt: org.createdAt,
});

export const getOrganizationByIdService = async (organizationId: string, adminUserId: string) => {
  await assertAdminOwnsOrg(organizationId, adminUserId);

  const org = await findOrgById(toObjectId(organizationId));
  if (!org) {
    throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return mapOrgToDetailDto(org);
};

export interface UpdateOrganizationDetailsInput {
  name?: string;
  slug?: string;
  orgType?: CreateOrganization["orgType"];
  status?: CreateOrganization["status"];
}

export const updateOrganizationDetailsService = async (
  organizationId: string,
  data: UpdateOrganizationDetailsInput,
  adminUserId: string
) => {
  await assertAdminOwnsOrg(organizationId, adminUserId);

  const update: UpdateOrganizationDetailsInput = { ...data };
  if (update.slug !== undefined) {
    const slug = update.slug.trim().toLowerCase();
    const existing = await findOneOrgBySlug(slug);
    if (existing && String((existing as any)._id) !== organizationId) {
      throw new AppError(MESSAGES.ORG_EXIST, HTTP_STATUS.CONFLICT);
    }
    update.slug = slug;
  }
  if (update.name !== undefined) {
    update.name = update.name.trim();
  }

  const updated = await updateOrganizationDetails(organizationId, update);
  if (!updated) {
    throw new AppError(MESSAGES.ORG_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  return mapOrgToDetailDto(updated);
};

// update organization policy

export const updateOrganizationPolicyService = async (
  organizationId: string,
  data: {
    policy?: CreateOrganization["policy"];
    policyAssignments?: CreateOrganization["policyAssignments"];
  },
  adminUserId: string
) => {
  await assertAdminOwnsOrg(organizationId, adminUserId);

  await updateOrganizationPolicy(
    organizationId,
    data
  );
};

//bulk upload organization

export const bulkUploadOrganizationService = async (
  file: Express.Multer.File
) => {
  const rows = await parseCsvBuffer(file.buffer);

  // Empty file validation
  if (!rows.length) {
    throw new AppError(
      MESSAGES.CSV_EMPTY,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Validate every row
  const validatedRows = rows.map(
    (row, index) => {
      const result =
        organizationCsvRowSchema.safeParse(
          row
        );

      if (!result.success) {
        const errors =
          result.error.issues
            .map(
              (issue) =>
                `${ issue.path.join(".") } : ${ issue.message
                }`
            )
            .join(", ");

        throw new AppError(
          `Row ${ index + 2 }: ${ errors }`,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      return result.data;
    }
  );

  // Duplicate slug validation inside CSV
  const slugs = validatedRows.map((row) =>
    row.slug.toLowerCase()
  );

  const uniqueSlugs = new Set(slugs);

  if (uniqueSlugs.size !== slugs.length) {
    throw new AppError(
      MESSAGES.DUP_SLUG_FOUND,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const organizations = validatedRows.map((row) => ({
    name: row.name,
    slug: row.slug.toLowerCase(),

    orgType: row.orgType,

    status:
      row.status ??
      OrganizationStatus.ACTIVE,

    policy: buildOrganizationPolicy(row)
  }));

  await bulkCreateOrganizations(
    organizations
  );
};