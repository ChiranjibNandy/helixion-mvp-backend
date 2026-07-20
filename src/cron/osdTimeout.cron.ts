import cron from "node-cron";
import enrollmentModel from "../models/enrollment.model.js";
import { TOUR_STATUS, TRAVEL_TYPE, ACTOR_TYPE } from "../constants/enum.js";
import { sendTravelRequestTimedOutMail } from "../utils/sendMail.js";
import { loadNotificationContext, logMailFailure } from "../utils/notification.util.js";

// Run every hour to check for timed-out tour approvals (Manager or CTD stage)
// "0 * * * *" means at minute 0 past every hour
export const startOsdTimeoutCron = () => {
   cron.schedule("0 * * * *", async () => {
      try {
         console.log("[CRON] Running tour approval timeout check...");

         // Define the timeout duration, e.g., 48 hours ago
         const timeoutThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

         const timedOutEnrollments = await enrollmentModel.find({
            "tour.travelType": TRAVEL_TYPE.COMPANY_ASSISTED,
            $or: [
               {
                  "tour.status": TOUR_STATUS.SUBMITTED,
                  createdAt: { $lt: timeoutThreshold },
               },
               {
                  "tour.status": TOUR_STATUS.MANAGER_APPROVED,
                  "tour.managerApproval.actedAt": { $lt: timeoutThreshold },
               },
            ],
         });

         for (const enrollment of timedOutEnrollments) {
            const updateOps: Record<string, any> = {
               $set: {
                  "tour.travelType": TRAVEL_TYPE.SELF_TRAVEL,
                  "tour.status": TOUR_STATUS.CTD_TIMEOUT,
               },
               $push: {
                  timeline: {
                     stage: enrollment.currentStage,
                     actorType: ACTOR_TYPE.SYSTEM,
                     action: "ctd_timeout",
                     note: "Training Dept approval timed out. Downgraded to self travel.",
                     at: new Date(),
                  },
               },
            };

            if (enrollment.travelAndStay) {
               updateOps.$set["travelAndStay.status"] = TOUR_STATUS.REJECTED;
            }

            const updated = await enrollmentModel.findOneAndUpdate(
               {
                  _id: enrollment._id,
                  "tour.status": { $in: [TOUR_STATUS.SUBMITTED, TOUR_STATUS.MANAGER_APPROVED] },
               },
               updateOps
            );

            if (!updated) continue;

            console.log(`[CRON] Tour approval timeout applied for enrollment ${enrollment._id}`);

            loadNotificationContext(String(enrollment.employeeId), String(enrollment.programId))
               .then(({ employee, programTitle }) => {
                  if (!employee) return;
                  return sendTravelRequestTimedOutMail(employee.email, employee.name, programTitle);
               })
               .catch(logMailFailure("tour-ctd-timeout"));
         }
      } catch (error) {
         console.error("[CRON] Error in tour approval timeout job:", error);
      }
   });
};

