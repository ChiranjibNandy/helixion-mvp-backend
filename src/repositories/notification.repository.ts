import Notification from "../models/notification.model.js";
import { toObjectId } from "../utils/mongo.js";

export const createNotification = async (
  userId: string,
  template: {
    type: string;
    title: string;
    message: string;
    icon: string;
    color: string;
  },
  data: {
    programTitle: string;
  },
  relatedEntityId: string
) => {
  await Notification.create({
    userId: toObjectId(userId),
    type: template.type,
    title: template.title,
    message: template.message.replace(
      "{{programTitle}}",
      data.programTitle
    ),
    icon: template.icon,
    color: template.color,
    read: false,
    relatedEntityId: toObjectId(relatedEntityId),
    readAt: null,
  });
};

export const getEmployeeNotificationsRepo = async (userId: string) => {
   return await Notification.find({
      userId: toObjectId(userId),
   })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
};

export const getEmployeeUnreadNotificationCountRepo = async (
   userId: string
) => {
   return await Notification.countDocuments({
      userId: toObjectId(userId),
      read: false,
   });
};

//mark read
export const markNotificationAsReadRepo = async (
   userId: string,
   notificationId: string
) => {
   return await Notification.findOneAndUpdate(
      {
         _id: toObjectId(notificationId),
         userId: toObjectId(userId),
         read: false,
      },
      {
         $set: {
            read: true,
            readAt: new Date(),
         },
      },
      {
         new: true,
      }
   );
};