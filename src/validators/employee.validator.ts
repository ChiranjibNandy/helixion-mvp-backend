import z from "zod";
import { searchUsersQuerySchema, objectIdSchema } from "./common.validator.js";

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
    ["single_occupancy", "twin_sharing", "non_residential"],
    { message: "stayType must be single_occupancy, twin_sharing, or non_residential" }
  ),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").optional(),
});
