import { NextFunction, Request, Response } from "express";
import { AppErrorCode } from "../../../exceptions/root";
import { UnprocessableEntity } from "../../../exceptions/validation";
import { z } from "zod";
import { prismaClient } from "../../../";
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests";
import { EmailOtpService } from "../../../lib/utils/mail/otp";
import { v4 as uuidv4 } from "uuid";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";
import { mapToEventType, KnownEventTypes } from "../../../utils/EventTypeDictionary";
import bcrypt from "bcryptjs";
import { generateTokenPair } from "../../../lib/utils/jwt/generateTokenPair";
import { storeAccessToken } from "../../../lib/storage/jwt_tokens";
import { addEmailJob, EmailJobData } from "../../../queues/emailQueue";

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

// Helper function to add a timeout to a promise
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

// Helper to determine contextRole
const determineContextRole = (roleName: string, platform: string): string => {
  if (roleName === "VENDOR" && platform === "app") {
    return "DELIVERY_REP";
  }
  if (roleName === "VENDOR" && platform === "web") {
    return "VENDOR";
  }
  return roleName;
};

// Validation schema for password reset request
const RequestPasswordResetSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
});

// Validation schema for OTP verification
const VerifyPasswordResetOTPSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  transactionReference: z.string().uuid({ message: "Invalid transaction reference" }),
  otp: z.string().length(6, { message: "OTP must be 6 digits" }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters" }),
});

// Platform validation schema
const PlatformSchema = z.enum(["app", "web"]).default("app");

export const RequestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let platform: string = "app"; // Initialize platform with default value
  try {
    console.log("Starting password reset for email:", req.body.email);

    // Validate platform query parameter
    const platformRaw = req.query.platform;
    platform = PlatformSchema.parse(
      Array.isArray(platformRaw) ? platformRaw[0] : platformRaw
    );
    console.log("Platform validated:", platform);

    // Validate input
    const validatedData = await RequestPasswordResetSchema.parseAsync(req.body).catch(
      (err: z.ZodError) => {
        logger.error("Validation error in password reset request", {
          errors: err.issues,
          email: req.body.email,
          ip: req.ip,
          platform,
        });
        throw new UnprocessableEntity(
          "Validation error",
          AppErrorCode.UNPROCESSABLE_ENTITY,
          err.issues
        );
      }
    );
    const { email } = validatedData;
    console.log("Input validated:", email);

    // Query user with timeout, including role
    console.log("Querying user for email:", email);
    const user = await withTimeout(
      prismaClient.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { role: true }, // Include the role relation
      }),
      5000
    ).catch((dbError: unknown) => {
      const errorMessage: string = dbError instanceof Error ? dbError.message : "Unknown error";
      logger.error("Database query failed", {
        email,
        error: errorMessage,
        platform,
      });
      throw new Error("Failed to query user from database");
    });

    if (!user) {
      logger.warn("User not found for password reset", {
        email,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest(
        "User does not exist",
        AppErrorCode.USER_DOES_NOT_EXIST
      );
    }

    // Check if role exists
    if (!user.role) {
      logger.error("User role not found", { email, userId: user.id, platform });
      throw new UnprocessableEntity(
        "User role is not defined",
        AppErrorCode.INVALID_ROLE,
        [{ message: "User role is not defined" }]
      );
    }

    // Ensure role properties are accessed safely
    const role = user.role; // TypeScript now knows role is defined
    console.log("User query completed, user found:", user.id, "Role:", role.name);

    // Check if user is blocked
    if (user.blocked) {
      logger.warn("Password reset attempt on blocked account", {
        email,
        userId: user.id,
        platform,
      });
      throw new UnauthorizedRequest(
        `Your account has been banned by admin. Reason: ${user.banReason || "Not specified"}`,
        AppErrorCode.UNAUTHORIZED
      );
    }

    // Check if user is a social account
    if (user.isSocialAccount) {
      logger.warn("Password reset attempt on social account", {
        email,
        userId: user.id,
        platform,
      });
      throw new UnauthorizedRequest(
        "Social account users must reset their password via their provider",
        AppErrorCode.UNAUTHORIZED
      );
    }

    // Define event type
    const eventType = "PASSWORD_RESET";
    console.log("Event input for OTP:", eventType);
    const mappedEventType = mapToEventType(eventType);
    console.log("Mapped eventType for email service:", mappedEventType);

    // Validate mapped event type
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

    // Generate and send OTP
    const transactionReference = uuidv4();
    console.log(
      "Generating and sending OTP for email:",
      email,
      "with transactionReference:",
      transactionReference
    );
    console.log("User data:", {
      id: user.id,
      email: user.email,
      role: role.name,
      name: user.name,
    });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Instantiate EmailOtpService
    const emailOtpService = new EmailOtpService();
    await withTimeout(
      emailOtpService.generateAndSendOtp({
        userId: user.id,
        email,
        medium: ["EMAIL"],
        transactionReference,
        eventType,
        metadata: {
          userId: user.id,
          name: user.name || "User",
          role: {
            id: role.id,
            name: role.name,
            description: role.description,
            isActive: role.isActive,
            createdById: role.createdById,
            createdAt: role.createdAt.toISOString(),
            updatedAt: role.updatedAt.toISOString(),
          },
          expiresAt: expiresAt.toLocaleString(),
          platform,
        },
      }),
      10000
    ).catch((otpError: unknown) => {
      const errorMessage: string = otpError instanceof Error ? otpError.message : "Unknown error";
      logger.error("Failed to generate and send OTP", {
        userId: user.id,
        email,
        error: errorMessage,
        platform,
        eventType,
        mappedEventType,
        userData: {
          id: user.id,
          email: user.email,
          role: role.name,
          name: user.name,
        },
      });
      throw new Error(`Failed to send OTP: ${errorMessage}`);
    });
    console.log("OTP sent successfully");

    // Log action in AuditLog
    const contextRole = determineContextRole(role.name, platform);
    await prismaClient.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUEST",
        entityType: "USER",
        entityId: user.id,
        details: {
          platform,
          contextRole,
          email,
          role: role.name,
          ip: req.ip,
        },
      },
    });

    // Success response with transactionReference
    HttpResponse.success(
      res,
      { transactionReference },
      `Password reset OTP sent to ${user.name || "User"} on ${email}`
    );
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in RequestPasswordReset", {
      email: req.body.email || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};

export const VerifyPasswordResetOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let platform: string = "app";
  try {
    console.log("Starting OTP verification for password reset:", req.body.email);

    // Validate platform query parameter
    const platformRaw = req.query.platform;
    platform = PlatformSchema.parse(
      Array.isArray(platformRaw) ? platformRaw[0] : platformRaw
    );
    console.log("Platform validated:", platform);

    // Validate input
    const validatedData = await VerifyPasswordResetOTPSchema.parseAsync(req.body).catch(
      (err: z.ZodError) => {
        logger.error("Validation error in OTP verification", {
          errors: err.issues,
          email: req.body.email,
          ip: req.ip,
          platform,
        });
        throw new UnprocessableEntity(
          "Validation error",
          AppErrorCode.UNPROCESSABLE_ENTITY,
          err.issues
        );
      }
    );
    const { email, transactionReference, otp, newPassword } = validatedData;
    console.log("Input validated:", { email, transactionReference });

    // Query user with timeout, including role
    console.log("Querying user for email:", email);
    const user = await withTimeout(
      prismaClient.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { role: true },
      }),
      5000
    ).catch((dbError: unknown) => {
      const errorMessage: string = dbError instanceof Error ? dbError.message : "Unknown error";
      logger.error("Database query failed", {
        email,
        error: errorMessage,
        platform,
      });
      throw new Error("Failed to query user from database");
    });

    if (!user) {
      logger.warn("User not found for OTP verification", {
        email,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest(
        "User does not exist",
        AppErrorCode.USER_DOES_NOT_EXIST
      );
    }

    // Check if role exists
    if (!user.role) {
      logger.error("User role not found", { email, userId: user.id, platform });
      throw new UnprocessableEntity(
        "User role is not defined",
        AppErrorCode.INVALID_ROLE,
        [{ message: "User role is not defined" }]
      );
    }

    // Ensure role properties are accessed safely
    const role = user.role; // TypeScript now knows role is defined
    console.log("User query completed, user found:", user.id, "Role:", role.name);

    // Check if user is blocked
    if (user.blocked) {
      logger.warn("OTP verification attempt on blocked account", {
        email,
        userId: user.id,
        platform,
      });
      throw new UnauthorizedRequest(
        `Your account has been banned by admin. Reason: ${user.banReason || "Not specified"}`,
        AppErrorCode.UNAUTHORIZED
      );
    }

    // Check if user is a social account
    if (user.isSocialAccount) {
      logger.warn("OTP verification attempt on social account", {
        email,
        userId: user.id,
        platform,
      });
      throw new UnauthorizedRequest(
        "Social account users must reset their password via their provider",
        AppErrorCode.UNAUTHORIZED
      );
    }

    // Verify OTP
    console.log("Verifying OTP...");
    const otpStart = Date.now();
    const emailOtpService = new EmailOtpService();
    await emailOtpService.verifyOtp(transactionReference, otp).catch((otpError: unknown) => {
      const errorMessage: string = otpError instanceof Error ? otpError.message : "Unknown error";
      logger.error("OTP verification failed", {
        userId: user.id,
        email,
        transactionReference,
        error: errorMessage,
        platform,
      });
      throw new UnauthorizedRequest(
        "Invalid or expired OTP",
        AppErrorCode.INVALID_OTP
      );
    });
    console.log(`OTP verification took ${Date.now() - otpStart}ms`);
    logger.info("OTP verified successfully", { userId: user.id, email, transactionReference });

    // Hash new password
    console.log("Hashing new password...");
    const passwordStart = Date.now();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`Password hashing took ${Date.now() - passwordStart}ms`);

    // Update user password
    console.log("Updating user password...");
    const updateStart = Date.now();
    await prismaClient.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      // Log action in AuditLog
      const contextRole = determineContextRole(role.name, platform);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET_COMPLETED",
          entityType: "USER",
          entityId: user.id,
          details: {
            platform,
            contextRole,
            email,
            role: role.name,
            ip: req.ip,
          },
        },
      });
    });
    console.log(`Password update took ${Date.now() - updateStart}ms`);
    logger.info("Password updated successfully", { userId: user.id, email });

    // Generate token pair
    console.log("Generating token pair...");
    const tokenStart = Date.now();
    const payload = {
      userId: user.id,
      email: user.email,
      role: role.name,
      contextRole: determineContextRole(role.name, platform),
    };
    console.log("Token payload:", payload);
    const token = await generateTokenPair(payload);
    console.log(`Token generation took ${Date.now() - tokenStart}ms`);
    console.log("Token generated:", token);

    // Store access token in Redis
    console.log("Storing access token in Redis...");
    const redisStart = Date.now();
    try {
      await storeAccessToken(token.accessToken, user.id);
      console.log(`Access token storage took ${Date.now() - redisStart}ms`);
      console.log("Access token stored for user:", user.id);
    } catch (error) {
      console.error("Error storing access token:", error);
      throw new Error("Failed to store access token");
    }

    // Set token in cookies
    console.log("Setting cookie...");
    const cookieStart = Date.now();
    res.cookie("token", token.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    console.log(`Cookie setting took ${Date.now() - cookieStart}ms`);

    // Queue password reset success email
    const resetSuccessEmail: EmailJobData = {
      eventType: KnownEventTypes.PASSWORD_RESET,
      customPayload: {
        to: user.email,
        from: "noreply@quicrefill.com",
        subject: "Your Quicrefill Password Has Been Reset",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Quicrefill - Password Reset Successful</h2>
            <p style="color: #333; font-size: 16px;">Dear ${user.name || "User"},</p>
            <p style="color: #333; font-size: 16px;">Your password has been successfully reset on the Quicrefill ${platform.charAt(0).toUpperCase() + platform.slice(1)} platform at ${new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" })} (WAT).</p>
            <p style="color: #333; font-size: 16px;">If you did not initiate this action, please secure your account and contact our support team immediately at <a href="mailto:support@quicrefill.com" style="color: #007bff; text-decoration: none;">support@quicrefill.com</a>.</p>
            <p style="color: #333; font-size: 16px;">Thank you for choosing Quicrefill!</p>
            <p style="color: #333; font-size: 16px; margin-top: 20px;">Best regards,<br>The Quicrefill Team</p>
            <hr style="border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="color: #777; font-size: 12px; text-align: center;">Quicrefill, Inc. | <a href="https://www.quicrefill.com" style="color: #007bff; text-decoration: none;">www.quicrefill.com</a></p>
          </div>
        `,
      },
      metadata: {
        userId: user.id,
        name: user.name || "User",
        email: user.email,
        role: role.name,
        contextRole: determineContextRole(role.name, platform),
        platform,
      },
    };

    try {
      console.log("Queuing password reset success email...");
      await addEmailJob(resetSuccessEmail);
      logger.info("Password reset success email queued", {
        email: user.email,
        userId: user.id,
        transactionReference,
      });
    } catch (emailError: unknown) {
      const errorMessage: string = emailError instanceof Error ? emailError.message : "Unknown error";
      console.error("Failed to queue password reset success email:", errorMessage);
      logger.error("Failed to queue password reset success email", {
        email: user.email,
        userId: user.id,
        transactionReference,
        error: errorMessage,
        stack: emailError instanceof Error ? emailError.stack : undefined,
      });
    }

    // Success response
    HttpResponse.success(res, { token }, "Password reset completed successfully");
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in VerifyPasswordResetOTP", {
      email: req.body.email || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};