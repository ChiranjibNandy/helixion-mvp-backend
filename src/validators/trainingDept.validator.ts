import z from "zod";
import { objectIdSchema } from "./common.validator.js";
import { TOUR_CTD_ACTION } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

export const tourActionParamsSchema = z.object({
  id: objectIdSchema,
});

export const tourCtdActionBodySchema = z.object({
  action: z.enum(
    [TOUR_CTD_ACTION.APPROVE, TOUR_CTD_ACTION.REJECT],
    { message: "Invalid action. Must be 'approve' or 'reject'." }
  ),
  note: z.string().trim().max(500, MESSAGES.NOTES_MAX_LENGTH).optional(),
});
