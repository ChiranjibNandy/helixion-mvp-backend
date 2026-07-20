import nodemailer from "nodemailer";
import { ENV } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  family: 4,
  auth: {
    user: ENV.EMAIL_USER,
    pass: ENV.EMAIL_PASS
  }
} as any);

export const sendMail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({
    from: ENV.EMAIL_USER,
    to,
    subject,
    html
  });
};

const wrapTemplate = (title: string, bodyHtml: string) => `
  <div style="
    font-family: Arial, sans-serif;
    max-width:600px;
    margin:auto;
    padding:30px;
    border:1px solid #ddd;
    border-radius:10px;
  ">

    <h2 style="color:#222;">
      ${title}
    </h2>

    ${bodyHtml}

    <br/>

    <p>
      Regards,<br/>
      <strong>Helixon Support Team</strong>
    </p>

    <hr style="margin-top:30px;" />

    <small style="color:gray;">
      This is an automated message. Please do not reply to this email.
    </small>

  </div>
`;

export const sendResetMail = async (
  email: string,
  userId: string,
  username: string
) => {
  const resetUrl = `${ENV.FRONTEND_URL}/reset-password/${userId}`;

  await sendMail(
    email,
    "Reset Your Helixon Password",
    wrapTemplate(
      "Helixon Password Reset Request",
      `
    <p>
      Hello,${username}
    </p>

    <p>
      We received a request to reset your password for your
      <strong>Helixon</strong> account.
    </p>

    <p>
      Click the button below to create a new password:
    </p>

    <div style="margin:30px 0;">
      <a
        href="${resetUrl}"
        style="
          background:#2563eb;
          color:white;
          padding:12px 24px;
          text-decoration:none;
          border-radius:6px;
          display:inline-block;
          font-weight:bold;
        "
      >
        Reset Password
      </a>
    </div>

    <p>
      If you did not request a password reset,
      you can safely ignore this email.
    </p>

    <p>
      For security reasons, this link may expire after a limited time.
    </p>
    `
    )
  );
};

export const sendWelcomeMail = async (
  email: string,
  username: string,
  password: string
) => {
  const loginUrl = `${ENV.FRONTEND_URL}/signin`;

  await sendMail(
    email,
    "Welcome to Helixon — Your Account Credentials",
    wrapTemplate(
      "Welcome to Helixon!",
      `
    <p>
      Hello, ${username}
    </p>

    <p>
      Your account has been created by an administrator.
      Below are your login credentials:
    </p>

    <div style="
      background:#f5f5f5;
      padding:16px;
      border-radius:8px;
      margin:20px 0;
    ">
      <p style="margin:4px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin:4px 0;"><strong>Username:</strong> ${username}</p>
      <p style="margin:4px 0;"><strong>Password:</strong> ${password}</p>
    </div>

    <p>
      Please change your password after your first login for security.
    </p>

    <div style="margin:30px 0;">
      <a
        href="${loginUrl}"
        style="
          background:#2563eb;
          color:white;
          padding:12px 24px;
          text-decoration:none;
          border-radius:6px;
          display:inline-block;
          font-weight:bold;
        "
      >
        Login to Helixon
      </a>
    </div>
    `
    )
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Ticket 0033 — workflow-transition notification emails.
//
// Every one of these follows the identical shape: (email, username,
// programTitle) -> sendMail(email, subject, wrapTemplate(title, body)).
// `notificationMail` captures that shape once so each template below is just
// its subject/title/body — adding a new one is a 3-argument call, not a new
// hand-written async function, and there's nowhere for the boilerplate
// (transporter call, wrapTemplate wiring) to drift out of sync between them.
// ─────────────────────────────────────────────────────────────────────────────

type NotificationMailFn = (email: string, username: string, programTitle: string) => Promise<void>;

const notificationMail = (
  subject: string,
  title: string,
  body: (ctx: { username: string; programTitle: string }) => string
): NotificationMailFn =>
  (email, username, programTitle) =>
    sendMail(email, subject, wrapTemplate(title, body({ username, programTitle })));

// ── Wired: these 6 are actually called from the workflow services today ──────

export const sendEnrollmentRejectedMail = notificationMail(
  "Training Enrollment Rejected",
  "Enrollment Rejected",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your enrollment request for <strong>${programTitle}</strong> has been
      rejected by your manager.
    </p>
    <p>Please contact your reporting manager for more details.</p>
  `
);

// Not one of the ticket's 12 named events, but its approval counterpart is —
// a Training Dept rejection producing zero notification at all (found while
// testing the CTD approval flow) was a gap, not a deliberate scope decision,
// matching the same pattern already fixed for reimbursement rejections.
export const sendEnrollmentRejectedByTrainingDeptMail = notificationMail(
  "Training Enrollment Rejected",
  "Enrollment Rejected",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your enrollment request for <strong>${programTitle}</strong> has been
      rejected by the Training Department.
    </p>
    <p>Please contact your Training Department for more details.</p>
  `
);

export const sendEnrollmentApprovedLocalMail = notificationMail(
  "Enrollment Approved",
  "Enrollment Approved",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>Your enrollment for <strong>${programTitle}</strong> has been approved.</p>
    <p>No travel action is required. Please attend the training as scheduled.</p>
  `
);

export const sendEnrollmentApprovedOutstationMail = notificationMail(
  "Select Travel Option",
  "Enrollment Approved",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>Your enrollment for <strong>${programTitle}</strong> has been approved.</p>
    <p>Please select your travel option:</p>
    <ul>
      <li>Self Travel</li>
      <li>Company Assisted Travel</li>
    </ul>
  `
);

export const sendAttendancePresentMail = notificationMail(
  "Submit Reimbursement",
  "Attendance Marked Present",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your attendance for <strong>${programTitle}</strong> has been marked as
      Present.
    </p>
    <p>You may now submit your reimbursement claim.</p>
  `
);

export const sendAttendanceAbsentMail = notificationMail(
  "Attendance Marked Absent",
  "Attendance Marked Absent",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>You have been marked as absent for <strong>${programTitle}</strong>.</p>
    <p>Reimbursement submission is not available.</p>
  `
);

export const sendReimbursementApprovedMail = notificationMail(
  "Reimbursement Approved",
  "Reimbursement Approved",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your reimbursement claim for <strong>${programTitle}</strong> has been
      approved.
    </p>
    <p>The workflow is now complete.</p>
  `
);

// Not one of the ticket's 12 named events, but its approval counterpart is —
// leaving a rejected reimbursement claim completely silent (no email, no
// in-app notification) was a gap found in code review, not a deliberate
// scope decision.
export const sendReimbursementRejectedByManagerMail = notificationMail(
  "Reimbursement Claim Rejected",
  "Reimbursement Claim Rejected",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your reimbursement claim for <strong>${programTitle}</strong> was not
      approved by your manager.
    </p>
    <p>Please contact your reporting manager for more details.</p>
  `
);

export const sendReimbursementRejectedByOsdMail = notificationMail(
  "Reimbursement Claim Rejected",
  "Reimbursement Claim Rejected",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your reimbursement claim for <strong>${programTitle}</strong> was not
      approved by OSD.
    </p>
  `
);

// ── Tour/travel-workflow events (4-9 + OSD timeout) — wired into ────────────
// employee.service.ts (submitTourFormService), manager.service.ts
// (takeTourManagerActionService), osd.service.ts (takeTourOsdActionService),
// and src/cron/osdTimeout.cron.ts.

export const sendSelfTravelSelectedMail = notificationMail(
  "Self Travel Selected",
  "Self Travel Selected",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      You have chosen to make your own travel arrangements for
      <strong>${programTitle}</strong>.
    </p>
    <p>
      Please attend the training as scheduled. You will be able to submit
      reimbursement after attendance is marked as Present.
    </p>
  `
);

export const sendTravelRequestSubmittedMail = notificationMail(
  "Travel Request Submitted",
  "Travel Request Submitted",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your company-assisted travel request for <strong>${programTitle}</strong>
      has been submitted and is awaiting manager approval.
    </p>
  `
);

export const sendTravelRequestUnderCtdReviewMail = notificationMail(
  "Travel Request Under Training Dept Review",
  "Travel Request Under Training Dept Review",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your company-assisted travel request for <strong>${programTitle}</strong>
      has been approved by your manager and is now with the Training Department
      for final approval.
    </p>
  `
);

export const sendTravelRequestRejectedByManagerMail = notificationMail(
  "Company-Assisted Travel Request Rejected",
  "Company-Assisted Travel Request Rejected",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your company-assisted travel request for <strong>${programTitle}</strong>
      was not approved by your manager.
    </p>
    <p>
      The training enrollment has been cancelled. Please contact your
      reporting manager for further details.
    </p>
  `
);

export const sendTravelRequestApprovedMail = notificationMail(
  "Travel Request Approved",
  "Travel Request Approved",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your company-assisted travel request for <strong>${programTitle}</strong>
      has been approved.
    </p>
    <p>Please proceed with the approved travel arrangements.</p>
  `
);

export const sendTravelRequestNotApprovedByCtdMail = notificationMail(
  "Company-Assisted Travel Not Approved",
  "Company-Assisted Travel Not Approved",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your company-assisted travel request for <strong>${programTitle}</strong>
      was not approved by the Training Department.
    </p>
    <p>
      You may proceed with self-arranged travel and submit reimbursement
      after training completion.
    </p>
  `
);

export const sendTravelRequestTimedOutMail = notificationMail(
  "Company-Assisted Travel Request Timed Out",
  "Company-Assisted Travel Request Timed Out",
  ({ username, programTitle }) => `
    <p>Hello, ${username}</p>
    <p>
      Your company-assisted travel request for <strong>${programTitle}</strong>
      could not be processed within the required time.
    </p>
    <p>
      The request has been converted to Self Travel. You may proceed with
      your own travel arrangements and submit reimbursement after training
      completion.
    </p>
  `
);
