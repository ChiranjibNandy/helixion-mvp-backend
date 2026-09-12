import { Types } from "mongoose";

export type UploadJobStatus = "pending" | "processing" | "completed" | "failed";

export interface IUploadJobSkippedRow {
   email?: string;
   employeeCode?: string;
   error: string;
}

export interface IUploadJob {
   _id: Types.ObjectId;
   status: UploadJobStatus;
   totalRows: number;
   processedRows: number;
   createdCount: number;
   updatedCount: number;
   skippedCount: number;
   skippedEmails: string[];
   skipped: IUploadJobSkippedRow[];
   fileName: string;
   fileBuffer: Buffer;
   createdBy: Types.ObjectId;
   orgId: Types.ObjectId;
   error?: string;
   startedAt?: Date;
   completedAt?: Date;
   createdAt?: Date;
   updatedAt?: Date;
}
