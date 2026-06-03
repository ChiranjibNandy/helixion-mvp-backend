import mongoose from "mongoose";
import enrollment from "../models/enrollment.model.js";
import { APPROVAL_STATUS, ENROLLMENT_STATUS, PROGRAM_SAVED_STATUS } from "../constants/enum.js";
import { ApprovalStatus } from "../types/enrollment.js";
import Program from '../models/program.model.js'

//employee dasboard summary data
export const getDashboardSummaryRepo = async (
   userId: string
) => {

   const objectId =
      new mongoose.Types.ObjectId(userId);

   const [
      completed,
      enrolled,
      pendingApprovals
   ] = await Promise.all([

      enrollment.countDocuments({
         userId: objectId,
         status: ENROLLMENT_STATUS.COMPLETED
      }),

      enrollment.countDocuments({
         userId: objectId,
         status: ENROLLMENT_STATUS.ACTIVE
      }),

      enrollment.countDocuments({
         userId: objectId,
         approvalStatus:
            APPROVAL_STATUS.PENDING
      })
   ]);

   return {
      programsCompleted: completed,
      programsEnrolled: enrolled,
      pendingApprovals
   };
};

//Approval Chart in employee dashboard

export const getApprovalStatsRepo = async (
   userId: string
) => {

   const stats =
      await enrollment.aggregate([
         {
            $match: {
               userId:
                  new mongoose.Types.ObjectId(userId)
            }
         },
         {
            $group: {
               _id: "$approvalStatus",
               count: {
                  $sum: 1
               }
            }
         }
      ]);

   const result: Record<ApprovalStatus, number> = {
      approved: 0,
      pending: 0,
      dismissed:0
   };

   stats.forEach((item) => {
      const key = item._id as ApprovalStatus;
      result[key] = item.count;
   });

   return result;
};

//listed program need to employee Dashboard
export const getListedProgramsRepo = async (
  userId: string
) => {

  return Program.aggregate([
    {
      $match: {
        status:
          PROGRAM_SAVED_STATUS.PUBLISHED
      }
    },

    {
      $lookup: {
        from: "enrollments",
        let: {
          programId: "$_id"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      "$programId",
                      "$$programId"
                    ]
                  },
                  {
                    $eq: [
                      "$userId",
                      new mongoose.Types.ObjectId(
                        userId
                      )
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: "enrollment"
      }
    },

    {
      $addFields: {
        enrollment: {
          $arrayElemAt: [
            "$enrollment",
            0
          ]
        }
      }
    },

    {
      $project: {
        title: 1,
        venue: 1,
        startDate: 1,
        endDate: 1,

        status: {
          $switch: {
            branches: [
              {
                case: {
                  $eq: [
                    "$enrollment.status",
                    "completed" 
                  ]
                },
                then: "Completed"  
              },
              {
                case: {
                  $eq: [
                    "$enrollment.status",
                    "active"
                  ]
                },
                then: "Enrolled"
              },
              {
                case: {
                  $eq: [
                    "$enrollment.status",
                    "cancelled"
                  ]
                },
                then: "Rejected"
              }
            ],
            default: "Pending"
          }
        }
      }
    }
  ]);
};