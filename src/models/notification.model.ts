import mongoose, { Schema } from "mongoose";
import { INotification } from "../interfaces/notification.interface.js";



const notificationSchema = new Schema<INotification>(
   {
      userId: {
         type: Schema.Types.ObjectId,
         required: true,
         index: true,
      },

      type: {
         type: String,
         required: true,
      },

      title: {
         type: String,
         required: true,
      },

      message: {
         type: String,
         required: true,
      },

      icon: {
         type: String,
         required: true,
      },

      color: {
         type: String,
         required: true,
      },

      read: {
         type: Boolean,
         default: false,
      },

      relatedEntityId: {
         type: Schema.Types.ObjectId,
         default: null,
      },

      readAt: {
         type: Date,
         default: null,
      },
   },
   {
      timestamps: true,
   }
);

const Notification = mongoose.model<INotification>(
   "Notification",
   notificationSchema
);

notificationSchema.index({
   userId: 1,
   createdAt: -1,
});

notificationSchema.index({
   userId: 1,
   read: 1,
});

export default Notification;