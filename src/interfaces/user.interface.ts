import { Types } from "mongoose";
import { APPROVAL_STATUS, ROLE, USER_STATUS } from "../constants/enum.js";
import { IOrganization } from "./organization.interface.js";

interface IManagerChain {
  userId: Types.ObjectId;
  level: number;
}

export interface IManagerChainEntry {
   userId: Types.ObjectId;
   level: number; // 1 = direct manager, 2 = skip-level, etc.
}

export interface IOfficeRoles {
   trainingDept: {
      enabled: boolean;
      level: number | null; // 1 = junior, 2 = senior, null = not an officer
   };
   osd: {
      enabled: boolean;
      level: number | null;
   };
}

export interface IHierarchy {
   level: number;          // 0 = individual contributor, 1+ = manager level
   managerId?: Types.ObjectId;
   managerChain: IManagerChainEntry[];
}

/**
 * Core user document.
 *
 * Design decisions:
 * - `officeRoles` flags indicate whether this user is a Training Dept or OSD
 *   officer and at what level. Officer assignment for a *specific request*
 *   happens at enrollment time (copied into the Enrollment doc), not here.
 * - `hierarchy.managerChain` is the live chain. The enrollment snapshot
 *   captures it frozen at submission time.
 * - `name` replaces the old `username` field.
 * - `orgRole` replaces the old `role` string.
 */
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