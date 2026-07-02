import z from "zod";
import { searchUsersQuerySchema, objectIdSchema } from "./common.validator.js";
import { STAY_TYPE } from "../constants/enum.js";
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
    [STAY_TYPE.SINGLE_OCCUPANCY, STAY_TYPE.TWIN_SHARING, STAY_TYPE.NON_RESIDENTIAL],
    { message: MESSAGES.STAY_TYPE_INVALID }
  ),
  notes: z.string().trim().max(500, MESSAGES.NOTES_MAX_LENGTH).optional(),
});

export const submitReimbursementBodySchema = z.object({
  expenses: z.object({
    travelCost:        z.number().min(0),
    accommodationCost: z.number().min(0),
    foodCost:           z.number().min(0),
  }),
  receipts: z.array(z.string()).default([]),
});
