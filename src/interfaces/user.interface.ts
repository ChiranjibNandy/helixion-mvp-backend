import { Types } from "mongoose";
import { APPROVAL_STATUS, ROLE, USER_STATUS } from "../constants/enum.js";
import { IOrganization } from "./organization.interface.js";

interface IManagerChain {
  userId: Types.ObjectId;
  level: number;
}

export interface IUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  role: ROLE;
  organizationId?: Types.ObjectId;
  approval_status: APPROVAL_STATUS;
  status: USER_STATUS;
  description: string;
  location: string;
  hierarchy: {
    managerId?: Types.ObjectId | null;
    managerChain: IManagerChain[];
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserWithOrganization
  extends Omit<IUser, "organizationId"> {
  organizationId?: IOrganization;
}