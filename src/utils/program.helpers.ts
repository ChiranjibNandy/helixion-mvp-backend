import { PROGRAM_ENROLLMENT_STATUS } from "../constants/enum.js";
import { UPCOMING_PROGRAMS_DAYS_THRESHOLD } from "../constants/program.js";

export const getProgramEnrollmentStatusExpression = () => ({
  $switch: {
    branches: [
      {
        case: {
          $gt: ["$enrolledCount", "$maxParticipants"],
        },
        then: PROGRAM_ENROLLMENT_STATUS.OVER_ENROLLED,
      },
      {
        case: {
          $gte: ["$enrolledCount", "$minParticipants"],
        },
        then: PROGRAM_ENROLLMENT_STATUS.ON_TRACK,
      },
      {
        case: {
          $lte: [
            "$daysToGo",
            UPCOMING_PROGRAMS_DAYS_THRESHOLD.CRITICAL,
          ],
        },
        then: PROGRAM_ENROLLMENT_STATUS.CRITICAL,
      },
      {
        case: {
          $lt: ["$enrolledCount", "$minParticipants"],
        },
        then: PROGRAM_ENROLLMENT_STATUS.BELOW_MINIMUM,
      },
    ],
    default: PROGRAM_ENROLLMENT_STATUS.ON_TRACK,
  },
});
