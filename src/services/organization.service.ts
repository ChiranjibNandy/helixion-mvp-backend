import { OrganizationStatus } from "../constants/enum.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { bulkCreateOrganizations, createOrganization, findOrganizationBySlug, findOrganizationsBySlugs, updateOrganizationPolicy } from "../repositories/organization.repository.js";
import { CreateOrganization } from "../types/organization.js";
import { AppError } from "../utils/appError.js";
import { buildOrganizationPolicy } from "../utils/buildOrganizationPolicy.js";
import { parseCsvBuffer } from "../utils/csvParser.js";
import { organizationCsvRowSchema } from "../validators/organization.validator.js";

//Create org
export const createOrganizationService = async (
  data: CreateOrganization
) => {
  const existingOrganization =
    await findOrganizationBySlug(data.slug);

  if (existingOrganization) {
    throw new AppError(
      MESSAGES.ORG_EXIST,
      HTTP_STATUS.CONFLICT
    );
  }
  await createOrganization(data);
};

// update organization policy

export const updateOrganizationPolicyService = async (
  organizationId: string,
  policy: CreateOrganization["policy"]
) => {
  await updateOrganizationPolicy(
    organizationId,
    policy
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