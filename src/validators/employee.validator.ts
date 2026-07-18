import z from "zod";
import { searchUsersQuerySchema, objectIdSchema } from "./common.validator.js";
import { STAY_TYPE, TRAVEL_TYPE } from "../constants/enum.js";
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

export const submitReimbursementParamsSchema = z.object({
  enrollmentId: objectIdSchema,
});

export const submitTourFormParamsSchema = z.object({
  enrollmentId: objectIdSchema,
});

const bookingDetailSchema = z.object({
  from:          z.string().trim().min(1),
  to:            z.string().trim().min(1),
  refNo:         z.string().trim().optional().default(""),
  departureTime: z.string().trim().optional().default(""),
  travelDate:    z.string().optional().default(""),
  travelClass:   z.string().trim().optional().default("Economy"),
});

export const submitTourFormBodySchema = z.object({
  travelType: z.enum(
    [TRAVEL_TYPE.SELF_TRAVEL, TRAVEL_TYPE.COMPANY_ASSISTED, TRAVEL_TYPE.LOCAL],
    { message: "Travel type must be self_travel, company_assisted, or local" }
  ),
  placeOfTour:            z.string().trim().optional(),
  frequentFlyerNo:        z.string().trim().optional(),
  modeOfTravel:           z.string().trim().optional(),
  purpose:                z.string().trim().max(500).optional(),
  bookingDetails:         z.array(bookingDetailSchema).optional().default([]),
  advancePaymentRequired: z.number().min(0).optional().default(0),
});
