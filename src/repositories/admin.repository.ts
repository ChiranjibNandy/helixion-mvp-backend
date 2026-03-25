import User from "../models/user.model.js";
import { IUser } from "../interfaces/user.interface.js";
import { ApprovalStatus } from "../constants/approval-status.js";

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