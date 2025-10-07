import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prismaClient } from "../../../"; // Adjust path as needed
import { EmailOtpService, OtpRequest } from "../../../lib/utils/mail/otp"; // Adjust path
import { OtpService } from "../../../services/otp.service"; // Adjust path
import { emailTemplateService } from "../../../services/email"; // Adjust path
import { smsTemplateService } from "../../../services/SMSTemplateService"; // Adjust path
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests"; // Adjust path
import { HttpResponse } from "../../../utils/http.util"; // Adjust path
import { AppErrorCode } from "../../../exceptions/root"; // Adjust path
import winston from "winston";
import { KnownEventTypes } from "../../../utils/EventTypeDictionary"; // Adjust path

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

// Define allowed roles for app usage
const ALLOWED_APP_ROLES = ["CUSTOMER", "VENDOR", "DELIVERY_AGENT"];

// Initialize EmailOtpService
const emailOtpService = new EmailOtpService();

// Updated determineContextRole to enforce role restrictions
const determineContextRole = async (userId: string, platform: string): Promise<string> => {
  try {
    // Fetch the user's role from the Role table
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      include: { role: true }, // Include the Role relation
    });

    if (!user || !user.role) {
      logger.warn("User or role not found", { userId, platform });
      throw new UnauthorizedRequest("User or role not found", AppErrorCode.USER_DOES_NOT_EXIST);
    }

    const userRoleName = user.role.name;

    // Check if the platform is 'app' and the role is allowed
    if (platform === "app" && !ALLOWED_APP_ROLES.includes(userRoleName)) {
      logger.warn("Role not allowed on app platform", { userId, role: userRoleName, platform });
      throw new UnauthorizedRequest(
        `Role ${userRoleName} is not permitted to use the app. Please use the web platform.`,
        AppErrorCode.INVALID_ROLE_FOR_PLATFORM
      );
    }

    // If the user is a VENDOR and on the app, map to USER role if applicable
    if (userRoleName === "VENDOR" && platform === "app") {
      const userRole = await prismaClient.role.findFirst({ where: { name: "USER" } });
      if (!userRole) {
        logger.warn("USER role not found for app platform", { userId, platform });
        return userRoleName; // Fallback to the user's actual role
      }
      return userRole.name;
    }

    // For web or other cases, return the user's actual role name
    return userRoleName;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in determineContextRole", { userId, platform, error: errorMessage });
    throw error;
  }
};

export const AccountVerify = async (req: Request, res: Response, next: NextFunction) => {
  let platform: string = "app"; // Default to app
  try {
    logger.info("Starting account verification", { body: req.body, query: req.query });

    // Determine platform from query
    const platformRaw = req.query.platform;
    if (typeof platformRaw === "string") {
      platform = platformRaw.toLowerCase();
      if (!["app", "web"].includes(platform)) {
        logger.warn("Invalid platform specified", { platformRaw, ip: req.ip });
        throw new UnauthorizedRequest("Invalid platform specified", AppErrorCode.INVALID_PLATFORM);
      }
    } else if (platformRaw) {
      logger.warn("Invalid platform query", { platformRaw, ip: req.ip });
      throw new UnauthorizedRequest("Invalid platform query", AppErrorCode.INVALID_PLATFORM);
    }

    // Validation schema
    const schema = z.object({
      medium: z.enum(["EMAIL", "SMS"]),
      email: z.string().email().optional(),
      phoneNumber: z.string().regex(/^(\+?\d{10,15})$/).optional(),
      otp: z.string().or(z.number()),
      transactionReference: z.string(),
      resend: z.boolean().optional().default(false),
    }).refine(
      (data) => (data.medium === "EMAIL" && data.email) || (data.medium === "SMS" && data.phoneNumber),
      { message: "Email required for EMAIL medium, phoneNumber required for SMS medium" }
    );

    const { medium, email, phoneNumber, otp, transactionReference, resend } = await schema.parseAsync(req.body);
    logger.info("Input validated", { medium, email, phoneNumber, transactionReference, resend });

    // Normalize phone number
    const normalizedPhoneNumber = phoneNumber?.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

    // Fetch user
    const user = await prismaClient.user.findUnique({
      where: medium === "EMAIL" ? { email: email! } : { phoneNumber: normalizedPhoneNumber! },
      include: { role: true },
    });

    if (!user) {
      logger.warn("User not found", { medium, email, phoneNumber, ip: req.ip, platform });
      throw new UnauthorizedRequest("User does not exist", AppErrorCode.USER_DOES_NOT_EXIST);
    }

    // Check if user is already verified
    const isVerifiedField = medium === "EMAIL" ? user.emailVerified : user.phoneVerified;
    if (isVerifiedField) {
      logger.warn("User already verified", { medium, email, phoneNumber, ip: req.ip, platform });
      throw new UnauthorizedRequest("User already verified", AppErrorCode.USER_ALREADY_VERIFIED);
    }

    logger.info("User found", { userId: user.id, email: user.email, phoneNumber: user.phoneNumber });

    // Determine context role and enforce platform restrictions
    const contextRole = await determineContextRole(user.id, platform);

    // Handle OTP resend request
    if (resend) {
      const newTransactionReference = `${transactionReference}_${Date.now()}`;
      const otpRequest: OtpRequest = {
        userId: user.id,
        email: email!,
        medium: [medium],
        transactionReference: newTransactionReference,
        eventType: KnownEventTypes.OTP_VERIFICATION,
        metadata: { platform, role: user.role?.name, contextRole },
      };

      const otpRecord = await emailOtpService.generateAndSendOtp(otpRequest);
      logger.info("New OTP sent", { userId: user.id, email, newTransactionReference });

      return HttpResponse.success(
        res,
        {
          user,
          newTransactionReference: otpRecord.transactionReference,
          message: "New OTP sent. Please use the new transaction reference.",
        },
        `${medium} OTP resent successfully`
      );
    }

    // Verify OTP
    let verification;
    try {
      verification = medium === "EMAIL"
        ? await emailOtpService.verifyOtp(transactionReference, otp.toString())
        : await OtpService.validateOtp({ transactionReference, otp: otp.toString() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("OTP verification failed", {
        medium,
        email,
        phoneNumber,
        transactionReference,
        otp,
        error: errorMessage,
      });

      // Handle specific OTP errors
      if (errorMessage.includes("OTP not found") || errorMessage.includes("OTP expired")) {
        return HttpResponse.error(res, "OTP not found or expired. Please request a new OTP.", 400, {
          errorCode: AppErrorCode.INVALID_OTP,
          resend: true,
        });
      }
      if (errorMessage.includes("Maximum attempts exceeded")) {
        return HttpResponse.error(res, "Maximum OTP attempts exceeded. Please request a new OTP.", 400, {
          errorCode: AppErrorCode.INVALID_OTP,
          resend: true,
        });
      }
      throw new UnauthorizedRequest("Invalid OTP", AppErrorCode.INVALID_OTP);
    }

    if (!verification.verified) {
      logger.warn("Invalid OTP verification result", { medium, email, phoneNumber, ip: req.ip, platform });
      return HttpResponse.error(res, "Invalid OTP. Please try again or request a new OTP.", 400, {
        errorCode: AppErrorCode.INVALID_OTP,
        resend: true,
      });
    }

    logger.info("OTP verified", { transactionReference, userId: user.id });

    // Log verification in audit log
    await prismaClient.auditLog.create({
      data: {
        userId: user.id,
        action: "ACCOUNT_VERIFICATION_COMPLETED",
        entityType: "USER",
        entityId: user.id,
        details: {
          platform,
          contextRole,
          medium,
          email: email || null,
          phoneNumber: normalizedPhoneNumber || null,
          role: user.role?.name || "unknown",
          ip: req.ip,
          transactionReference,
        },
      },
    });

    // Send confirmation email or SMS
    try {
      if (medium === "EMAIL") {
        const emailContent = `<p>Dear ${user.name || "User"},</p>
          <p>Your Quicrefill account (${user.role?.name || "unknown"}) is verified. Welcome to Quicrefill!</p>
          <p>Start exploring our services now.</p>
          <p>Best regards,<br>Quicrefill Team</p>`;

        await emailTemplateService.sendEmail({
          eventType: KnownEventTypes.ACCOUNT_VERIFICATION,
          customPayload: {
            to: email!,
            subject: "Welcome to Quicrefill!",
            htmlContent: emailContent,
          },
          metadata: {
            userId: user.id,
            name: user.name || "User",
            email: user.email,
            role: user.role?.name || "unknown",
            contextRole,
            platform,
          },
        });
        logger.info("Verification email sent", { userId: user.id, email, platform });
      } else {
        const smsContent = `Welcome to Quicrefill, ${user.name || "User"}! Your ${user.role?.name || "unknown"} account is verified. Start exploring now.`;

        await smsTemplateService.sendSMS({
          eventType: KnownEventTypes.OTP_VERIFICATION,
          customPayload: {
            to: normalizedPhoneNumber!,
            content: smsContent,
          },
          metadata: {
            userId: user.id,
            name: user.name || "User",
            role: user.role?.name || "unknown",
            contextRole,
            platform,
          },
        });
        logger.info("Verification SMS sent", { userId: user.id, phoneNumber: normalizedPhoneNumber, platform });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to send confirmation", { userId: user.id, medium, error: errorMessage, platform });
    }

    // Update user verification status
    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        emailVerified: medium === "EMAIL" ? true : user.emailVerified,
        phoneVerified: medium === "SMS" ? true : user.phoneVerified,
      },
    });

    return HttpResponse.success(res, { user }, `${medium} verified successfully`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("AccountVerify error", {
      medium: req.body.medium || "unknown",
      email: req.body.email || "unknown",
      phoneNumber: req.body.phoneNumber || "unknown",
      transactionReference: req.body.transactionReference || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};

// Export both named and default for compatibility
export default AccountVerify;