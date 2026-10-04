import mongoose from "mongoose";

export interface AddFeedbackDto {
   programId: string;
   rating: number;
   remark?: string;
}