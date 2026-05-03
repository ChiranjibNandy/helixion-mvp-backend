import nodemailer from "nodemailer";
import { ENV } from "../config/env.js";

export const sendResetMail = async (
  email: string,
  userId: string,
  username:string
) => {

  const resetUrl =
    `${ ENV.FRONTEND_URL }/reset-password/${ userId }`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: ENV.EMAIL_USER,
      pass: ENV.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Reset Your Helixon Password",

    html: `
  <div style="
    font-family: Arial, sans-serif;
    max-width:600px;
    margin:auto;
    padding:30px;
    border:1px solid #ddd;
    border-radius:10px;
  ">

    <h2 style="color:#222;">
      Helixon Password Reset Request
    </h2>

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
        href="${ resetUrl }"
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
  `
  });

};