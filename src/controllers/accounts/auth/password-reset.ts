import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppErrorCode } from "../../../exceptions/root";
import { UnprocessableEntity } from "../../../exceptions/validation";
import { prismaClient } from "../../../config/db";
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests";
import bcrypt from "bcryptjs";
import { emailTemplateService } from "../../../services/email";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";
import { mapToEventType, KnownEventTypes } from "../../../utils/EventTypeDictionary";

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/auth.log" }),
    new winston.transports.Console(),
  ],
});

// Validation schema
const PasswordResetSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  otp: z.string({ message: "OTP is required" }),
  newPassword: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  transactionReference: z.string({ message: "Transaction reference is required" }),
});

// Platform validation schema
const PlatformSchema = z.enum(["app", "web"]).default("app");

/**
 * Resets the user's password using an OTP, sends a confirmation email, and logs the action.
 */
export const PasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let platform: string = "app"; // Initialize platform with default value
  try {
    // Validate platform query parameter
    const platformRaw = req.query.platform;
    platform = PlatformSchema.parse(
      Array.isArray(platformRaw) ? platformRaw[0] : platformRaw
    );
    console.log("Platform validated:", platform);

    // Validate request body
    const validatedData = await PasswordResetSchema.parseAsync(req.body).catch(
      (err: z.ZodError) => {
        logger.error("Validation error in password reset", {
          errors: err.issues,
          email: req.body.email,
          ip: req.ip,
          platform,
        });
        throw new UnprocessableEntity(
          "Unprocessable Entity",
          AppErrorCode.UNPROCESSABLE_ENTITY,
          err.issues
        );
      }
    );
    const { email, otp, newPassword, transactionReference } = validatedData;

    // Find user with role relation included
    const user = await prismaClient.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { 
        profile: true,
        role: true // Explicitly include the role relation
      },
    });

    if (!user) {
      logger.warn("Password reset attempted for non-existent user", {
        email,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest(
        "User does not exist",
        AppErrorCode.USER_DOES_NOT_EXIST
      );
    }

    // Log OTP validation attempt for debugging
    logger.info("Attempting OTP validation", {
      userId: user.id,
      email,
      otp,
      transactionReference,
      eventType: KnownEventTypes.PASSWORD_RESET,
      currentTime: new Date().toISOString(),
    });

    // Validate OTP
    const otpRecord = await prismaClient.otp.findFirst({
      where: {
        code: otp,
        userId: user.id,
        transactionReference,
        expiresAt: { gt: new Date() },
        eventType: KnownEventTypes.PASSWORD_RESET,
      },
    });

    if (!otpRecord) {
      // Log details of OTP records for debugging
      const recentOtps = await prismaClient.otp.findMany({
        where: {
          userId: user.id,
          eventType: KnownEventTypes.PASSWORD_RESET,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      logger.warn("Invalid or expired OTP for password reset", {
        userId: user.id,
        email,
        otp,
        transactionReference,
        ip: req.ip,
        platform,
        eventType: KnownEventTypes.PASSWORD_RESET,
        recentOtps: recentOtps.map((r) => ({
          id: r.id,
          code: r.code,
          transactionReference: r.transactionReference,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
        })),
      });
      throw new UnauthorizedRequest(
        "Invalid or expired reset token",
        AppErrorCode.INVALID_TOKEN
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and invalidate OTP
    await prismaClient.$transaction(async (tx) => {
      // Update user password
      await tx.user.update({
        where: { id: user.id },
        data: { password: newPasswordHash },
      });

      // Invalidate OTP
      await tx.otp.delete({
        where: { id: otpRecord.id },
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET",
          entityType: "USER",
          entityId: user.id,
          details: {
            platform,
            contextRole: user.role?.name || "UNKNOWN", // Use optional chaining and fallback
            email,
            ip: req.ip,
          },
        },
      });
    });

    logger.info("Password reset successful", {
      userId: user.id,
      email,
      platform,
      contextRole: user.role?.name || "UNKNOWN", // Use optional chaining and fallback
      eventType: KnownEventTypes.PASSWORD_RESET,
    });

    // Send confirmation email
    let emailSent = true;
    try {
      const eventType = "password reset";
      const mappedEventType = mapToEventType(eventType);
      if (mappedEventType !== KnownEventTypes.PASSWORD_RESET) {
        logger.error("Unexpected event type mapping", {
          input: eventType,
          mapped: mappedEventType,
          expected: KnownEventTypes.PASSWORD_RESET,
        });
        throw new Error(
          `Invalid event type mapping: expected ${KnownEventTypes.PASSWORD_RESET}, got ${mappedEventType}`
        );
      }

      const emailContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Successful</title>
          <style>
            body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }
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
              <p>Dear ${user.name || "User"},</p>
              <p>Your Quicrefill account password has been successfully reset.</p>
              <p>You can now use your new password to log in to your account at <a href="https://quicrefill.com">quicrefill.com</a>.</p>
              <p>If you did not initiate this password reset, please contact our support team immediately at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a>.</p>
              <p>Best regards,<br>Quicrefill Team</p>
            </div>
            <div class="footer">
              <p>© 2025 Quicrefill. All rights reserved.</p>
              <p><a href="https://quicrefill.com">Visit our website</a> | <a href="mailto:support@quicrefill.com">Support</a></p>
            </div>
          </div>
        </body>
        </html>`;

      await emailTemplateService.sendEmail({
        eventType,
        userIds: [user.id],
        customPayload: {
          to: user.email,
          subject: "Your Quicrefill Password Has Been Reset",
          htmlContent: emailContent,
        },
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
          platform,
          contextRole: user.role?.name || "UNKNOWN", // Use optional chaining and fallback
        },
      });
      logger.info("Password reset confirmation email sent", {
        userId: user.id,
        email,
        platform,
        eventType: mappedEventType,
      });
    } catch (emailError: unknown) {
      emailSent = false;
      const errorMessage: string = emailError instanceof Error ? emailError.message : "Unknown error";
      logger.error("Failed to send password reset confirmation email", {
        userId: user.id,
        email,
        error: errorMessage,
        platform,
        eventType: KnownEventTypes.PASSWORD_RESET,
      });
    }

    // Send success response
    HttpResponse.success(
      res,
      null,
      emailSent
        ? "Password reset successful"
        : "Password reset successful, but email delivery failed. Please check logs or contact support."
    );
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
    logger.error("Password reset error", {
      email: req.body.email || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};