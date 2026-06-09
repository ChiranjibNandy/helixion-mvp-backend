import mongoose from "mongoose";
import enrollment from "../models/enrollment.model.js";
import { ENROLLMENT_STATUS } from "../constants/enum.js";
import enrollmentModel from "../models/enrollment.model.js";
import { toObjectId } from "../utils/mongo.js";
import { IEnrollment } from "../interfaces/enrollment.interface.js";

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
      programId: toObjectId(programId),

      userId: {
         $in: participantIds.map(
            (id) => toObjectId(id)
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
               toObjectId(trainingProviderId)
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
               toObjectId(trainingProviderId)
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
            `${ count } new enrollments received today`,
         time: new Date()
      }
   ];
};

export const createEnrollmentRepo = async (data: Partial<IEnrollment>) => {
   return await enrollmentModel.create(data);
};

export const getEmployeeEnrollmentsRepo = async (userId: string) => {
   return await enrollmentModel.aggregate([
      {
         $match: {
            $or: [
               { employeeId: toObjectId(userId) },
               { userId: toObjectId(userId) }
            ]
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
            },
            programId: {
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
};

export const getEnrollmentDetailsRepo = async (id: string, userId: string) => {
   const results = await enrollmentModel.aggregate([
      {
         $match: {
            _id: toObjectId(id),
            $or: [
               { employeeId: toObjectId(userId) },
               { userId: toObjectId(userId) }
            ]
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
            },
            programId: {
               $arrayElemAt: ["$programDetails", 0]
            }
         }
      }
   ]);
   return results[0] || null;
};

export const findExistingEnrollmentRepo = async (userId: string, programId: string) => {
   return await enrollmentModel.findOne({
      $or: [
         { employeeId: toObjectId(userId) },
         { userId: toObjectId(userId) }
      ],
      programId: toObjectId(programId),
      status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] }
   });
};

