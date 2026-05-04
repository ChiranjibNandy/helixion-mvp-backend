import mongoose, { Schema } from "mongoose";
import { IProgram } from "../interfaces/program.interface.js";
import { PROGRAM_SAVED_STATUS, STAY_TYPE } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

const programSchema = new Schema<IProgram>(
   {
      title: {
         type: String,
         required: true,
         trim: true,
      },

      startDate: {
         type: Date,
      },

      endDate: {
         type: Date,
         validate: {
            validator: function (this: IProgram, value: Date) {
               if (!this.startDate || !value) return true;
               return value >= this.startDate;
            },
            message: MESSAGES.END_DATE_AFTER_START,
         },
      },

      venue: {
         type: String,
         trim: true,
      },

      isResidential: {
         type: Boolean,
         default: false,
      },

      stayType: {
         type: String,
         enum: [STAY_TYPE.SINGLE, STAY_TYPE.TWIN],
      },

      singleOccupancyFee: {
         type: Number,
         min: 0,
      },

      twinSharingFee: {
         type: Number,
         min: 0,
      },

      nonResidentialFee: {
         type: Number,
         min: 0,
      },

      brochureUrl: {
         type: String,
      },

      minParticipants: {
         type: Number,
         min: 1,
      },

      maxParticipants: {
         type: Number,
         validate: {
            validator: function (this: IProgram, value: number) {
               if (!this.minParticipants || !value) return true;
               return value >= this.minParticipants;
            },
            message: MESSAGES.MAX_PARTICIPANTS_INVALID,
         },
      },
      status: {
         type: String,
         enum: [PROGRAM_SAVED_STATUS.DRAFT, PROGRAM_SAVED_STATUS.PUBLISHED],
         default: PROGRAM_SAVED_STATUS.DRAFT,
      },
      training_providerId: {
         type: Schema.Types.ObjectId,
         ref: "User", 
         required: true,
         index: true,
      },
   },
   {
      timestamps: true,
   }
);


export default mongoose.model<IProgram>("Program", programSchema);