import { ApprovalStatus } from "../constants/approval-status.js";
import { UserStatus } from "../constants/user-status.js";
import { IUser } from "../interfaces/user.interface.js";
import User from "../models/user.model.js";

//get user model by email
export const getUserByEmailRepository = async (
   email: string
): Promise<IUser | null> => {
   return await User.findOne({ email });
};

//save user model
export const createUserRepository = async (
   userData: Partial<IUser>
): Promise<IUser> => {
   const user = await User.create(userData);
   return user;
};

//get user model by Id
export const getUserByIdRepository = async (
   userId: string
): Promise<IUser | null> => {
   return await User.findById(userId);
};

//approve user repository
export const approveUserRepository = async (
   id: string,
   role: string,
   description?: string
) => {
   const updatedUser = await User.findByIdAndUpdate(
      id,
      {
         role: role,
         status: UserStatus.ACTIVE,
         approval_status: ApprovalStatus.APPROVED,
         description: description,
      },
      {
         new: true,
      }
   );

   return updatedUser;
};