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
 *   email, name, employeeCode, role, placeOfPosting,
 *   managerId (optional ObjectId string),
 *   trainingDeptEnabled, trainingDeptLevel,
 *   osdEnabled, osdLevel,
 *   action (approve | update)
 *
 * Note: the incoming field is `role` (matches batchCreateUsersBodySchema in
 * admin.validator.ts) — it gets mapped to the User model's `orgRole` field
 * by buildNewUserDocument/updateUserRoleRepo, not carried through as-is.
 */
export interface BulkUploadUserDto {
   email: string;
   name?: string;
   employeeCode?: string;
   role: string;
   placeOfPosting?: string;
   mobile?: string;
   managerId?: string;       // ObjectId string — resolved to hierarchy at import time
   trainingDeptEnabled?: boolean | string;
   trainingDeptLevel?: number | string;
   osdEnabled?: boolean | string;
   osdLevel?: number | string;
   action?: string;           // "approve" | "update"
}
