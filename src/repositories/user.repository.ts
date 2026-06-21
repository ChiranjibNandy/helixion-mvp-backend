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

//save user model
export const createUserRepo = async (
   userData: Partial<IUser>
): Promise<IUser> => {
   const user = await User.create(userData);
   return user;
};

//get user model by Id
export const getUserByIdRepo = async (
   userId: string
): Promise<IUser | null> => {
   return await User.findById(userId);
};

//approve user repository
export const approveUserRepo = async (
   id: string,
   role: string,
   description?: string
) => {
   const updatedUser = await User.findByIdAndUpdate(
      id,
      {
         role: role,
         status: USER_STATUS.ACTIVE,
         approval_status: APPROVAL_STATUS.APPROVED,
         description: description,
      },
      {
         new: true,
      }
   );

   return updatedUser;
};

export const deactivateUserRepo = async (id: string) => {
   return await User.findByIdAndUpdate(
      id,
      { status: USER_STATUS.DEACTIVE },
      { new: true }
   );
};

export const getUsersByEmailsRepo = async (
   emails: string[]
): Promise<IUser[]> => {
   return await User.find({ email: { $in: emails } });
};

export const searchUsersRepo = async (
   query: string,
   page: number,
   limit: number
) => {
   const filter: Record<string, unknown> = {
      approval_status: APPROVAL_STATUS.APPROVED,
   };

   if (query) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
         { username: { $regex: escapedQuery, $options: "i" } },
         { email: { $regex: escapedQuery, $options: "i" } },
      ];
   }

   const [users, total] = await Promise.all([
      User.find(filter)
         .select("-password")
         .sort({ createdAt: -1 })
         .skip((page - 1) * limit)
         .limit(limit),
      User.countDocuments(filter),
   ]);

   return { users, total };
};

export const batchCreateUsersRepo = async (
   users: Partial<IUser>[]
) => {
   return await User.insertMany(users);
};


//update user's password 
export const updatePasswordRepo = async (
   userId: string,
   hashedPassword: string
) => {

   return await User.findByIdAndUpdate(
      userId,
      {
         password: hashedPassword
      },
      {
         new: true
      }
   );

};

//update user's role
export const updateUserRoleRepo = async (
   email: string,
   role: string
) => {
   return await User.findOneAndUpdate(
      { email },
      { role },
      { new: true }
   );
};
