import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import programModel from "../models/program.model.js";
import enrollmentModel from "../models/enrollment.model.js";

const backfillPrograms = async () => {
  const result = await programModel.updateMany(
    { attendanceMarked: { $exists: false } },
    {
      $set: {
        attendanceMarked: false,
        attendanceMarkedCount: 0,
        lastAttendanceUpdate: null,
      },
    }
  );
  console.log(`[backfill] programs matched=${result.matchedCount} modified=${result.modifiedCount}`);
};

const backfillEnrollments = async () => {
  const result = await enrollmentModel.updateMany(
    { "attendance.hasAttendanceMarked": { $exists: false } },
    { $set: { "attendance.hasAttendanceMarked": false } }
  );
  console.log(`[backfill] enrollments matched=${result.matchedCount} modified=${result.modifiedCount}`);
};

const main = async () => {
  await mongoose.connect(ENV.MONGO_URI);
  console.log("[backfill] connected to MongoDB");

  await backfillPrograms();
  await backfillEnrollments();

  await mongoose.disconnect();
  console.log("[backfill] done");
};

main().catch((error) => {
  console.error("[backfill] failed:", error);
  process.exit(1);
});
