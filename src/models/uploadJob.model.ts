import mongoose, { Schema } from "mongoose";
import { IUploadJob } from "../interfaces/uploadJob.interface.js";

const uploadJobSchema = new Schema<IUploadJob>(
   {
      status: {
         type: String,
         enum: ["pending", "processing", "completed", "failed"],
         default: "pending",
         index: true,
      },

      totalRows: { type: Number, required: true },
      processedRows: { type: Number, default: 0 },

      createdCount: { type: Number, default: 0 },
      updatedCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
      skippedEmails: { type: [String], default: [] },
      skipped: {
         type: [
            {
               email: { type: String },
               employeeCode: { type: String },
               error: { type: String, required: true },
            },
         ],
         default: [],
         _id: false,
      },

      fileName: { type: String, required: true },
      fileBuffer: { type: Buffer, required: true },

      createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
      orgId: { type: Schema.Types.ObjectId, index: true },

      error: { type: String },
      startedAt: { type: Date },
      completedAt: { type: Date },
   },
   {
      timestamps: true,
   }
);

uploadJobSchema.index({ createdBy: 1, createdAt: -1 });

uploadJobSchema.index({ completedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export default mongoose.model<IUploadJob>("UploadJob", uploadJobSchema);
