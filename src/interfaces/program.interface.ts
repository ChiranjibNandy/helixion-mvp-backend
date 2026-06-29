import { Types } from "mongoose";
import { PROGRAM_SAVED_STATUS, STAY_TYPE } from "../constants/enum.js";

export interface IStayOption {
   type: STAY_TYPE;
   price: number;
}

export interface IProgram {
   _id?: Types.ObjectId;

   /** The training provider (TP) who created this program */
   createdBy: Types.ObjectId;       // was: training_providerId

   title: string;
   trainingInstitute?: string;      // name of the institute running the program
   venueName?: string;              // hotel / venue name
   city?: string;
   state?: string;

   startDate: Date;
   endDate?: Date;

   /**
    * Replaces the three separate fee fields (singleOccupancyFee,
    * twinSharingFee, nonResidentialFee). Keeps the door open for
    * adding more stay types without schema changes.
    */
   stayOptions: IStayOption[];

   brochureUrl?: string;
   brochurePublicId?: string;

   minParticipants?: number;
   maxParticipants?: number;

   status: PROGRAM_SAVED_STATUS;

   /** Batch ID for bulk-uploaded programs */
   batchId?: string;

   createdAt: Date;
   updatedAt: Date;
}