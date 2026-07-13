import mongoose from "mongoose";
import attendanceModel from "../models/attendance.model.js";
import { TakeAttendancePayload, UpdateParticipantAttendancePayload } from "../types/attendance.js";
import { getUTCStartOfDay } from "../utils/date.js";
import { toObjectId } from "../utils/mongo.js";


//take attendance on corresponding project for multiple participant at a time
export const upsertAttendanceRepo = async (
  payload: TakeAttendancePayload,
  program_title: string
) => {
  const { programId, date, participants, training_providerId } = payload;

  return await attendanceModel.findOneAndUpdate(
    {
      programId: toObjectId(programId),
      date,
    },
    {
      $set: {
        programId: toObjectId(programId),
        date,
        program_title,
        training_providerId,
        participants,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );
};

// return attendance records for a program (newest first)
export const getAttendanceByProgramIdRepo = async (programId: string) => {
  return await attendanceModel.aggregate([
    {
      $match: {
        programId: toObjectId(programId),
      },
    },
    { $sort: { date: -1 } },

    {
      $lookup: {
        from: "users",
        let: {
          participantIds:
            "$participants.participantId"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: [
                  "$_id",
                  "$$participantIds"
                ]
              }
            }
          },
          {
            $project: {
              _id: 1,
              username: 1,
              email: 1
            }
          }
        ],
        as: "participantUsers"
      }
    },

    {
      $project: {
        _id: 0,
        date: 1,
        programId: 1,

        participants: {
          $map: {
            input: "$participants",
            as: "participant",
            in: {
              participantId:
                "$$participant.participantId",

              present_status:
                "$$participant.present_status",

              user: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$participantUsers",
                      as: "user",
                      cond: {
                        $eq: [
                          "$$user._id",
                          "$$participant.participantId"
                        ]
                      }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      }
    }
  ]);
};

//take attendance for single Participant

export const updateParticipantAttendanceRepository =
  async (
    payload: UpdateParticipantAttendancePayload
  ) => {

    const {
      programId,
      participantId,
      date,
      present_status
    } = payload;

    return await attendanceModel.findOneAndUpdate(
      {
        programId,
        date,
        "participants.participantId":
          participantId
      },

      {
        $set: {
          "participants.$.present_status":
            present_status
        }
      },

      {
        new: true
      }
    );
  };

//Today attendance
export const getTodayAttendanceTaken = async (
  trainingProviderId: string
) => {

  const todayStart = getUTCStartOfDay();


  const result = await attendanceModel.aggregate([

    {
      $match: {
        training_providerId:
          new mongoose.Types.ObjectId(
            trainingProviderId
          ),
        createdAt: {
          $gte: todayStart
        }
      }
    },
    {
      $sort: {
        createdAt: -1
      }
    },

    {
      $limit: 1
    },

    {
      $project: {
        programTitle: "$program_title",

        attendanceCount: {
          $size: "$participants"
        },

        uploadedAt: "$createdAt"
      }
    }
  ]);

  return result[0] || null;
};

//Attendance activity

export const getAttendanceActivities = async (
  trainingProviderId: string
) => {

  const todayStart = new Date();

  todayStart.setHours(0, 0, 0, 0);

  const result = await attendanceModel.aggregate([

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
        "program.createdBy":
          new mongoose.Types.ObjectId(
            trainingProviderId
          )
      }
    },

    {
      $sort: {
        createdAt: -1
      }
    },

    {
      $limit: 1
    }
  ]);

  if (!result.length) return [];

  return [
    {
      type: "attendance",
      message:
        `Attendance uploaded for ${ result[0].program.title }`,
      time: result[0].createdAt
    }
  ];
};