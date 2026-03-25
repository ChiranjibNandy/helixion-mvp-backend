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