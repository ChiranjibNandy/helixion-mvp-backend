import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";
import { objectIdSchema } from "./common.validator.js";


export const approveUserParamsSchema = z.object({
  id: z
    .string()
    .min(1, MESSAGES.USER_ID_REQUIRED),
});


export const approveUserBodySchema = z.object({
  role: z
    .string()
    .min(1, MESSAGES.ROLE_REQUIRED),

  description: z
    .string()
    .optional(),
});

// Single-employee creation — the escape hatch for the one case bulk upload
// can no longer handle: a person with no manager (bulk upload now requires
// Reporting Manager Email on every row). Reporting manager here is
// deliberately optional — that's the whole point of this endpoint.
export const createSingleUserSchema = z.object({
  name: z.string().trim().min(1, MESSAGES.NAME_REQUIRED),

  email: z
    .string()
    .trim()
    .min(1, MESSAGES.EMAIL_REQUIRED)
    .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT })),

  employeeCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  placeOfPosting: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  reportingManagerEmail: z.string().trim().optional(),

  trainingDeptSeniorOfficer: z.boolean().optional(),
  osdSeniorOfficer: z.boolean().optional(),

  // Independent of CTD/OSD office roles — toggles orgRole between EMPLOYEE
  // and MANAGER only. Never used to grant admin/training_provider.
  isManager: z.boolean().optional(),
});

export const updateEmployeeParamsSchema = z.object({
  id: objectIdSchema,
});

export const bulkUploadJobParamsSchema = z.object({
  jobId: objectIdSchema,
});

export const updateEmployeeBodySchema = z.object({
  name: z.string().trim().min(1, MESSAGES.NAME_REQUIRED).optional(),

  email: z
    .string()
    .trim()
    .min(1, MESSAGES.EMAIL_REQUIRED)
    .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT }))
    .optional(),

  employeeCode: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  placeOfPosting: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  reportingManagerEmail: z.string().trim().optional(),
  skip1Email: z.string().trim().optional(),
  skip2Email: z.string().trim().optional(),

  trainingDeptSeniorOfficer: z.boolean().optional(),
  osdSeniorOfficer: z.boolean().optional(),

  isManager: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: MESSAGES.NO_FIELDS_TO_UPDATE,
});

export const batchCreateUsersBodySchema = z.object({
  users: z.array(
    z.object({
      email: z
        .string()
        .trim()
        .min(1, { error: MESSAGES.EMAIL_REQUIRED })
        .pipe(z.email({ error: MESSAGES.INVALID_EMAIL_FORMAT })),
      role: z
        .string()
        .min(1, MESSAGES.ROLE_REQUIRED),
      action: z
        .string()
        .optional()
        .default("approve"),
    })
  ).min(1).max(50),
});