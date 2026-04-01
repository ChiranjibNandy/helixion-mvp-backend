import { Types } from "mongoose";

export interface IProgram {
  _id?: Types.ObjectId
  name: string;
  description: string;
  duration: string;
  status: string;
  fee: number;
  mode: string;
  createdAt: Date;
  updatedAt: Date;
}