type NotificationData = {
   programTitle: string;
};

export const NOTIFICATION_TEMPLATES = {
   ENROLLMENT_APPROVED_LOCAL: {
      title: "Enrollment Approved",
      message: "Your enrollment for {{programTitle}} has been approved.",
      emailSubject: "Enrollment Approved",

      emailBody: (data: NotificationData) =>
         `Your enrollment for <strong>${ data.programTitle }</strong> has been approved.
      No travel action is required. Please attend the training as scheduled.`,

      type: "enrollment_approved",
      icon: "check-circle",
      color: "green",
   },

   ENROLLMENT_REJECTED: {
      title: "Enrollment Rejected",
      message: "Your enrollment for {{programTitle}} was rejected.",
      emailSubject: "Enrollment Rejected",

      emailBody: (data: NotificationData) =>
         `Your enrollment for <strong>${ data.programTitle }</strong> has been rejected
      by your manager. Please contact them for details.`,

      type: "enrollment_rejected",
      icon: "x-circle",
      color: "red",
   },
   CTD_APPROVED: {
      title: "Travel Approved",
      message:
         "Your travel request for {{programTitle}} has been approved by the Training Dept.",

      emailSubject: "Travel Request Approved",

      emailBody: (data: NotificationData) =>
         `Your travel request for <strong>${ data.programTitle }</strong> has been approved by the Training Dept.
    Please proceed with the necessary travel arrangements.`,

      type: "ctd_approved",
      icon: "check-circle",
      color: "green",
   },
   ENROLLMENT_APPROVED_OUTSTATION: {
      title: "Enrollment Approved",
      message:
         "Your enrollment for {{programTitle}} has been approved. Travel arrangements are required.",

      emailSubject: "Enrollment Approved",

      emailBody: (data: NotificationData) =>
         `Your enrollment for <strong>${ data.programTitle }</strong> has been approved.
    Since the training is outstation, please proceed with the required travel arrangements.`,

      type: "enrollment_approved",
      icon: "check-circle",
      color: "green",
   },
};


export  const buildRejectedEmailBody = (
   username: string,
   programTitle: string
): string => {
   return `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
         <h2>Enrollment Request Status</h2>
         <p>Hello <strong>${username}</strong>,</p>
         <p>We regret to inform you that your enrollment request for <strong>${programTitle}</strong> has been rejected.</p>
         <p>If you have any questions or require further clarification, please contact your line manager or HR training team.</p>
      </div>
   `;
};