import { Types } from "mongoose";

export interface UserResponseDto {
   _id?: Types.ObjectId;
   name: string;
   email: string;
   createdAt?: Date;
}

export interface CreateUserDto {
   name?: string;
   username?: string;   // legacy — maps to name
   email: string;
   password: string;
   orgRole?: string;
   role?: string;       // legacy — maps to orgRole
}

/**
 * Shape of each row in the bulk CSV upload.
 *
 * CSV columns expected:
 *   email, name, employeeCode, orgRole, placeOfPosting,
 *   managerId (optional ObjectId string),
 *   trainingDeptEnabled, trainingDeptLevel,
 *   osdEnabled, osdLevel,
 *   action (approve | update)
 */
export interface BulkUploadUserDto {
   email: string;
   name?: string;
   employeeCode?: string;
   orgRole: string;
   placeOfPosting?: string;
   mobile?: string;
   managerId?: string;       // ObjectId string — resolved to hierarchy at import time
   trainingDeptEnabled?: boolean | string;
   trainingDeptLevel?: number | string;
   osdEnabled?: boolean | string;
   osdLevel?: number | string;
   action?: string;           // "approve" | "update"
}
