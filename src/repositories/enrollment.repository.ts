import mongoose from "mongoose";
import enrollment from "../models/enrollment.model.js";
import { ENROLLMENT_STATUS } from "../constants/enum.js";
import enrollmentModel from "../models/enrollment.model.js";

//get enrollmented participant data
export const getProgramParticipantsRepo = async (
   programId: string
) => {
   return await enrollment.find({ programId, status: ENROLLMENT_STATUS.ACTIVE })
      .populate({
         path: "userId",
         select: "_id username email"
      });
};

//enrollment data based on programId and participant Id for checking

export const validateParticipantsEnrollmentRepo = async (
   programId: string,
   participantIds: string[]
) => {

   const enrollments = await enrollmentModel.find({
      programId: new mongoose.Types.ObjectId(programId),

      userId: {
         $in: participantIds.map(
            (id) => new mongoose.Types.ObjectId(id)
         )
      },

      status: ENROLLMENT_STATUS.ACTIVE
   }).select("userId");

   return enrollments;
};

// TOTAL ENROLLMENTS
export const getTotalEnrollments = async (
   trainingProviderId: string
) => {

   const result = await enrollmentModel.aggregate([

      {
         $lookup: {
            from: "programs",
            localField: "programId",
            foreignField: "_id",
            as: "program"
         }
      },

      {
         $unwind: "$program"
      },

      {
         $match: {
            "program.training_providerId":
               new mongoose.Types.ObjectId(
                  trainingProviderId
               )
         }
      },

      {
         $count: "total"
      }
   ]);

   return result[0]?.total || 0;
};

//Today Enrollments
export const getTodayEnrollmentCount = async (
   trainingProviderId: string
) => {

   const todayStart = new Date();

   todayStart.setHours(0, 0, 0, 0);

   const result = await enrollmentModel.aggregate([

      {
         $match: {
            createdAt: {
               $gte: todayStart
            }
         }
      },

      {
         $lookup: {
            from: "programs",
            localField: "programId",
            foreignField: "_id",
            as: "program"
         }
      },

      {
         $unwind: "$program"
      },

      {
         $match: {
            "program.training_providerId":
               new mongoose.Types.ObjectId(
                  trainingProviderId
               )
         }
      },

      {
         $count: "count"
      }
   ]);

   return result[0]?.count || 0;
};

//Enrollment activity
export const getEnrollmentActivities = async (
   trainingProviderId: string
) => {

   const count =
      await getTodayEnrollmentCount(
         trainingProviderId
      );

   if (!count) return [];

   return [
      {
         type: "enrollment",
         message:
            `${count} new enrollments received today`,
         time: new Date()
      }
   ];
};
