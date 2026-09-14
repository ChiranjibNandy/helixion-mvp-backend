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

/**
 * Generates HTML email body for approved local program enrollments.
 */
export function buildApprovedLocalEmailBody(
  employeeName: string,
  programTitle: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 20px; }
          .container { max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; border: 1px solid #e2e8f0; }
          .header { background-color: #10b981; color: #ffffff; padding: 24px; text-align: center; }
          .content { padding: 24px; line-height: 1.6; }
          .badge { display: inline-block; background-color: #ecfdf5; color: #047857; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 10px; }
          .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 20px;">Enrollment Approved!</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${employeeName}</strong>,</p>
            <p>Great news! Your manager has approved your request to enroll in the following program:</p>
            
            <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #10b981; border-radius: 4px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #0f172a;">${programTitle}</h3>
              <span class="badge">Type: Local Program</span>
            </div>

            <p>Since this is a local program, no outstation travel or accommodation logistics are required. Please check your dashboard for further schedule details and instructions.</p>
            
            <p>Best regards,<br><strong>Learning & Development Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates HTML email body for approved outstation program enrollments.
 */
export function buildApprovedOutstationEmailBody(
  employeeName: string,
  programTitle: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 20px; }
          .container { max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin: 0 auto; border: 1px solid #e2e8f0; }
          .header { background-color: #2563eb; color: #ffffff; padding: 24px; text-align: center; }
          .content { padding: 24px; line-height: 1.6; }
          .badge { display: inline-block; background-color: #eff6ff; color: #1d4ed8; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 10px; }
          .info-box { background-color: #fffbe3; border: 1px solid #fef3c7; padding: 14px; border-radius: 6px; font-size: 13px; color: #92400e; margin-top: 20px; }
          .footer { background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 20px;">Enrollment Approved!</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${employeeName}</strong>,</p>
            <p>Great news! Your manager has approved your request to enroll in the outstation program:</p>
            
            <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #2563eb; border-radius: 4px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #0f172a;">${programTitle}</h3>
              <span class="badge">Type: Outstation Program</span>
            </div>

            <p>Please log into your portal to view travel guidelines and complete any necessary pre-travel arrangements or booking requests.</p>
            
            <div class="info-box">
              <strong>Note for Outstation Travel:</strong> Make sure to coordinate with your department admin regarding travel desk approvals and travel expense claims.
            </div>

            <p style="margin-top:20px;">Best regards,<br><strong>Learning & Development Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}