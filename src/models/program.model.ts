import mongoose, { Schema } from "mongoose";
import { IProgram, IStayOption } from "../interfaces/program.interface.js";
import { PROGRAM_SAVED_STATUS, STAY_TYPE } from "../constants/enum.js";
import { MESSAGES } from "../constants/messages.js";

const stayOptionSchema = new Schema<IStayOption>(
   {
      type:  { type: String, enum: Object.values(STAY_TYPE), required: true },
      price: { type: Number, min: 0, required: true },
   },
   { _id: false }
);

const programSchema = new Schema<IProgram>(
   {
      createdBy: {
         type:     Schema.Types.ObjectId,
         ref:      "User",
         required: true,
         index:    true,
      },

      title: {
         type:     String,
         required: true,
         trim:     true,
      },

      trainingInstitute: {
         type: String,
         trim: true,
      },

      venueName: {
         type: String,
         trim: true,
      },

      city: {
         type: String,
         trim: true,
      },

      state: {
         type: String,
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

      /**
       * Replaces singleOccupancyFee / twinSharingFee / nonResidentialFee.
       * Storing as an array means adding a new stay type never requires
       * a schema migration.
       */
      stayOptions: {
         type:    [stayOptionSchema],
         default: [],
      },

      brochureUrl: {
         type: String,
      },

      brochurePublicId: {
         type: String,
      },

      minParticipants: {
         type: Number,
         min:  1,
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
         type:    String,
         enum:    Object.values(PROGRAM_SAVED_STATUS),
         default: PROGRAM_SAVED_STATUS.DRAFT,
      },

      batchId: {
         type: String,
      },
   },
   {
      timestamps: true,
   }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
programSchema.index({ createdBy: 1, status: 1 });
programSchema.index({ createdBy: 1, createdAt: -1 });
programSchema.index({ status: 1 });
programSchema.index({ startDate: 1 }); // startDate field is defined in schema (see above)
programSchema.index({ batchId: 1 });
programSchema.index({ city: 1, status: 1 });   // employee browse by city

export default mongoose.model<IProgram>("Program", programSchema);