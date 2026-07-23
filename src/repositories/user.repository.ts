import { Types } from "mongoose";
import { APPROVAL_STATUS, USER_STATUS } from "../constants/enum.js";
import { IUser, IUserWithOrganization } from "../interfaces/user.interface.js";
import User from "../models/user.model.js";

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const getUserByEmailRepo = async (email: string): Promise<IUser | null> => {
   return await User.findOne({ email: email.toLowerCase() });
};

export const getUserByIdRepo = async (userId: string): Promise<IUser | null> => {
   return await User.findById(userId);
};

export const getUsersByEmailsRepo = async (emails: string[]): Promise<IUser[]> => {
   return await User.find({ email: { $in: emails } });
};

export const getUsersByIdsRepo = async (userIds: string[]): Promise<IUser[]> => {
   if (userIds.length === 0) return [];
   return await User.find({ _id: { $in: userIds } });
};

// ─── Create / Update ──────────────────────────────────────────────────────────

export const createUserRepo = async (userData: Partial<IUser>): Promise<IUser> => {
   const user = await User.create(userData);
   return user;
};

export interface BatchInsertResult {
   inserted: IUser[];
   failed: { email?: string; error: string }[];
}

// { ordered: false } is required — with the default (ordered: true), a
// single row failing schema validation (e.g. an invalid orgRole enum value)
// aborts the ENTIRE insertMany call, silently discarding every other valid
// row in the same batch.
//
// Failure reporting: Mongoose's client-side schema validation (which is what
// catches an invalid enum value) does NOT throw with ordered:false — it just
// silently omits the invalid documents from the returned array, verified
// directly against this Mongoose version. So rather than parse an error
// shape that doesn't reliably exist, failures are detected by diffing the
// input against whichever rows actually made it into `inserted`. A genuine
// server-side write error (e.g. a duplicate-key race) DOES throw a
// MongoBulkWriteError with `.insertedDocs` — that's still handled via catch,
// and the same before/after diff is applied to its partial `insertedDocs`.
export const batchCreateUsersRepo = async (users: Partial<IUser>[]): Promise<BatchInsertResult> => {
   let inserted: IUser[];
   try {
      inserted = await User.insertMany(users, { ordered: false }) as unknown as IUser[];
   } catch (err: any) {
      if (!err.insertedDocs) throw err;
      inserted = err.insertedDocs as IUser[];
   }

   const insertedEmails = new Set(inserted.map((u) => (u.email ?? "").toLowerCase()));
   const failed = users
      .filter((u) => !insertedEmails.has((u.email ?? "").toLowerCase()))
      .map((u) => ({ email: u.email, error: "Failed validation (e.g. invalid role)" }));

   return { inserted, failed };
};

export const deactivateUserRepo = async (id: string) => {
   return await User.findByIdAndUpdate(
      id,
      { status: USER_STATUS.INACTIVE },
      { new: true }
   );
};

/** Update the user's orgRole (replaces the old role field) */
export const updateUserRoleRepo = async (email: string, orgRole: string) => {
   return await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { orgRole },
      { new: true }
   );
};

/** Update the user's passwordHash field */
export const updatePasswordRepo = async (userId: string, hashedPassword: string) => {
   return await User.findByIdAndUpdate(
      userId,
      { passwordHash: hashedPassword, mustChangePassword: false },
      { new: true }
   );
};

// ─── Approval flow (admin approves a pending user) ───────────────────────────

export const approveUserRepo = async (id: string, orgRole: string, placeOfPosting?: string) => {
   return await User.findByIdAndUpdate(
      id,
      {
         orgRole,
         status: USER_STATUS.ACTIVE,
         mustChangePassword: false,
         ...(placeOfPosting && { placeOfPosting }),
         isApproved:true
      },
      { new: true }
   );
};

// ─── Search / List ────────────────────────────────────────────────────────────

export const searchUsersRepo = async (
   query: string,
   page: number,
   limit: number
) => {
   const filter: Record<string, unknown> = {
      status: USER_STATUS.ACTIVE,
   };

   if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
         { name: { $regex: escaped, $options: "i" } },
         { email: { $regex: escaped, $options: "i" } },
         { employeeCode: { $regex: escaped, $options: "i" } },
      ];
   }

   const [users, total] = await Promise.all([
      User.find(filter)
         .select("-passwordHash")
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit),
      User.countDocuments(filter),
   ]);

   return { users, total };
};

/** Get all users belonging to a specific org (tenant-scoped) */
export const getUsersByOrgRepo = async (
   orgId: string,
   page: number,
   limit: number,
   search?: string
) => {
   const filter: Record<string, unknown> = { orgId };

   if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
         { name: { $regex: escaped, $options: "i" } },
         { email: { $regex: escaped, $options: "i" } },
         { employeeCode: { $regex: escaped, $options: "i" } },
      ];
   }

   const [users, total] = await Promise.all([
      User.find(filter)
         .select("-passwordHash")
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit),
      User.countDocuments(filter),
   ]);

   return { users, total };
};

/** Find users in an org who hold a specific office role at min level */
export const getUsersByOfficeRoleRepo = async (
   orgId: string,
   type: "trainingDept" | "osd",
   minLevel: 1 | 2
) => {
   return await User.find({
      orgId,
      [`officeRoles.${ type }.enabled`]: true,
      [`officeRoles.${ type }.level`]: { $gte: minLevel },
      status: USER_STATUS.ACTIVE,
   }).select("-passwordHash");
};

export const getUsersByOrganizationId = async (
   organizationId: string
): Promise<IUser[]> => {
   return await User.find({ organizationId })
}


export const hasReportingEmployees = (
   orgId: Types.ObjectId,
   managerId: Types.ObjectId
) => {
   return User.exists({
      orgId,
      "hierarchy.managerChain.userId": managerId,
   });
};

export const hasApproveEmployees = (
   orgId: Types.ObjectId,
   managerId: Types.ObjectId,
   minLevel: number
) => {
   return User.exists({
      orgId,
      "hierarchy.managerChain": {
         $elemMatch: {
            userId: managerId,
            level: { $gte: minLevel }
         }
      }
   });
};

