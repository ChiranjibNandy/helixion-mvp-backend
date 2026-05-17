import mongoose from "mongoose";
import enrollment from "../models/enrollment.model.js";
import { ENROLLMENT_STATUS } from "../constants/enum.js";

// Retrieve active enrollments with program details
export const getActiveEnrollmentsRepository = async (userId: string) => {
   const enrollments = await enrollment.aggregate([
      {
         $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: ENROLLMENT_STATUS.ACTIVE
         }
      },
      {
         $lookup: {
            from: "programs",
            localField: "programId",
            foreignField: "_id",
            as: "programDetails"
         }
      },
      {
         $addFields: {
            programDetails: {
               $arrayElemAt: ["$programDetails", 0]
            }
         }
      },
      {
         $sort: {
            createdAt: -1
         }
      }
   ]);

   return enrollments;
};

//get enrollmented participant data
export const getProgramParticipantsRepository = async (
   programId: string
) => {
   return await enrollment.find({ programId,status:ENROLLMENT_STATUS.ACTIVE })
      .populate({
         path: "userId",
         select: "_id username email"
      });
};