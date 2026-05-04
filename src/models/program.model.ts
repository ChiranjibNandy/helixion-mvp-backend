import mongoose, { Schema } from "mongoose";
import { IProgram } from "../interfaces/program.interface.js";
import { PROGRAM_STATUS, STAY_TYPE } from "../constants/enum.js";

const programSchema = new Schema<IProgram>(
   {
      title: { type: String, required: true },

      startDate: Date,
      endDate: Date,
      venue: String,

      isResidential: Boolean,
      stayType: {
         type: String,
         enum: [STAY_TYPE.SINGLE, STAY_TYPE.TWIN],
      },

      singleOccupancyFee: Number,
      twinSharingFee: Number,
      nonResidentialFee: Number,

      brochureUrl: String,

      minParticipants: Number,
      maxParticipants: Number,

      status: {
         type: String,
         enum: [PROGRAM_STATUS.DRAFT, PROGRAM_STATUS.PUBLISHED],
         default: PROGRAM_STATUS.DRAFT,
      },
   },
   { timestamps: true }
);

export default mongoose.model<IProgram>("Program", programSchema);