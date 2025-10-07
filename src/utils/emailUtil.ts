// email-service/src/utils/emailUtil.ts
import nodemailer from "nodemailer";
import { EMAIL_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from "../secrets";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT || 465,
  secure: true,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
} as nodemailer.TransportOptions);

export const sendMail = async (to: string | string[], subject: string, body: string): Promise<void> => {
  try {
    const message = await transporter.sendMail({
      from: `Dummy Mail ${EMAIL_FROM}`,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html: body,
    });
    console.log("Email sent: %s", message.messageId);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};

// Placeholder for paid service (e.g., SendGrid)
export const sendMailPaid = async (to: string | string[], subject: string, body: string): Promise<void> => {
  console.log("Paid email service not implemented. Using Nodemailer.");
  await sendMail(to, subject, body);
};