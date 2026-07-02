import z from "zod";
import { objectIdSchema } from "./common.validator.js";
import { REIMBURSEMENT_MANAGER_ACTION } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

export const enrollmentParamsSchema = z.object({
  id: objectIdSchema,
});

export const reimbursementManagerActionBodySchema = z.object({
  action: z.enum(
    [REIMBURSEMENT_MANAGER_ACTION.APPROVE, REIMBURSEMENT_MANAGER_ACTION.REJECT],
    { message: MESSAGES.INVALID_REIMBURSEMENT_ACTION }
  ),
  note: z.string().trim().max(500, MESSAGES.NOTES_MAX_LENGTH).optional(),
});
