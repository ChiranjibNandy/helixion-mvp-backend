import { Types } from "mongoose";
import { APPROVAL_STATUS, ROLE, USER_STATUS } from "../constants/enum.js";


export interface IUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  role: ROLE;

  organizationId: Types.ObjectId;
  scale: number;

  approval_status: APPROVAL_STATUS;
  status: USER_STATUS;

  description: string;
  location: string;

  createdAt?: Date;
  updatedAt?: Date;
}