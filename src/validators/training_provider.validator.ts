// validations/program.validation.ts
import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";
import { PROGRAM_SAVED_STATUS, STAY_TYPE } from "../constants/enum.js";

export const baseProgramSchema = z.object({
   title: z.string().min(1, MESSAGES.PROGRAM_TITLE_REQUIRED),

   startDate: z.string().optional(),
   endDate: z.string().optional(),
   venue: z.string().optional(),

   isResidential: z.boolean().optional(),
   stayType: z.enum([STAY_TYPE.SINGLE, STAY_TYPE.TWIN]).optional(),

   singleOccupancyFee: z.coerce.number().min(0).optional(),
   twinSharingFee: z.coerce.number().min(0).optional(),
   nonResidentialFee: z.coerce.number().min(0).optional(),


   brochureUrl: z.string().optional(),
   minParticipants: z.coerce.number().min(1).optional(),
   maxParticipants: z.coerce.number().min(1).optional(),

   status: z.enum([PROGRAM_SAVED_STATUS.DRAFT, PROGRAM_SAVED_STATUS.PUBLISHED]),
});

// Create Programm Conditional validation
export const createProgramSchema = baseProgramSchema.superRefine((data, ctx) => {
   if (data.status === PROGRAM_SAVED_STATUS.PUBLISHED) {
      if (!data.startDate) {
         ctx.addIssue({ code: "custom", message: MESSAGES.START_DATE_REQUIRED, path: ["startDate"] });
      }

      if (!data.endDate) {
         ctx.addIssue({ code: "custom", message: MESSAGES.END_DATE_REQUIRED, path: ["endDate"] });
      }

      if (!data.venue) {
         ctx.addIssue({ code: "custom", message: MESSAGES.VENUE_REQUIRED, path: ["venue"] });
      }

      if (!data.minParticipants) {
         ctx.addIssue({ code: "custom", message: MESSAGES.MIN_PARTICIPANT_REQUIRED, path: ["minParticipants"] });
      }

      if (!data.maxParticipants) {
         ctx.addIssue({ code: "custom", message: MESSAGES.MAX_PARTICIPANT_REQUIRED, path: ["maxParticipants"] });
      }
   }
});

//validation for bulk program creation

export const bulkProgramRowSchema = z.object({
  title: z.string().min(1, MESSAGES.PROGRAM_TITLE_REQUIRED),

  startDate: z.string().optional(),
  endDate: z.string().optional(),
  venue: z.string().optional(),

  isResidential: z.coerce.boolean().optional(),
  stayType: z.enum([STAY_TYPE.SINGLE, STAY_TYPE.TWIN]).optional(),

  singleOccupancyFee: z.coerce.number().min(0).optional(),
  twinSharingFee: z.coerce.number().min(0).optional(),
  nonResidentialFee: z.coerce.number().min(0).optional(),

  brochureUrl: z.string().url().optional(),

  minParticipants: z.coerce.number().min(1).optional(),
  maxParticipants: z.coerce.number().min(1).optional(),

  status: z.enum([
    PROGRAM_SAVED_STATUS.DRAFT,
    PROGRAM_SAVED_STATUS.PUBLISHED,
  ]),
});