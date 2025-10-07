import nodemailer, { Transporter } from "nodemailer";
import { PrismaClient, Role } from "@prisma/client";
import winston from "winston";
import { getRedisClient } from "../config/redis";
import { mapToEventType, KnownEventTypes, RoleEventApplicability } from "../utils/EventTypeDictionary";
import { EmailTemplate, BulkEmailRequest, EmailTemplateRequest, EmailPayload, Metadata } from "../models/messageModel";


// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

// Interface for email settings
interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;
}

// Singleton transporter instance
let transporterInstance: Transporter | null = null;

// Fetch email settings from database with fallback to environment variables
const getEmailConfig = async (): Promise<EmailConfig> => {
  try {
    const emailSettings = await prisma.emailSettings.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPassword: true,
        emailFrom: true,
      },
    });

    if (
      emailSettings &&
      emailSettings.smtpHost &&
      emailSettings.smtpPort &&
      emailSettings.smtpUser &&
      emailSettings.smtpPassword &&
      emailSettings.emailFrom
    ) {
      logger.info("Using email settings from database");
      return {
        smtpHost: emailSettings.smtpHost,
        smtpPort: emailSettings.smtpPort,
        smtpUser: emailSettings.smtpUser,
        smtpPassword: emailSettings.smtpPassword,
        emailFrom: emailSettings.emailFrom,
      };
    } else {
      logger.warn("Incomplete or no email settings found in database, falling back to environment variables");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to fetch email settings from database", { error: errorMessage });
    logger.warn("Falling back to environment variables for email configuration");
  }

  const requiredVars = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  };
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      logger.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    smtpHost: process.env.SMTP_HOST!,
    smtpPort: parseInt(process.env.SMTP_PORT!, 10),
    smtpUser: process.env.SMTP_USER!,
    smtpPassword: process.env.SMTP_PASSWORD!,
    emailFrom: process.env.EMAIL_FROM_ADDRESS!,
  };
};

// Configure Nodemailer transporter
const configureTransporter = async (): Promise<Transporter> => {
  const config = await getEmailConfig();
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
    service: config.smtpHost.includes("gmail") ? "gmail" : undefined,
    logger: true,
    pool: true, // Enable connection pooling
  });

  try {
    await transporter.verify();
    logger.info("SMTP transporter is ready", { host: config.smtpHost, port: config.smtpPort });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("SMTP transporter verification failed", { error: errorMessage });
    logger.warn("Application will continue without SMTP until resolved");
  }

  return transporter;
};

// Initialize or get transporter singleton
const getTransporter = async (): Promise<Transporter> => {
  if (transporterInstance) {
    return transporterInstance;
  }

  transporterInstance = await configureTransporter();
  return transporterInstance;
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 seconds

// Send email with retry and queue fallback
export const sendMail = async (
  to: string | string[],
  options: { subject: string; htmlBody: string; from?: string; metadata?: Metadata },
  retryCount = 0
): Promise<void> => {
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  const config = await getEmailConfig();
  const transporter = await getTransporter();

  try {
    const message = await transporter.sendMail({
      from: options.from ? `"Quicrefill" <${options.from}>` : `"Quicrefill" <${config.emailFrom}>`,
      to: recipients,
      subject: options.subject,
      html: options.htmlBody,
    });

    const eventTypeId = await emailTemplateService.ensureEventType(
      String(options.metadata?.eventType || "OTHERS"),
      String(options.metadata?.userId || "system")
    );

    await prisma.notificationLog.create({
      data: {
        userId: options.metadata?.userId ? String(options.metadata.userId) : undefined,
        type: "EMAIL",
        channel: "EMAIL",
        recipient: recipients,
        eventTypeId,
        status: "SENT",
        payload: JSON.stringify({
          recipient: recipients,
          subject: options.subject,
          from: options.from || config.emailFrom,
          templateId: options.metadata?.templateId ? String(options.metadata.templateId) : undefined,
        }),
        vendorId: null,
      },
    });

    logger.info("Email sent successfully", {
      messageId: message.messageId,
      to: recipients,
      from: options.from || config.emailFrom,
      accepted: message.accepted,
      rejected: message.rejected,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to send email", {
      to: recipients,
      from: options.from || config.emailFrom,
      subject: options.subject,
      error: errorMessage,
      retryCount,
    });

    const eventTypeId = await emailTemplateService.ensureEventType(
      String(options.metadata?.eventType || "OTHERS"),
      String(options.metadata?.userId || "system")
    );

    await prisma.notificationLog.create({
      data: {
        userId: options.metadata?.userId ? String(options.metadata.userId) : undefined,
        type: "EMAIL",
        channel: "EMAIL",
        recipient: recipients,
        eventTypeId,
        status: "FAILED",
        payload: JSON.stringify({
          recipient: recipients,
          subject: options.subject,
          from: options.from || config.emailFrom,
          error: errorMessage,
          templateId: options.metadata?.templateId ? String(options.metadata.templateId) : undefined,
        }),
        vendorId: null,
      },
    });

    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying email send (${retryCount + 1}/${MAX_RETRIES})`, {
        to: recipients,
        subject: options.subject,
      });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return sendMail(to, options, retryCount + 1);
    }

    try {
      const redis = await getRedisClient();
      await redis.lPush("email_queue", JSON.stringify({ 
        to, 
        subject: options.subject, 
        htmlBody: options.htmlBody, 
        from: options.from, 
        metadata: options.metadata 
      }));
      logger.info("Email queued for retry", { to: recipients, subject: options.subject });
    } catch (queueError) {
      const queueErrorMessage = queueError instanceof Error ? queueError.message : "Unknown error";
      logger.error("Failed to queue email", {
        to: recipients,
        subject: options.subject,
        error: queueErrorMessage,
      });
      throw new Error(`Failed to send or queue email: ${errorMessage}`);
    }
  }
};

// Helper to fetch Role objects by names
const getRolesByNames = async (roleNames: string[]): Promise<Role[]> => {
  try {
    const roles = await prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
    if (roles.length !== roleNames.length) {
      const foundRoles = roles.map(r => r.name);
      const missingRoles = roleNames.filter(name => !foundRoles.includes(name));
      logger.warn("Some roles not found", { missingRoles });
    }
    return roles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to fetch roles", { roleNames, error: errorMessage });
    throw new Error(`Failed to fetch roles: ${errorMessage}`);
  }
};

// Default email template
const defaultEmailTemplate: EmailTemplate = {
  id: "default",
  name: "Default Email",
  subject: "Quicrefill Notification",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quicrefill Notification</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Quicrefill Notification</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>{message}</p>
          <p>If you have any questions, please contact our support team at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default OTP email template
const defaultOtpTemplate: EmailTemplate = {
  id: "default-otp",
  name: "Default OTP Email",
  subject: "Your Quicrefill Verification Code",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Verification Code</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: center; }
        .otp-code { font-size: 32px; font-weight: bold; color: #4a90e2; letter-spacing: 2px; margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 4px; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
        @media (max-width: 600px) { .container { margin: 10px; } .content { padding: 20px; } .otp-code { font-size: 28px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Verification Code</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>Use the following code to verify your Quicrefill account:</p>
          <div class="otp-code">{otpCode}</div>
          <p>This code will expire at {expiresAt}. Please do not share it with anyone.</p>
          <p>If you didn’t request this code, please contact our support team at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Password Reset OTP email template
const defaultPasswordResetTemplate: EmailTemplate = {
  id: "default-password-reset",
  name: "Default Password Reset OTP Email",
  subject: "Reset Your Quicrefill Password",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .otp-code { font-size: 24px; font-weight: bold; color: #4a90e2; letter-spacing: 2px; margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 4px; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>You’ve requested to reset your Quicrefill account password. Use the following one-time code to proceed:</p>
          <div class="otp-code">{otpCode}</div>
          <p>This code will expire at {expiresAt}. Please enter it in the password reset form to set a new password.</p>
          <p>If you didn’t request this, please contact our support team immediately at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Password Reset Confirmation email template
const defaultPasswordResetConfirmationTemplate: EmailTemplate = {
  id: "default-password-reset-confirmation",
  name: "Default Password Reset Confirmation Email",
  subject: "Your Quicrefill Password Has Been Reset",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Successful</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Successful</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>Your Quicrefill account password has been successfully reset.</p>
          <p>You can now log in to your account at <a href="https://quicrefill.com">quicrefill.com</a> using your new password.</p>
          <p>If you did not initiate this password reset, please contact our support team immediately at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Account Verification email template
const defaultAccountVerificationTemplate: EmailTemplate = {
  id: "default-account-verification",
  name: "Default Account Verification Email",
  subject: "Verify Your Quicrefill Account",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Account</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .otp-code { font-size: 24px; font-weight: bold; color: #4a90e2; letter-spacing: 2px; margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 4px; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Account</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>Thank you for joining Quicrefill! To activate your account, please use the following verification code:</p>
          <div class="otp-code">{otpCode}</div>
          <p>This code will expire at {expiresAt}. Enter it in the verification form to complete your account setup.</p>
          <p>If you didn’t sign up for a Quicrefill account, please contact our support team at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Registration Success email template
const defaultRegistrationSuccessTemplate: EmailTemplate = {
  id: "default-registration-success",
  name: "Default Registration Success Email",
  subject: "Welcome to Quicrefill!",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Quicrefill</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Quicrefill</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>Welcome to Quicrefill! Your account has been successfully created, and you’re ready to start exploring our services.</p>
          <p>Log in to your account at <a href="https://quicrefill.com">quicrefill.com</a> to get started.</p>
          <p>If you have any questions, feel free to reach out to our support team at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Happy refilling!<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Account Deletion Request email template
const defaultAccountDeletionRequestTemplate: EmailTemplate = {
  id: "default-account-deletion-request",
  name: "Default Account Deletion Request OTP Email",
  subject: "Verify Your Quicrefill Account Deletion Request",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Account Deletion</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #d9534f; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: center; }
        .otp-code { font-size: 32px; font-weight: bold; color: #d9534f; letter-spacing: 2px; margin: 20px 0; background: #f9ecec; padding: 15px; border-radius: 4px; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #d9534f; text-decoration: none; }
        @media (max-width: 600px) { .container { margin: 10px; } .content { padding: 20px; } .otp-code { font-size: 28px; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Account Deletion</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>You have requested to delete your Quicrefill account. Use the following code to verify this request:</p>
          <div class="otp-code">{otpCode}</div>
          <p>This code will expire at {expiresAt}. Please enter it in the Quicrefill app or website to confirm your account deletion.</p>
          <p>If you did not initiate this request, please contact our support team at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a> immediately.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Registration Failure email template
const defaultRegistrationFailureTemplate: EmailTemplate = {
  id: "default-registration-failed",
  name: "Default Registration Failed Email",
  subject: "Issue with Your Quicrefill Registration",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Issue</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #d9534f; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .content p { font-size: 16px; line-height: 1.6; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Issue</h1>
        </div>
        <div class="content">
          <p>Dear User,</p>
          <p>We’re sorry, but we encountered an issue while creating your Quicrefill account.</p>
          <p>Please try registering again, or contact our support team at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a> for assistance.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Default Login Success email template
const defaultLoginSuccessTemplate: EmailTemplate = {
  id: "default-login-success",
  name: "Default Login Success Email",
  subject: "Successful Login to Quicrefill",
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Successful Login</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: #4a90e2; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
        .content { padding: 30px; text-align: left; }
        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }
        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        .footer a { color: #4a90e2; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Successful Login</h1>
        </div>
        <div class="content">
          <p>Dear {name},</p>
          <p>You have successfully logged in to your Quicrefill account on {platform} at {loginTime}.</p>
          <p>If you did not initiate this login, please contact our support team immediately at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
          <p>Best regards,<br>Quicrefill Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Quicrefill. All rights reserved.</p>
          <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `,
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Initialize default templates with proper Role objects
const initializeDefaultTemplates = async () => {
  const roleNames = [
    "CUSTOMER",
    "VENDOR",
    "DELIVERY_AGENT",
    "ADMIN",
    "MANAGER",
    "SUPERVISOR",
    "FINANCE_MANAGER",
    "STAFF",
    "SERVICE_REP",
  ];
  const roles = await getRolesByNames(roleNames);

  const allRoles = roles.filter(r => roleNames.includes(r.name));
  const deletionRoles = roles.filter(r => ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "ADMIN", "MANAGER"].includes(r.name));
  const loginRoles = roles.filter(r => ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "MANAGER", "SUPERVISOR", "FINANCE_MANAGER", "STAFF", "SERVICE_REP"].includes(r.name));

  defaultOtpTemplate.roles = allRoles;
  defaultPasswordResetTemplate.roles = allRoles;
  defaultPasswordResetConfirmationTemplate.roles = allRoles;
  defaultAccountVerificationTemplate.roles = allRoles;
  defaultRegistrationSuccessTemplate.roles = allRoles;
  defaultAccountDeletionRequestTemplate.roles = deletionRoles;
  defaultLoginSuccessTemplate.roles = loginRoles;
  defaultRegistrationFailureTemplate.roles = [];
  defaultEmailTemplate.roles = [];
};

export class EmailTemplateService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly ALL_TEMPLATES_CACHE_KEY = "email_templates";
  private readonly TEMPLATE_CACHE_KEY = (id: string) => `email_template:${id}`;
  private readonly RATE_LIMIT_KEY = (identifier: string) => `email_rate_limit:${identifier}`;
  private readonly AUDIT_QUEUE_KEY = "audit:queue";

  constructor() {
    initializeDefaultTemplates().catch(error => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to initialize default templates", { error: errorMessage });
    });
  }

  async ensureEventType(name: string, createdBy: string): Promise<string> {
    try {
      const mappedEventType = mapToEventType(name);
      let eventType = await prisma.eventType.findUnique({ where: { name: mappedEventType } });
      if (!eventType) {
        eventType = await prisma.eventType.create({
          data: {
            name: mappedEventType,
            createdBy,
            description: `Event type for ${mappedEventType}`,
          },
        });
        logger.info("EventType created", { name: mappedEventType, createdBy });
      }
      return eventType.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to ensure EventType", { name, error: errorMessage });
      throw new Error(`Failed to ensure EventType: ${errorMessage}`);
    }
  }

  async createTemplate(data: EmailTemplateRequest, updatedBy: string): Promise<EmailTemplate> {
    try {
      const roles = data.roles ? await getRolesByNames(data.roles) : [];
      const template = await prisma.emailTemplate.create({
        data: {
          name: data.name,
          subject: data.subject,
          htmlContent: data.htmlContent,
          roles: {
            connect: roles.map(role => ({ id: role.id })),
          },
          eventTypeId: data.eventTypeId || null,
          updatedBy,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        include: { roles: true },
      });
      const redis = await getRedisClient();
      const auditDetails: Metadata = {
        templateData: JSON.stringify({
          name: data.name,
          subject: data.subject,
          htmlContent: data.htmlContent,
          roles: data.roles || [],
          eventTypeId: data.eventTypeId || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        }),
      };
      await Promise.all([
        redis.del(this.ALL_TEMPLATES_CACHE_KEY),
        this.queueAuditLog(updatedBy, "CREATE_EMAIL_TEMPLATE", "EMAIL_TEMPLATE", template.id, auditDetails),
      ]);
      logger.info("Email template created", { name: data.name, updatedBy });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to create email template", { name: data.name, error: errorMessage });
      throw new Error(`Failed to create template: ${errorMessage}`);
    }
  }

  async updateTemplate(id: string, data: Partial<EmailTemplateRequest>, updatedBy: string): Promise<EmailTemplate> {
    try {
      const roles = data.roles ? await getRolesByNames(data.roles) : undefined;
      const template = await prisma.emailTemplate.update({
        where: { id },
        data: {
          name: data.name,
          subject: data.subject,
          htmlContent: data.htmlContent,
          roles: roles ? { set: roles.map(role => ({ id: role.id })) } : undefined,
          eventTypeId: data.eventTypeId !== undefined ? data.eventTypeId : undefined,
          updatedBy,
          isActive: data.isActive,
          updatedAt: new Date(),
        },
        include: { roles: true },
      });
      const redis = await getRedisClient();
      const auditDetails: Metadata = {
        changesData: JSON.stringify({
          name: data.name ?? null,
          subject: data.subject ?? null,
          htmlContent: data.htmlContent ?? null,
          roles: data.roles ?? null,
          eventTypeId: data.eventTypeId ?? null,
          isActive: data.isActive ?? null,
        }),
      };
      await Promise.all([
        redis.del(this.ALL_TEMPLATES_CACHE_KEY),
        redis.del(this.TEMPLATE_CACHE_KEY(id)),
        this.queueAuditLog(updatedBy, "UPDATE_EMAIL_TEMPLATE", "EMAIL_TEMPLATE", id, auditDetails),
      ]);
      logger.info("Email template updated", { id, updatedBy });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to update email template", { id, error: errorMessage });
      throw new Error(`Failed to update template: ${errorMessage}`);
    }
  }

  async deleteTemplate(id: string, deletedBy: string): Promise<void> {
    try {
      await prisma.emailTemplate.delete({ where: { id } });
      const redis = await getRedisClient();
      await Promise.all([
        redis.del(this.ALL_TEMPLATES_CACHE_KEY),
        redis.del(this.TEMPLATE_CACHE_KEY(id)),
        this.queueAuditLog(deletedBy, "DELETE_EMAIL_TEMPLATE", "EMAIL_TEMPLATE", id, { deleted: true }),
      ]);
      logger.info("Email template deleted", { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to delete email template", { id, error: errorMessage });
      throw new Error(`Failed to delete template: ${errorMessage}`);
    }
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    try {
      const redis = await getRedisClient();
      const cachedTemplates = await redis.get(this.ALL_TEMPLATES_CACHE_KEY);
      if (cachedTemplates) {
        logger.info("Email templates retrieved from cache", { cacheKey: this.ALL_TEMPLATES_CACHE_KEY });
        return JSON.parse(cachedTemplates) as EmailTemplate[];
      }
      const templates = await prisma.emailTemplate.findMany({
        include: { roles: true },
      });
      await redis.setEx(this.ALL_TEMPLATES_CACHE_KEY, this.CACHE_TTL, JSON.stringify(templates));
      logger.info("Email templates retrieved", { count: templates.length });
      return templates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve email templates", { error: errorMessage });
      throw new Error(`Failed to retrieve templates: ${errorMessage}`);
    }
  }

  async getById(id: string): Promise<EmailTemplate | null> {
    try {
      const redis = await getRedisClient();
      const cacheKey = this.TEMPLATE_CACHE_KEY(id);
      const cachedTemplate = await redis.get(cacheKey);
      if (cachedTemplate) {
        logger.info("Email template retrieved from cache", { id, cacheKey });
        return JSON.parse(cachedTemplate) as EmailTemplate;
      }
      const template = await prisma.emailTemplate.findUnique({
        where: { id },
        include: { roles: true },
      });
      if (template) {
        await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(template));
      }
      logger.info("Email template retrieved", { id, found: !!template });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve email template", { id, error: errorMessage });
      throw new Error(`Failed to retrieve template: ${errorMessage}`);
    }
  }

  async sendOtpEmail({
    email,
    otpCode,
    eventType = "otp verification",
    metadata = {},
  }: {
    email: string;
    otpCode: string;
    eventType?: string;
    metadata?: Metadata;
  }): Promise<EmailPayload> {
    try {
      const redis = await getRedisClient();
      const rateLimitKey = this.RATE_LIMIT_KEY(email);
      const emailCount = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 60);
      if (emailCount > 5) {
        throw new Error("Email sending rate limit exceeded for this email address");
      }

      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error("Invalid email format");
      }

      const mappedEventType = mapToEventType(eventType);
      const validEventTypes = [
        KnownEventTypes.OTP_VERIFICATION,
        KnownEventTypes.PASSWORD_RESET,
        KnownEventTypes.ACCOUNT_VERIFICATION,
        KnownEventTypes.ACCOUNT_DELETION_REQUEST,
        KnownEventTypes.MIGRATION_VERIFICATION,
      ];
      if (!validEventTypes.includes(mappedEventType as KnownEventTypes)) {
        throw new Error(`Invalid event type for OTP email: ${mappedEventType}`);
      }
      if (metadata.role) {
        const applicableRoles: string[] = RoleEventApplicability[mappedEventType as KnownEventTypes] || [];
        const userRole = String(metadata.role);
        if (!applicableRoles.includes(userRole)) {
          throw new Error(`Role ${userRole} is not applicable for ${mappedEventType}`);
        }
      }

      const eventTypeId = await this.ensureEventType(mappedEventType, metadata.userId as string || "system");
      const template = await prisma.emailTemplate.findFirst({
        where: { eventTypeId, isActive: true },
        include: { roles: true },
      });

      let subject: string;
      let htmlContent: string;
      if (template) {
        subject = this.renderTemplate(template.subject, { otpCode, expiresAt: metadata.expiresAt, ...metadata });
        htmlContent = this.renderTemplate(template.htmlContent, { otpCode, expiresAt: metadata.expiresAt, ...metadata });
      } else {
        switch (mappedEventType) {
          case KnownEventTypes.PASSWORD_RESET:
            subject = defaultPasswordResetTemplate.subject;
            htmlContent = this.renderTemplate(defaultPasswordResetTemplate.htmlContent, {
              otpCode,
              expiresAt: metadata.expiresAt || new Date().toLocaleString(),
              ...metadata,
            });
            break;
          case KnownEventTypes.ACCOUNT_VERIFICATION:
            subject = defaultAccountVerificationTemplate.subject;
            htmlContent = this.renderTemplate(defaultAccountVerificationTemplate.htmlContent, {
              otpCode,
              expiresAt: metadata.expiresAt || new Date().toLocaleString(),
              ...metadata,
            });
            break;
          case KnownEventTypes.ACCOUNT_DELETION_REQUEST:
            subject = defaultAccountDeletionRequestTemplate.subject;
            htmlContent = this.renderTemplate(defaultAccountDeletionRequestTemplate.htmlContent, {
              otpCode,
              expiresAt: metadata.expiresAt || new Date().toLocaleString(),
              ...metadata,
            });
            break;
          case KnownEventTypes.MIGRATION_VERIFICATION:
            subject = "Verify Your Quicrefill Account Migration";
            htmlContent = this.renderTemplate(defaultOtpTemplate.htmlContent, {
              otpCode,
              expiresAt: metadata.expiresAt || new Date().toLocaleString(),
              ...metadata,
            });
            break;
          default:
            subject = defaultOtpTemplate.subject;
            htmlContent = this.renderTemplate(defaultOtpTemplate.htmlContent, {
              otpCode,
              expiresAt: metadata.expiresAt || new Date().toLocaleString(),
              ...metadata,
            });
        }
      }

      const payload: EmailPayload = {
        to: email,
        subject,
        htmlContent,
      };

      const validRecipients = await this.filterValidEmailRecipients([email]);
      if (!validRecipients.length) {
        logger.info("No valid recipients after preference check", { email });
        return payload;
      }

      await sendMail(validRecipients, {
        subject,
        htmlBody: htmlContent,
        metadata: {
          userId: metadata.userId as string | undefined,
          eventType: mappedEventType,
          templateId: template?.id,
          eventTypeId,
        },
      });

      await prisma.notificationLog.create({
        data: {
          userId: metadata.userId as string | undefined,
          type: "EMAIL",
          channel: "EMAIL",
          recipient: email,
          eventTypeId,
          status: "SENT",
          payload: JSON.stringify({
            templateId: template?.id || null,
            content: htmlContent,
            metadata,
          }),
          vendorId: null,
        },
      });

      logger.info("OTP email sent", { email, eventType: mappedEventType });
      return payload;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const mappedEventType = mapToEventType(eventType);
      const eventTypeId = await this.ensureEventType(mappedEventType, metadata.userId as string || "system");
      await prisma.notificationLog.create({
        data: {
          userId: metadata.userId as string | undefined,
          type: "EMAIL",
          channel: "EMAIL",
          recipient: email,
          eventTypeId,
          status: "FAILED",
          payload: JSON.stringify({
            templateId: null,
            error: errorMessage,
            metadata,
          }),
          vendorId: null,
        },
      });
      logger.error("Failed to send OTP email", { email, error: errorMessage });
      throw new Error(`Failed to send OTP email: ${errorMessage}`);
    }
  }

  async sendEmail({
    templateId,
    eventType,
    roles,
    customPayload,
    userIds,
    metadata = {},
  }: BulkEmailRequest): Promise<EmailPayload> {
    let recipients: string[] = [];
    try {
      const redis = await getRedisClient();
      const rateLimitIdentifier = templateId || customPayload?.to.toString() || userIds?.join(",") || "default";
      const rateLimitKey = this.RATE_LIMIT_KEY(rateLimitIdentifier);
      const emailCount = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 60);
      if (emailCount > 10) {
        throw new Error("Email sending rate limit exceeded");
      }

      if (userIds && userIds.length > 0) {
        recipients = await this.getEmailsByUserIds(userIds);
      } else if (roles && roles.length > 0) {
        recipients = await this.getEmailsByRoles(roles);
      } else if (customPayload) {
        recipients = Array.isArray(customPayload.to) ? customPayload.to : [customPayload.to];
      }
      if (!recipients.length) {
        throw new Error("No recipients found");
      }

      const validRecipients = recipients.filter(email => email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
      if (!validRecipients.length) {
        throw new Error("No valid email addresses found");
      }

      const mappedEventType = eventType ? mapToEventType(eventType) : KnownEventTypes.OTHERS;
      const applicableRoles: string[] = RoleEventApplicability[mappedEventType as KnownEventTypes] || [];
      const filteredRecipients = await this.filterValidEmailRecipients(validRecipients, applicableRoles);
      if (!filteredRecipients.length) {
        logger.info("No valid recipients after preference and role applicability check", {
          recipients: validRecipients,
          eventType: mappedEventType,
        });
        return {
          to: validRecipients,
          subject: customPayload?.subject || defaultEmailTemplate.subject,
          htmlContent: customPayload?.htmlContent || defaultEmailTemplate.htmlContent,
        };
      }

      let subject: string;
      let htmlContent: string;
      let eventTypeId: string;

      if (customPayload && customPayload.subject && customPayload.htmlContent) {
        subject = this.renderTemplate(customPayload.subject, metadata);
        htmlContent = this.renderTemplate(customPayload.htmlContent, metadata);
        eventTypeId = await this.ensureEventType(mappedEventType, metadata.userId as string | undefined || "system");
      } else if (templateId) {
        const template = await prisma.emailTemplate.findUnique({
          where: { id: templateId },
          include: { roles: true },
        });
        if (!template || !template.isActive) {
          throw new Error("Invalid or inactive template");
        }
        subject = this.renderTemplate(template.subject, metadata);
        htmlContent = this.renderTemplate(template.htmlContent, metadata);
        eventTypeId = await this.ensureEventType(KnownEventTypes.OTHERS, metadata.userId as string | undefined || "system");
      } else if (eventType) {
        eventTypeId = await this.ensureEventType(mappedEventType, metadata.userId as string | undefined || "system");
        const template = await prisma.emailTemplate.findFirst({
          where: { eventTypeId, isActive: true },
          include: { roles: true },
        });
        if (template) {
          subject = this.renderTemplate(template.subject, metadata);
          htmlContent = this.renderTemplate(template.htmlContent, metadata);
        } else {
          switch (mappedEventType) {
            case KnownEventTypes.PASSWORD_RESET:
              subject = defaultPasswordResetConfirmationTemplate.subject;
              htmlContent = this.renderTemplate(defaultPasswordResetConfirmationTemplate.htmlContent, metadata);
              break;
            case KnownEventTypes.ACCOUNT_VERIFICATION:
              subject = defaultAccountVerificationTemplate.subject;
              htmlContent = this.renderTemplate(defaultAccountVerificationTemplate.htmlContent, metadata);
              break;
            case KnownEventTypes.REGISTRATION_SUCCESS:
              subject = defaultRegistrationSuccessTemplate.subject;
              htmlContent = this.renderTemplate(defaultRegistrationSuccessTemplate.htmlContent, metadata);
              break;
            case KnownEventTypes.REGISTRATION_FAILED:
              subject = defaultRegistrationFailureTemplate.subject;
              htmlContent = this.renderTemplate(defaultRegistrationFailureTemplate.htmlContent, metadata);
              break;
            case KnownEventTypes.LOGIN_SUCCESS:
              subject = defaultLoginSuccessTemplate.subject;
              htmlContent = this.renderTemplate(defaultLoginSuccessTemplate.htmlContent, metadata);
              break;
            default:
              subject = defaultEmailTemplate.subject;
              htmlContent = this.renderTemplate(defaultEmailTemplate.htmlContent, {
                message: metadata.message || "You have a new notification.",
                ...metadata,
              });
          }
        }
      } else {
        throw new Error("Either templateId, eventType, or customPayload with subject and htmlContent is required");
      }

      const emailPayload: EmailPayload = {
        to: filteredRecipients,
        subject,
        htmlContent,
      };

      await sendMail(filteredRecipients, {
        subject,
        htmlBody: htmlContent,
        from: customPayload?.from,
        metadata: {
          userId: userIds?.[0] || metadata.userId as string | undefined,
          eventType: mappedEventType,
          templateId,
          eventTypeId,
        },
      });

      await prisma.notificationLog.create({
        data: {
          userId: userIds?.[0] || metadata.userId as string | undefined,
          type: "EMAIL",
          channel: "EMAIL",
          recipient: filteredRecipients.join(","),
          eventTypeId,
          status: "SENT",
          payload: JSON.stringify({
            templateId: templateId || null,
            content: htmlContent,
            from: customPayload?.from || (await getEmailConfig()).emailFrom,
            metadata,
          }),
          vendorId: null,
        },
      });

      logger.info("Email sent", { recipients: filteredRecipients, subject, eventType: mappedEventType, from: customPayload?.from });
      return emailPayload;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const eventTypeId = await this.ensureEventType(KnownEventTypes.OTHERS, metadata.userId as string | undefined || "system");
      await prisma.notificationLog.create({
        data: {
          userId: userIds?.[0] || metadata.userId as string | undefined,
          type: "EMAIL",
          channel: "EMAIL",
          recipient: recipients.join(",") || null,
          eventTypeId,
          status: "FAILED",
          payload: JSON.stringify({
            templateId: templateId || null,
            error: errorMessage,
            from: customPayload?.from || (await getEmailConfig()).emailFrom,
            metadata,
          }),
          vendorId: null,
        },
      });
      logger.error("Failed to send email", { error: errorMessage, recipients, eventType, from: customPayload?.from });
      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  }

  private async getEmailsByRoles(roles: string[]): Promise<string[]> {
    try {
      const users = await prisma.user.findMany({
        where: { role: { name: { in: roles } } },
        select: { email: true },
      });
      const emails = users.map(u => u.email).filter((email): email is string => Boolean(email));
      logger.info("Emails retrieved by roles", { roles, count: emails.length });
      return emails;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve emails by roles", { roles, error: errorMessage });
      throw new Error(`Failed to retrieve emails: ${errorMessage}`);
    }
  }

  private async getEmailsByUserIds(userIds: string[]): Promise<string[]> {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { email: true },
      });
      const emails = users.map(u => u.email).filter((email): email is string => Boolean(email));
      logger.info("Emails retrieved by user IDs", { userIds, count: emails.length });
      return emails;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve emails by user IDs", { userIds, error: errorMessage });
      throw new Error(`Failed to retrieve emails: ${errorMessage}`);
    }
  }

  private async filterValidEmailRecipients(emails: string[], applicableRoles: string[] = []): Promise<string[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          email: { in: emails },
          notificationsEnabled: true,
          OR: [
            { notificationPreference: null },
            { notificationPreference: { in: ["EMAIL", "ALL"] } },
          ],
          ...(applicableRoles.length > 0 && { role: { name: { in: applicableRoles } } }),
        },
        select: { email: true },
      });
      return users.map(u => u.email).filter((email): email is string => Boolean(email));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to filter email recipients", { error: errorMessage });
      throw new Error(`Failed to filter recipients: ${errorMessage}`);
    }
  }

  private renderTemplate(template: string, data: Metadata): string {
    return template.replace(/{(\w+)}/g, (_, key) => String(data[key] ?? ""));
  }

  private async queueAuditLog(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: Metadata
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const auditLog = {
        userId,
        action,
        entityType,
        entityId,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
      };
      await redis.lPush(this.AUDIT_QUEUE_KEY, JSON.stringify(auditLog));
      logger.info("Audit log queued", { action, entityType, entityId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to queue audit log", { action, entityType, entityId, error: errorMessage });
    }
  }
}

export const emailTemplateService = new EmailTemplateService();

const processEmailQueue = async () => {
  while (true) {
    try {
      const redis = await getRedisClient();
      const emailJob = await redis.rPop("email_queue");
      if (emailJob) {
        const { to, subject, htmlBody, from, metadata } = JSON.parse(emailJob);
        await sendMail(to, { subject, htmlBody, from, metadata });
        logger.info("Processed queued email", { to, subject, from });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to process queued email", { error: errorMessage });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

export const startEmailQueue = () => {
  processEmailQueue().catch(error => {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Email queue processing failed", { error: errorMessage });
  });
};