import mongoose from "mongoose";
import { EnrollmentStatus } from "../constants/enrollment-status.js";
import enrollment from "../models/enrollment.model.js";


// Retrieve active enrollments with program details using lookup
export const getActiveEnrollmentsRepository = async (userId: string) => {
   const enrollments = await enrollment.aggregate([
      {
         $match: {
            status: EnrollmentStatus.ACTIVE,
            userId: new mongoose.Types.ObjectId(userId)
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
         $unwind: {
            path: "$programDetails",
            preserveNullAndEmptyArrays: true
         }
      }
   ]);

   return enrollments;

}