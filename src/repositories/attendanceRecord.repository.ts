import mongoose from "mongoose";
import attendanceRecordModel from "../models/attendanceRecord.model.js";
import enrollmentModel from "../models/enrollment.model.js";
import programModel from "../models/program.model.js";
import { TP_NOT_YET_VISIBLE_STAGES } from "../constants/enum.js";
import { toObjectId } from "../utils/mongo.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { getUTCStartOfDay } from "../utils/date.js";
import { IAttendanceDayEntry } from "../interfaces/attendanceRecord.interface.js";

const VISIBLE_ENROLLMENT_FILTER = (programId: string) => ({
  programId: toObjectId(programId),
  currentStage: { $nin: TP_NOT_YET_VISIBLE_STAGES },
});

export const getProgramEnrollmentsForGridRepo = async (
  programId: string,
  page: number,
  limit: number,
  search: string,
  sortBy: string,
  sortOrder: 1 | -1
) => {
  const matchStage: Record<string, unknown> = { ...VISIBLE_ENROLLMENT_FILTER(programId) };

  const pipeline: mongoose.PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: "users",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: "$employee" },
  ];

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    pipeline.push({
      $match: {
        $or: [{ "employee.name": regex }, { "employee.email": regex }],
      },
    });
  }

  pipeline.push({
    $facet: {
      data: [
        { $sort: { [`employee.${sortBy}`]: sortOrder } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            employeeId: "$employee._id",
            employeeName: "$employee.name",
            employeeEmail: "$employee.email",
            department: "$employee.department",
            hasAttendanceMarked: "$attendance.hasAttendanceMarked",
          },
        },
      ],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await enrollmentModel.aggregate(pipeline);
  return {
    enrollments: result?.data ?? [],
    total: result?.total?.[0]?.count ?? 0,
  };
};

export const countEligibleEnrollmentsRepo = async (programId: string) => {
  return await enrollmentModel.countDocuments(VISIBLE_ENROLLMENT_FILTER(programId));
};


export const getEligibleEnrollmentForAttendanceRepo = async (
  programId: string,
  enrollmentId: string
) => {
  return await enrollmentModel.findOne({
    _id: toObjectId(enrollmentId),
    ...VISIBLE_ENROLLMENT_FILTER(programId),
  });
};

export const getAllAttendanceRecordsForProgramRepo = async (programId: string) => {
  return await attendanceRecordModel
    .find({ programId: toObjectId(programId) })
    .select("employeeId attendanceByDay notes")
    .lean();
};

export const getAttendanceRecordsByEnrollmentIdsRepo = async (enrollmentIds: string[]) => {
  if (enrollmentIds.length === 0) return [];
  return await attendanceRecordModel
    .find({ enrollmentId: { $in: enrollmentIds.map(toObjectId) } })
    .lean();
};

const upsertAttendanceRecord = async (
  enrollmentId: string,
  programId: string,
  employeeId: string,
  update: Record<string, unknown>
) => {
  const filter = {
    enrollmentId: toObjectId(enrollmentId),
    programId: toObjectId(programId),
  };
  const fullUpdate = {
    $setOnInsert: {
      enrollmentId: toObjectId(enrollmentId),
      programId: toObjectId(programId),
      employeeId: toObjectId(employeeId),
    },
    ...update,
  };
  const options = { upsert: true, new: true, runValidators: true };

  let record;
  try {
    record = await attendanceRecordModel.findOneAndUpdate(filter, fullUpdate, options).lean();
  } catch (error: any) {
    if (error?.code !== 11000) throw error;

    record = await attendanceRecordModel.findOneAndUpdate(filter, update, { new: true, runValidators: true }).lean();
  }

  if (!record) {
    throw new Error(`AttendanceRecord for enrollment ${enrollmentId} vanished during a concurrent write`);
  }
  return record;
};

export const upsertAttendanceDayRepo = async (
  enrollmentId: string,
  programId: string,
  employeeId: string,
  date: string,
  entry: IAttendanceDayEntry
) => {
  return await upsertAttendanceRecord(enrollmentId, programId, employeeId, {
    $set: { [`attendanceByDay.${date}`]: entry },
  });
};

export const updateAttendanceNotesRepo = async (
  enrollmentId: string,
  programId: string,
  employeeId: string,
  notes: string
) => {
  return await upsertAttendanceRecord(enrollmentId, programId, employeeId, {
    $set: { notes },
  });
};

export const markProgramAttendanceUpdatedRepo = async (programId: string) => {
  const attendanceMarkedCount = await attendanceRecordModel.countDocuments({
    programId: toObjectId(programId),
  });

  await programModel.updateOne(
    { _id: toObjectId(programId) },
    {
      $set: {
        attendanceMarked: true,
        attendanceMarkedCount,
        lastAttendanceUpdate: new Date(),
      },
    }
  );
};

export const markEnrollmentAttendanceStartedRepo = async (enrollmentId: string) => {
  await enrollmentModel.updateOne(
    { _id: toObjectId(enrollmentId) },
    { $set: { "attendance.hasAttendanceMarked": true } }
  );
};


export const getTodayAttendanceTaken = async (trainingProviderId: string) => {
  const todayStart = getUTCStartOfDay();

  const result = await attendanceRecordModel.aggregate([
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "program",
      },
    },
    { $unwind: "$program" },
    { $match: { "program.createdBy": toObjectId(trainingProviderId) } },
    { $addFields: { days: { $objectToArray: "$attendanceByDay" } } },
    { $unwind: "$days" },
    { $match: { "days.v.markedAt": { $gte: todayStart } } },
    {
      $group: {
        _id: "$programId",
        programTitle: { $first: "$program.title" },
        attendanceCount: { $sum: 1 },
        uploadedAt: { $max: "$days.v.markedAt" },
      },
    },
    { $sort: { uploadedAt: -1 } },
    { $limit: 1 },
    { $project: { _id: 0, programTitle: 1, attendanceCount: 1, uploadedAt: 1 } },
  ]);

  return result[0] || null;
};

export const getAttendanceActivities = async (trainingProviderId: string) => {
  const todayStart = getUTCStartOfDay();

  const result = await attendanceRecordModel.aggregate([
    { $match: { updatedAt: { $gte: todayStart } } },
    {
      $lookup: {
        from: "programs",
        localField: "programId",
        foreignField: "_id",
        as: "program",
      },
    },
    { $unwind: "$program" },
    { $match: { "program.createdBy": toObjectId(trainingProviderId) } },
    { $sort: { updatedAt: -1 } },
    { $limit: 1 },
  ]);

  if (!result.length) return [];

  return [
    {
      type: "attendance",
      message: `Attendance uploaded for ${result[0].program.title}`,
      time: result[0].updatedAt,
    },
  ];
};
