import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";


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

  trainingDeptJuniorOfficer: z.boolean().optional(),
  trainingDeptSeniorOfficer: z.boolean().optional(),
  osdJuniorOfficer: z.boolean().optional(),
  osdSeniorOfficer: z.boolean().optional(),
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