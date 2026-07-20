import mongoose from "mongoose";
import enrollment from "../models/enrollment.model.js";
import { ENROLLMENT_STAGE, PROGRAM_SAVED_STATUS } from "../constants/enum.js";
import { ApprovalStatus } from "../types/enrollment.js";
import Program from '../models/program.model.js'
import { toObjectId } from "../utils/mongo.js";

// Stages where the enrollment hasn't yet cleared its core (manager/CTD) approval gate.
const PRE_APPROVAL_STAGES = [
  ENROLLMENT_STAGE.SUBMITTED,
  ENROLLMENT_STAGE.MANAGER_REVIEW,
  ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
];

//employee dasboard summary data
export const getDashboardSummaryRepo = async (
  userId: string
) => {

  const objectId = toObjectId(userId)

  const [
    completed,
    enrolled,
    pendingApprovals
  ] = await Promise.all([

    enrollment.countDocuments({
      employeeId: objectId,
      currentStage: ENROLLMENT_STAGE.COMPLETED
    }),

    // "Enrolled" means confirmed/active — past the pre-approval gate, not yet
    // completed or rejected. Enrollments still awaiting approval are reported
    // via pendingApprovals below instead, so a single enrollment is never
    // counted in both tiles at once.
    enrollment.countDocuments({
      employeeId: objectId,
      currentStage: { $nin: [...PRE_APPROVAL_STAGES, ENROLLMENT_STAGE.COMPLETED, ENROLLMENT_STAGE.REJECTED] }
    }),

    enrollment.countDocuments({
      employeeId: objectId,
      currentStage: { $in: PRE_APPROVAL_STAGES }
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
          employeeId: toObjectId(userId)
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ["$currentStage", ENROLLMENT_STAGE.REJECTED] }, then: "dismissed" },
                { case: { $in: ["$currentStage", PRE_APPROVAL_STAGES] }, then: "pending" },
              ],
              default: "approved"
            }
          },
          count: {
            $sum: 1
          }
        }
      }
    ]);

  const result: Record<ApprovalStatus, number> = {
    approved: 0,
    pending: 0,
    dismissed: 0
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
                      "$employeeId",
                      toObjectId(userId)
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
      $sort: {
        startDate: 1
      }
    },
    {
      $project: {
        title: 1,
        venueName: 1,
        startDate: 1,
        endDate: 1,

        status: {
          $switch: {
            branches: [
              {
                case: { $not: ["$enrollment"] },
                then: "Open"
              },
              {
                case: {
                  $eq: [
                    "$enrollment.currentStage",
                    ENROLLMENT_STAGE.COMPLETED
                  ]
                },
                then: "Completed"
              },
              {
                case: {
                  $eq: [
                    "$enrollment.currentStage",
                    ENROLLMENT_STAGE.REJECTED
                  ]
                },
                then: "Rejected"
              },
              {
                case: {
                  $in: [
                    "$enrollment.currentStage",
                    PRE_APPROVAL_STAGES
                  ]
                },
                then: "Pending"
              }
            ],
            default: "Enrolled"
          }
        }
      }
    }
  ]);
};