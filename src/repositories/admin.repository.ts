import User from "../models/user.model.js";
import { IUser } from "../interfaces/user.interface.js";

// Retrieve a list of users with pending registration status for admin, supporting pagination and limit
export const getPendingRegistrationsRepo = async (
   page: number,
   limit: number
): Promise<{
   users: IUser[];
   total: number;
}> => {
   const skip = (page - 1) * limit;

   const [users, total] = await Promise.all([
      User.find({
         isApproved: false
      })
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limit),

      User.countDocuments({
         isApproved: false
      }),
   ]);

   return { users, total };
};

//return all the user who registerd 
export const getRegisteredUsersRepo =
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
                  // Was filtering on `username`, a field that doesn't exist
                  // on the User schema (the real field is `name`) — every
                  // name-based search silently matched nothing.
                  name: {
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
                  // Was projecting `username` (nonexistent) instead of
                  // `name` — every row came back with only _id and email.
                  name: 1,
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