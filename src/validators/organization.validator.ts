import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";
import { ASSIGNMENT_MODE, ORGANIZATION_STATUS, ORGANIZATION_TYPE, REVIEW_MODE } from "../constants/enum.js";

const managerApprovalSchema = z.object({
   enabled: z.boolean(),
   levels: z.number().min(1, {
      message: MESSAGES.LEVEL_MIN
   }),
   minLevelToApprove: z.number().min(1, {
      message: MESSAGES.MIN_LEVEL_TO_APPROVE
   }),
   allowRecommendOnlyAtLowerLevels: z.boolean(),
});

const trainingDeptApprovalSchema = z.object({
   enabled: z.boolean(),
   reviewMode: z.enum(Object.values(REVIEW_MODE)),
   juniorCanApprove: z.boolean(),
   seniorCanApprove: z.boolean(),
   assignmentMode: z.enum(Object.values(ASSIGNMENT_MODE)),
});

const osdReviewSchema = z.object({
   enabled: z.boolean(),
   reviewMode: z.enum(Object.values(REVIEW_MODE)),
   juniorCanApprove: z.boolean(),
   seniorCanApprove: z.boolean(),
   assignmentMode: z.enum(Object.values(ASSIGNMENT_MODE)),
});

const tourFormSchema = z.object({
   enabled: z.boolean(),
   autoCreateOnEnrollment: z.boolean(),
   approver: z.string().min(1, {
      message: MESSAGES.APPROVER_REQUIRED,
   }),
});

const reimbursementSchema = z.object({
   enabled: z.boolean(),
   requiresOsdJunior: z.boolean(),
   requiresOsdSenior: z.boolean(),
});

const organizationPolicySchema = z.object({
   managerApproval: managerApprovalSchema,
   trainingDeptApproval: trainingDeptApprovalSchema,
   osdReview: osdReviewSchema,
   tourForm: tourFormSchema,
   reimbursement: reimbursementSchema,
});

/**
 * Create Organization
 */
export const createOrganizationSchema = z.object({
   body: z.object({
      name: z.string().trim().min(2, {
         message: MESSAGES.ORG_NAME_MIN_LENGTH
      }),
      slug: z
         .string()
         .trim()
         .min(2, {
            message: MESSAGES.ORG_SLUG_MIN_LENGTH,
         })
         .regex(
            /^[a-z0-9-]+$/, {
            message: MESSAGES.ORG_INVALID_SLUG
         }
         ),

      orgType: z.enum(Object.values(ORGANIZATION_TYPE)),

      status: z
         .enum(Object.values(ORGANIZATION_STATUS))
         .optional(),
      policy: organizationPolicySchema,
   }),
});

/**
 * Update Policy
 */
export const updateOrganizationPolicySchema = z.object({
   body: z.object({
      policy: organizationPolicySchema.partial(),
   }),
});