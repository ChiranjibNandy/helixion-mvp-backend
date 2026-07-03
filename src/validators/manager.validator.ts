import z from "zod";
import { objectIdSchema } from "./common.validator.js";
import { REIMBURSEMENT_ACTION } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

export const reimbursementEnrollmentParamsSchema = z.object({
  enrollmentId: objectIdSchema,
});

export const reimbursementManagerActionBodySchema = z.object({
  action: z.enum(
    [REIMBURSEMENT_ACTION.APPROVE, REIMBURSEMENT_ACTION.REJECT],
    { message: MESSAGES.INVALID_REIMBURSEMENT_ACTION }
  ),
  note: z.string().trim().max(500, MESSAGES.NOTES_MAX_LENGTH).optional(),
});
