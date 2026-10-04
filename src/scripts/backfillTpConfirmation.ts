import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import enrollmentModel from "../models/enrollment.model.js";
import { ENROLLMENT_STAGE, TRAVEL_TYPE } from "../constants/enum.js";

const backfillTpConfirmations = async () => {
  const result = await enrollmentModel.updateMany(
    {
      $or: [
        {
          currentStage: {
            $in: [
              ENROLLMENT_STAGE.TOUR_PENDING_EMPLOYEE,
              ENROLLMENT_STAGE.TOUR_MANAGER_REVIEW,
              ENROLLMENT_STAGE.TOUR_CTD_REVIEW,
            ],
          },
        },
        {
          "tour.travelType": { $ne: TRAVEL_TYPE.LOCAL },
          currentStage: {
            $nin: [
              ENROLLMENT_STAGE.SUBMITTED,
              ENROLLMENT_STAGE.MANAGER_REVIEW,
              ENROLLMENT_STAGE.TRAINING_DEPT_REVIEW,
              ENROLLMENT_STAGE.REJECTED,
              ENROLLMENT_STAGE.TP_PENDING_CONFIRMATION,
            ],
          },
        },
      ],
      "tpConfirmation.confirmedAt": { $exists: false },
    },
    {
      $set: {
        "tpConfirmation.confirmedAt": new Date(),
        "tpConfirmation.notes": "Auto-confirmed — enrolled before the TP confirmation gate (ticket 0066) existed.",
      },
    }
  );
  console.log(`[backfill] tpConfirmation matched=${result.matchedCount} modified=${result.modifiedCount}`);
};

const main = async () => {
  await mongoose.connect(ENV.MONGO_URI);
  console.log("[backfill] connected to MongoDB");

  await backfillTpConfirmations();

  await mongoose.disconnect();
  console.log("[backfill] done");
};

main().catch((error) => {
  console.error("[backfill] failed:", error);
  process.exit(1);
});
