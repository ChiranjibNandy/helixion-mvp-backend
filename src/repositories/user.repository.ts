import { APPROVAL_STATUS, USER_STATUS } from "../constants/enum.js";
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

export const deactivateUserRepository = async (id: string) => {
   return await User.findByIdAndUpdate(
      id,
      { status: USER_STATUS.DEACTIVE },
      { new: true }
   );
};

export const getUsersByEmailsRepository = async (
   emails: string[]
): Promise<IUser[]> => {
   return await User.find({ email: { $in: emails } });
};

export const searchUsersRepository = async (
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

export const batchCreateUsersRepository = async (
   users: Partial<IUser>[]
) => {
   return await User.insertMany(users);
};


//update user's password 
export const updatePasswordRepository = async (
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
