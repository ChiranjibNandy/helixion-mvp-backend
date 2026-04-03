import mongoose from "mongoose";
import { EnrollmentStatus } from "../constants/enrollment-status.js";
import enrollment from "../models/enrollment.model.js";

// Retrieve active enrollments with program details
export const getActiveEnrollmentsRepository = async (userId: string) => {
   const enrollments = await enrollment.aggregate([
      {
         $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: EnrollmentStatus.ACTIVE
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