import { APPROVAL_STATUS, USER_STATUS } from "../constants/enum.js";
import { IUser, IUserWithOrganization } from "../interfaces/user.interface.js";
import User from "../models/user.model.js";

//get user model by email
export const getUserByEmailRepo = async (
   email: string
): Promise<IUserWithOrganization | null> => {
   return await User.findOne({ email })
      .populate("organizationId")
      .lean<IUserWithOrganization>();
};

export const getUsersByEmailsRepo = async (emails: string[]): Promise<IUser[]> => {
   return await User.find({ email: { $in: emails } });
};

// ─── Create / Update ──────────────────────────────────────────────────────────

export const createUserRepo = async (userData: Partial<IUser>): Promise<IUser> => {
   const user = await User.create(userData);
   return user;
};

export const batchCreateUsersRepo = async (users: Partial<IUser>[]): Promise<IUser[]> => {
   return await User.insertMany(users) as unknown as IUser[];
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
      [`officeRoles.${type}.enabled`]: true,
      [`officeRoles.${type}.level`]:   { $gte: minLevel },
      status: USER_STATUS.ACTIVE,
   }).select("-passwordHash");
};

export const getUsersByOrganizationId = async (
   organizationId: string
) => {
   return await User.find({ organizationId })
}
