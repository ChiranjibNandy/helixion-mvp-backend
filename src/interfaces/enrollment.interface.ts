import { Types } from "mongoose";

// Stores user enrollments for programs
export interface IEnrollment {
   _id?: Types.ObjectId
   userId: Types.ObjectId;
   programId: Types.ObjectId;
   status: string;
   createdAt: Date;
   updatedAt: Date;
}