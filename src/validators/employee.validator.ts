import z from "zod";
import { searchUsersQuerySchema, objectIdSchema } from "./common.validator.js";
import { STAY_TYPE_KEY } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

export const getProgramsQuerySchema = searchUsersQuerySchema.extend({
  venue:    z.string().optional().default("").transform((v) => v.trim()),
  fromDate: z.string().optional().default(""),
  toDate:   z.string().optional().default(""),
});

export const programParamsSchema = z.object({
  id: objectIdSchema,
});

export const enrollProgramBodySchema = z.object({
  stayType: z.enum(
    Object.values(STAY_TYPE_KEY) as [STAY_TYPE_KEY, ...STAY_TYPE_KEY[]],
    { message: MESSAGES.STAY_TYPE_INVALID }
  ),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional(),
});
