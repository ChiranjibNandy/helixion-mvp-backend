import mongoose from "mongoose";
import enrollmentModel from "../models/enrollment.model.js";
import {
  ENROLLMENT_STATUS,
  STAY_TYPE_KEY,
  CURRENCY,
  ENROLLMENT_APPROVAL_STATUS,
  ENROLLMENT_SOURCE,
} from "../constants/enum.js";

export interface CreateEnrollmentPayload {
  userId:          mongoose.Types.ObjectId;
  programId:       mongoose.Types.ObjectId;
  stayType:        STAY_TYPE_KEY;
  feeAmount:       number;
  currency:        CURRENCY;
  programSnapshot: {
    title:               string;
    startDate?:          Date;
    endDate?:            Date;
    venue?:              string;
    training_providerId: mongoose.Types.ObjectId;
  };
  locationMatched: boolean;
  approvalStatus:  ENROLLMENT_APPROVAL_STATUS;
  source:          ENROLLMENT_SOURCE;
  notes?:          string;
}

export const createEnrollmentRepo = async (payload: CreateEnrollmentPayload) => {
  return await enrollmentModel.create({
    userId:          payload.userId,
    programId:       payload.programId,
    status:          ENROLLMENT_STATUS.ACTIVE,
    stayType:        payload.stayType,
    feeAmount:       payload.feeAmount,
    currency:        payload.currency,
    programSnapshot: payload.programSnapshot,
    locationMatched: payload.locationMatched,
    approvalStatus:  payload.approvalStatus,
    source:          payload.source,
    notes:           payload.notes,
  });
};

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
