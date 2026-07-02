import z from "zod";
import { objectIdSchema } from "./common.validator.js";
import { OSD_SENIOR_ACTION } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

export const enrollmentParamsSchema = z.object({
  id: objectIdSchema,
});

export const reimbursementOsdActionBodySchema = z.object({
  action: z.enum(
    [OSD_SENIOR_ACTION.APPROVE, OSD_SENIOR_ACTION.REJECT],
    { message: MESSAGES.INVALID_REIMBURSEMENT_ACTION }
  ),
  note: z.string().trim().max(500, MESSAGES.NOTES_MAX_LENGTH).optional(),
});
