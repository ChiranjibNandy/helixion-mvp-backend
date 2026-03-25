import { Types } from "mongoose";

export interface IUser {
  _id?: Types.ObjectId
  username: string;
  email: string,
  password: string;
  role?: string;
  approval_status: "approved" | "dismissed" | "pending";
  status: "active" | "deactive";
  description:string
  createdAt?: Date;
  updatedAt?: Date;
}