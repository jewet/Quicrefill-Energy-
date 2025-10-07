import crypto from "crypto";
import bcrypt from "bcryptjs";
import { deleteCryptoHash, getCryptoHash, storeCryptoHash } from "../../storage/crypto";
import { sendMail } from "../../../services/email"; // Corrected import
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests";
import { AppErrorCode } from "../../../exceptions/root";

export const createResetToken = async (email: string) => {
  const token = crypto.randomBytes(32).toString("hex");
  const key = `user:reset-password-token:${email}`;
  const hashedToken = await bcrypt.hash(token, 10);
  await storeCryptoHash(key, hashedToken);
  return token;
};

export const validateResetToken = async (email: string, token: string) => {
  try {
    const key = `user:reset-password-token:${email}`;
    const hashedToken = await getCryptoHash(key);
    if (hashedToken && await bcrypt.compare(token, hashedToken)) {
      await deleteCryptoHash(key);
      return true;
    }
    return false;
  } catch (err: any) {
    throw new UnauthorizedRequest(
      err.message || "Invalid token",
      AppErrorCode.INVALID_TOKEN
    );
  }
};

export const sendPasswordResetToken = async (email: string, name: string) => {
  const token = await createResetToken(email);
  const link = `http://127.0.0.1:4000/reset-password?token=${token}`;
  const companyName = "Quicrefill";
  const companyAddress = "Abuja";
  const subject = "Password Reset Request";
  const htmlBody = `
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #ffffff;
                }
                .header {
                    text-align: center;
                    padding: 20px 0;
                    background-color: #f8f9fa;
                }
                .logo {
                    max-height: 50px;
                }
                .content {
                    padding: 30px 20px;
                }
                .button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #007bff;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .footer {
                    text-align: center;
                    padding: 20px;
                    font-size: 12px;
                    color: #666666;
                    border-top: 1px solid #eeeeee;
                }
                .warning {
                    font-size: 12px;
                    color: #666666;
                    font-style: italic;
                }
                @media only screen and (max-width: 600px) {
                    .container {
                        width: 100% !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hello ${name},</p>
                    <p>We received a request to reset the password for your account. If you made this request, please click the button below to reset your password:</p>
                    <div style="text-align: center;">
                        <a href="${link}" class="button">Reset Password</a>
                    </div>
                    <p>This password reset link will expire in 30 minutes for security reasons.</p>
                    <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account's security.</p>
                    <p class="warning">For security reasons, never share this email or the reset link with anyone.</p>
                    <p>Best regards,<br>
                    The ${companyName} Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                    <p>${companyName} | ${companyAddress}</p>
                </div>
            </div>
        </body>
    </html>
  `;

  await sendMail(email, { subject, htmlBody, metadata: { userId: email, eventType: "PASSWORD_RESET" } });
};