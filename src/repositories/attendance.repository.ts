import mongoose from "mongoose";
import attendanceModel from "../models/attendance.model.js";
import { TakeAttendancePayload, UpdateParticipantAttendancePayload } from "../types/attendance.js";


//take attendance on corresponding project for multiple participant at a time
export const upsertAttendanceRepo = async (
  payload: TakeAttendancePayload
) => {
  const { programId, date, participants } = payload;

  return await attendanceModel.findOneAndUpdate(
    {
      programId,
      date,
    },
    {
      $set: {
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

//return attendance data based on Id and  lookup with participantId

export const getAttendanceByIdRepo = async (
  attendanceId: string
) => {
  return await attendanceModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(
          attendanceId
        )
      }
    },

    {
      $unwind: "$participants"
    },

    {
      $lookup: {
        from: "users",
        localField: "participants.participantId",
        foreignField: "_id",
        as: "participant"
      }
    },

    {
      $unwind: "$participant"
    },

    {
      $project: {
        _id: 0,

        participantId: "$participant._id",

        username: "$participant.username",

        email: "$participant.email",

        present_status:
          "$participants.present_status",

        date: "$date",

        programId: "$programId"
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