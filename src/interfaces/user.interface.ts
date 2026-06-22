import { Types } from "mongoose";
import { USER_STATUS, ORG_ROLE } from "../constants/enum.js";

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

   orgId?: Types.ObjectId;       // null for training_provider users (not corporate)
   orgType?: "corporate";

   employeeCode?: string;
   name: string;                 // was: username
   email: string;
   mobile?: string;
   placeOfPosting?: string;      // was: location

   passwordHash: string;         // was: password
   mustChangePassword: boolean;

   orgRole: ORG_ROLE;            // top-level role (admin | employee | training_provider)
   status: USER_STATUS;

   hierarchy: IHierarchy;

   officeRoles: IOfficeRoles;

   createdAt?: Date;
   updatedAt?: Date;
}