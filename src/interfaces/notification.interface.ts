import { Document, Types } from "mongoose";

export interface INotification extends Document {
   userId: Types.ObjectId;
   type: string;
   title: string;
   message: string;
   icon: string;
   color: string;
   read: boolean;
   relatedEntityId?: Types.ObjectId;
   createdAt: Date;
   readAt?: Date | null;
}