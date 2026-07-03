import mongoose from "mongoose";
import enrollmentModel from "../models/enrollment.model.js";
import { toObjectId } from "../utils/mongo.js";
import { IEnrollment } from "../interfaces/enrollment.interface.js";
import { Types } from "mongoose";
import { ENROLLMENT_STATUS } from "../constants/enum.js";
import { IUser } from "../interfaces/user.interface.js";

export const checkExistingEnrollmentRepo = async (
  userId: mongoose.Types.ObjectId,
  programId: mongoose.Types.ObjectId
) => {
  return await enrollmentModel.findOne({
    userId,
    programId,
    "statusSummary.enrollmentStatus": { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING, ENROLLMENT_STATUS.SUBMITTED] },
  });
};

export const getEnrollmentCountForProgramRepo = async (
  programId: mongoose.Types.ObjectId
) => {
  return await enrollmentModel.countDocuments({
    programId,
    "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.ACTIVE,
  });
};

export const getEnrollmentByIdAndUserRepo = async (
  enrollmentId: string,
  userId: string
) => {
  return await enrollmentModel.findOne({
    _id: new mongoose.Types.ObjectId(enrollmentId),
    userId: new mongoose.Types.ObjectId(userId),
  });
};

export const getActiveEnrollmentsRepo = async (userId: string) => {
  return await enrollmentModel.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.ACTIVE,
      },
    },
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "programDetails",
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
      "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.ACTIVE,
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
      userId: { $in: participantIds.map((id) => new mongoose.Types.ObjectId(id)) },
      "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.ACTIVE,
    })
    .select("userId");
};

export const getTotalEnrollments = async (trainingProviderId: string) => {
  const result = await enrollmentModel.aggregate([
    {
      $lookup: {
        from: "programs",
        let: { programId: "$programId" },
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
        let: { programId: "$programId" },
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
      type: "enrollment",
      message: `${ count } new enrollments received today`,
      time: new Date(),
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
    "statusSummary.enrollmentStatus": { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.PENDING] }
  });
};

export const findEnrollmentByEmployeeIds = async (employeeIds: Types.ObjectId[]) => {
  return enrollmentModel.find({
    employeeId: { $in: employeeIds },
  })
    .populate("employeeId", "username email")
    .populate("programId", "name")
    .sort({ createdAt: -1 });
}

// ─── Manager approval queue ───────────────────────────────────────────────────

export const getPendingEnrollmentsForManagerRepo = async (
  userId: string,
  orgId: string,
  options: { level?: number } = {}
) => {
  const chainFilter: Record<string, unknown> = {
    userId: toObjectId(userId),
    "statusSummary.enrollmentStatus": ENROLLMENT_STATUS.PENDING,
  };

  if (options.level !== undefined) {
    chainFilter.level = options.level;
  }

  return await enrollmentModel
    .find({
      orgId: toObjectId(orgId),
      managerChain: { $elemMatch: chainFilter },
    })
    .populate("employeeId", "name email employeeCode placeOfPosting")
    .populate("programId", "title startDate endDate city venueName")
    .sort({ createdAt: -1 });
};

// ─── Training dept / OSD queues ───────────────────────────────────────────────

export const getPendingEnrollmentsForStageRepo = async (
  orgId: string,
  stage: string
) => {
  return await enrollmentModel
    .find({
      orgId: toObjectId(orgId),
      currentStage: stage,
    })
    .populate("employeeId", "name email employeeCode placeOfPosting")
    .populate("programId", "title startDate endDate city venueName")
    .sort({ createdAt: -1 });
};

export const getEnrollmentByUserIdInManagerChain = async (
  user: IUser,
  page: number,
  limit: number,
  search: string
) => {
  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    {
      $match: {
        orgId: user.orgId,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "employeeId",
        foreignField: "_id",
        as: "employeeId",
      },
    },
    {
      $unwind: "$employeeId",
    },
  ];

  if (search?.trim()) {
    pipeline.push({
      $match: {
        $or: [
          {
            "employeeId.name": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "programSnapshot.title": {
              $regex: search,
              $options: "i",
            },
          },
        ],
      },
    });
  }

  // Total Count
  const totalResult = await enrollmentModel.aggregate([
    ...pipeline,
    {
      $count: "total",
    },
  ]);

  const total = totalResult[0]?.total || 0;

  // Data
  const enrollments = await enrollmentModel.aggregate([
    ...pipeline,
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  return {
    enrollments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
