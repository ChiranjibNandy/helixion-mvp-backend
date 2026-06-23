import mongoose from "mongoose";
import enrollmentModel from "../models/enrollment.model.js";
import { toObjectId } from "../utils/mongo.js";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import { ENROLLMENT_STATUS, APPROVAL_STATUS, ENROLLMENT_STAGE } from "../constants/enum.js";

export const checkExistingEnrollmentRepo = async (
  userId: mongoose.Types.ObjectId,
  programId: mongoose.Types.ObjectId
) => {
  return await enrollmentModel.findOne({
    userId,
    programId,
    status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] },
  });
};

export const getEnrollmentCountForProgramRepo = async (
  programId: mongoose.Types.ObjectId
) => {
  return await enrollmentModel.countDocuments({
    programId,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
};

export const getEnrollmentByIdAndUserRepo = async (
  enrollmentId: string,
  userId: string
) => {
  return await enrollmentModel.findOne({
    _id:    new mongoose.Types.ObjectId(enrollmentId),
    userId: new mongoose.Types.ObjectId(userId),
  });
};

export const getActiveEnrollmentsRepo = async (userId: string) => {
  return await enrollmentModel.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: ENROLLMENT_STATUS.ACTIVE,
      },
    },
    {
      $lookup: {
        from:         "programs",
        localField:   "programId",
        foreignField: "_id",
        as:           "programDetails",
      },
    },
    {
      $addFields: {
        programDetails: { $arrayElemAt: ["$programDetails", 0] },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
};

export const getProgramParticipantsRepo = async (programId: string) => {
  return await enrollmentModel
    .find({
      programId: new mongoose.Types.ObjectId(programId),
      status:    ENROLLMENT_STATUS.ACTIVE,
    })
    .populate({ path: "userId", select: "_id username email" });
};

export const validateParticipantsEnrollmentRepo = async (
  programId: string,
  participantIds: string[]
) => {
  return await enrollmentModel
    .find({
      programId: new mongoose.Types.ObjectId(programId),
      userId:    { $in: participantIds.map((id) => new mongoose.Types.ObjectId(id)) },
      status:    ENROLLMENT_STATUS.ACTIVE,
    })
    .select("userId");
};

export const getTotalEnrollments = async (trainingProviderId: string) => {
  const result = await enrollmentModel.aggregate([
    {
      $lookup: {
        from: "programs",
        let:  { programId: "$programId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$programId"] },
                  { $eq: ["$training_providerId", new mongoose.Types.ObjectId(trainingProviderId)] },
                ],
              },
            },
          },
        ],
        as: "program",
      },
    },
    { $match: { "program.0": { $exists: true } } },
    { $count: "total" },
  ]);

  return result[0]?.total || 0;
};

export const getTodayEnrollmentCount = async (trainingProviderId: string) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await enrollmentModel.aggregate([
    { $match: { createdAt: { $gte: todayStart } } },
    {
      $lookup: {
        from: "programs",
        let:  { programId: "$programId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$programId"] },
                  { $eq: ["$training_providerId", new mongoose.Types.ObjectId(trainingProviderId)] },
                ],
              },
            },
          },
        ],
        as: "program",
      },
    },
    { $match: { "program.0": { $exists: true } } },
    { $count: "count" },
  ]);

  return result[0]?.count || 0;
};

export const getEnrollmentActivities = async (trainingProviderId: string) => {
  const count = await getTodayEnrollmentCount(trainingProviderId);
  if (!count) return [];

  return [
    {
      type:    "enrollment",
      message: `${count} new enrollments received today`,
      time:    new Date(),
    },
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

export const getManagerDashboardSummaryRepo = async (managerId: string) => {
   const managOId = toObjectId(managerId);

   const [personalResult, teamResult] = await Promise.all([
      // Manager's own enrollments (personal stats)
      enrollmentModel.aggregate([
         { $match: { $or: [{ userId: managOId }, { employeeId: managOId }] } },
         {
            $facet: {
               completed: [{ $match: { status: ENROLLMENT_STATUS.COMPLETED } }, { $count: "n" }],
               active: [{ $match: { status: ENROLLMENT_STATUS.ACTIVE } }, { $count: "n" }],
            },
         },
      ]),
      // Team-wide stats (org-wide until hierarchy is modelled).
      // $match before $facet so MongoDB can use { status, currentStage } indexes.
      enrollmentModel.aggregate([
         {
            $match: {
               $or: [
                  { currentStage: { $in: [ENROLLMENT_STAGE.SUBMITTED, ENROLLMENT_STAGE.MANAGER_REVIEW] } },
                  { status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] } },
               ],
            },
         },
         {
            $facet: {
               pendingApprovals: [
                  { $match: { currentStage: { $in: [ENROLLMENT_STAGE.SUBMITTED, ENROLLMENT_STAGE.MANAGER_REVIEW] } } },
                  { $count: "n" },
               ],
               teamEnrollments: [
                  { $match: { status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] } } },
                  { $count: "n" },
               ],
            },
         },
      ]),
   ]);

   const p = personalResult[0];
   const t = teamResult[0];
   return {
      programsCompleted: p.completed[0]?.n ?? 0,
      programsEnrolled: p.active[0]?.n ?? 0,
      pendingApprovals: t.pendingApprovals[0]?.n ?? 0,
      teamEnrollments: t.teamEnrollments[0]?.n ?? 0,
   };
};

export const getManagerApprovalStatsRepo = async (_managerId: string) => {
   const stats = await enrollmentModel.aggregate([
      { $group: { _id: "$managerApproval.action", count: { $sum: 1 } } },
   ]);
   const result: Record<string, number> = { approved: 0, pending: 0, dismissed: 0 };
   stats.forEach((item) => { if (item._id) result[item._id] = item.count; });
   return result;
};

export const getManagerPendingTeamEnrollmentsRepo = async (_managerId: string) => {
   return await enrollmentModel.aggregate([
      {
         // Show all active/pending enrollments regardless of assignedApproverId
         $match: {
            status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] },
         },
      },
      {
         $lookup: {
            from: "users",
            localField: "employeeId",
            foreignField: "_id",
            as: "employee",
         },
      },
      {
         $lookup: {
            from: "programs",
            localField: "programId",
            foreignField: "_id",
            as: "program",
         },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      {
         $addFields: {
            employee: { $arrayElemAt: ["$employee", 0] },
            program: { $arrayElemAt: ["$program", 0] },
         },
      },
      {
         $project: {
            _id: 1,
            employeeName: { $ifNull: ["$employee.username", "$employee.email"] },
            programTitle: "$program.title",
            fromDate: "$program.startDate",
            toDate: "$program.endDate",
            venue: { $ifNull: ["$program.venue", "—"] },
            status: {
               $switch: {
                  branches: [
                     { case: { $eq: ["$managerApproval.action", APPROVAL_STATUS.APPROVED] }, then: "Approved" },
                     { case: { $eq: ["$managerApproval.action", APPROVAL_STATUS.DISMISSED] }, then: "Rejected" },
                  ],
                  default: "Pending Approval",
               },
            },
         },
      },
   ]);
};

