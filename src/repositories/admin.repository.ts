import User from "../models/user.model.js";
import { IUser } from "../interfaces/user.interface.js";
import { ApprovalStatus } from "../constants/approval-status.js";

// Retrieve a list of users with pending registration status for admin, supporting pagination and limit
export const getPendingRegistrationsRepository = async (
   page: number,
   limit: number
): Promise<{
   users: IUser[];
   total: number;
}> => {
   const skip = (page - 1) * limit;

   const [users, total] = await Promise.all([
      User.find({
         approval_status: ApprovalStatus.PENDING,
      })
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limit),

      User.countDocuments({
         approval_status: ApprovalStatus.PENDING,
      }),
   ]);

   return { users, total };
};

//return all the user who registerd 
export const getRegisteredUsersRepository =
   async (
      page: number,
      limit: number,
      search: string
   ) => {
      const skip =
         (page - 1) * limit;
      let query = {};
      if (search) {
         query = {
            $or: [
               {
                  username: {
                     $regex: search,
                     $options: "i"
                  }
               },
               {
                  email: {
                     $regex: search,
                     $options: "i"
                  }
               }
            ]
         };

      }

      const [users, total] =
         await Promise.all([

            User.find(
               query,
               {
                  username: 1,
                  email: 1
               }
            )
               .skip(skip)
               .limit(limit),

            User.countDocuments(query)
         ]);
      return {
         users,
         pagination: {
            total,
            page,
            limit,
            totalPages:
               Math.ceil(total / limit)
         }
      };

   };