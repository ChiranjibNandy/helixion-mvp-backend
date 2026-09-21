import mongoose, { Schema, Document } from "mongoose";

export enum EMAIL_STATUS {
   SENT = "SENT",
   FAILED = "FAILED",
}

export interface IEmailLog extends Document {
   recipientEmail: string;
   templateName: string;
   subject: string;
   status: EMAIL_STATUS;
   errorReason?: string | null;
   relatedEntityId?: mongoose.Types.ObjectId | null;
   createdAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
   {
      recipientEmail: { type: String, required: true, index: true },
      templateName: { type: String, required: true },
      subject: { type: String, required: true },
      status: {
         type: String,
         enum: Object.values(EMAIL_STATUS),
         required: true,
         index: true,
      },
      errorReason: { type: String, default: null },
      relatedEntityId: { type: Schema.Types.ObjectId, default: null },
   },
   { timestamps: true }
);

export const EmailLog = mongoose.model<IEmailLog>(
   "EmailLog",
   emailLogSchema
);