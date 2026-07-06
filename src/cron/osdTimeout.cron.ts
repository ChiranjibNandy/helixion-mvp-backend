import cron from "node-cron";
import enrollmentModel from "../models/enrollment.model.js";
import { TOUR_STATUS, TRAVEL_TYPE, ENROLLMENT_STAGE, ACTOR_TYPE } from "../constants/enum.js";

// Run every hour to check for timed-out OSD approvals
// "0 * * * *" means at minute 0 past every hour
export const startOsdTimeoutCron = () => {
   cron.schedule("0 * * * *", async () => {
      try {
         console.log("[CRON] Running OSD Timeout check...");

         // Define the timeout duration, e.g., 48 hours ago
         const timeoutThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

         const timedOutEnrollments = await enrollmentModel.find({
            "tour.travelType": TRAVEL_TYPE.COMPANY_ASSISTED,
            "tour.status": { $in: [TOUR_STATUS.SUBMITTED, TOUR_STATUS.MANAGER_APPROVED] },
            "tour.managerApproval.actedAt": { $lt: timeoutThreshold },
         });

         for (const enrollment of timedOutEnrollments) {
            enrollment.tour = {
               ...enrollment.tour,
               travelType: TRAVEL_TYPE.SELF_TRAVEL,
               status: TOUR_STATUS.OSD_TIMEOUT,
            } as any;

            if (enrollment.travelAndStay) {
               enrollment.travelAndStay.status = TOUR_STATUS.REJECTED;
            }

            enrollment.currentStage = ENROLLMENT_STAGE.ATTENDANCE_PENDING;

            enrollment.timeline.push({
               stage: ENROLLMENT_STAGE.ATTENDANCE_PENDING,
               actorType: ACTOR_TYPE.SYSTEM,
               action: "osd_timeout",
               note: "OSD approval timed out. Downgraded to self travel.",
               at: new Date(),
            });

            await enrollment.save();
            console.log(`[CRON] OSD Timeout applied for enrollment ${enrollment._id}`);
         }
      } catch (error) {
         console.error("[CRON] Error in OSD Timeout job:", error);
      }
   });
};
