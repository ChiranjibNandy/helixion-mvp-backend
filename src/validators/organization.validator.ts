import { z } from "zod";
import { AssignmentMode, OrganizationStatus, OrganizationType } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";
import { objectIdSchema } from "./common.validator.js";

const approvalPolicySchema = z.object({
  enabled: z.boolean(),
  levels: z.number().min(1),
  minLevelToApprove: z.number().min(1),
  assignmentMode: z.enum(Object.values(AssignmentMode)),
});

//create Organization validation

export const createOrganizationSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  orgType: z.enum(Object.values(OrganizationType)),
  status: z.enum(Object.values(OrganizationStatus)).default(OrganizationStatus.ACTIVE),
  policy: z.object({
    managerApproval: approvalPolicySchema,
    trainingDeptApproval: approvalPolicySchema,
    osdReview: approvalPolicySchema,
    tourForm: approvalPolicySchema,
    reimbursement: approvalPolicySchema
  }),
});

//Update organization validation

export const updatePolicySchema = z.object({
  policy: z
    .object({
      managerApproval: approvalPolicySchema.optional(),
      trainingDeptApproval: approvalPolicySchema.optional(),
      osdReview: approvalPolicySchema.optional(),
      tourForm:approvalPolicySchema,
      reimbursement: approvalPolicySchema
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      MESSAGES.MIN_POLICY
    ),
});



export const organizationCsvRowSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),

  orgType: z.enum(
    Object.values(OrganizationType)
  ),

  status: z
    .enum(
      Object.values(OrganizationStatus)
    )
    .optional(),

  managerLevels: z.coerce.number().min(1),
  managerMinLevel: z.coerce.number().min(1),

  trainingDeptLevels: z.coerce.number().min(1),
  trainingDeptMinLevel: z.coerce.number().min(1),

  osdLevels: z.coerce.number().min(1),
  osdMinLevel: z.coerce.number().min(1),

  tourFormLevels : z.coerce.number().min(1),
  tourFormMinLevel : z.coerce.number().min(1),

  reimbursementLevels : z.coerce.number().min(1),
  reimbursementMinLevel : z.coerce.number().min(1),
});

export const organizationIdParamSchema = z.object({
  organizationId: objectIdSchema,
});