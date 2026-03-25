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

export const updateApprovalStatusRepository = async (
   userId: string,
   status: string
): Promise<IUser | null> => {
   return await User.findByIdAndUpdate(userId, { approval_status: status })
};