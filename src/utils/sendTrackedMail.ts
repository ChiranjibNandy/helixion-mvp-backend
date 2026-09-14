import { ENV } from "../config/env.js";
import { EMAIL_STATUS, EmailLog } from "../models/emailLog.model.js";
import { toObjectId } from "./mongo.js";
import { transporter } from "./sendMail.js";

export const sendTrackedMail = async ({
   to,
   subject,
   html,
   templateName,
   relatedEntityId,
}: {
   to: string;
   subject: string;
   html: string;
   templateName: string;
   relatedEntityId?: string;
}) => {
   try {
      await transporter.sendMail({
         from: ENV.EMAIL_USER,
         to,
         subject,
         html,
      });

      // Log success
      await EmailLog.create({
         recipientEmail: to,
         templateName,
         subject,
         status: EMAIL_STATUS.SENT,
         relatedEntityId: relatedEntityId ? toObjectId(relatedEntityId) : null,
      });
   } catch (error: any) {
      // Log failure with error message
      await EmailLog.create({
         recipientEmail: to,
         templateName,
         subject,
         status: EMAIL_STATUS.FAILED,
         errorReason: error?.message || "Unknown error occurred during email transport",
         relatedEntityId: relatedEntityId ? toObjectId(relatedEntityId) : null,
      });

      // Re-throw if caller needs to catch it
      throw error;
   }
};