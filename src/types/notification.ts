export type CreateNotification = {
   userId: string;
   type: string;
   title: string;
   message: string;
   icon: string;
   color: string;
   relatedEntityId?: string;
};