import { NextFunction, Request, Response } from "express";
import { AppErrorCode } from "../../../exceptions/root";
import { UnprocessableEntity } from "../../../exceptions/validation";
import { z } from "zod";
import { prismaClient } from "../../../";
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests";
import { BadRequest } from "../../../exceptions/badRequests";
import { EmailOtpService } from "../../../lib/utils/mail/otp"; // Corrected import
import { v4 as uuidv4 } from "uuid";
import { emailTemplateService } from "../../../services/email";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";
import { mapToEventType, KnownEventTypes } from "../../../utils/EventTypeDictionary";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/auth.log" }),
    new winston.transports.Console(),
  ],
});

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

const determineContextRole = (role: { name: string }, platform: string): string => {
  if (role.name === "VENDOR" && platform === "app") {
    return "DELIVERY_REP";
  }
  if (role.name === "VENDOR" && platform === "web") {
    return "VENDOR";
  }
  return role.name;
};

export const RequestAccountVerify = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let platform: string = "app";
  try {
    console.log("Starting verification for email:", req.body.email);

    const platformRaw = req.query.platform;
    if (typeof platformRaw === "string") {
      platform = platformRaw;
    } else if (platformRaw) {
      logger.warn("Invalid platform query parameter", {
        platformRaw,
        ip: req.ip,
        platform,
      });
    }

    const schema = z.object({
      email: z.string().email({ message: "Invalid email format" }),
    });
    const validatedData = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      logger.error("Validation error in account verification", {
        errors: err.issues,
        email: req.body.email,
        ip: req.ip,
        platform,
      });
      throw new UnprocessableEntity("Invalid email format", AppErrorCode.UNPROCESSABLE_ENTITY, err);
    });
    const { email } = validatedData;
    console.log("Input validated:", email);

    console.log("Querying user for email:", email);
    const user = await withTimeout(
      prismaClient.user.findUnique({
        where: { email },
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
      logger.warn("User not found for verification", {
        email,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest("User does not exist", AppErrorCode.USER_DOES_NOT_EXIST);
    }
    if (user.emailVerified) {
      logger.warn("Email already verified", {
        email,
        userId: user.id,
        platform,
      });
      throw new BadRequest("Email is already verified", AppErrorCode.EMAIL_ALREADY_VERIFIED);
    }
    if (!user.role) {
      logger.error("User role not found", { email, userId: user.id, platform });
      throw new Error("User role is not defined");
    }
    console.log("User query completed, user found:", user.id);

    const eventType = mapToEventType("OTP_VERIFICATION");
    if (eventType !== KnownEventTypes.OTP_VERIFICATION) {
      logger.error("Invalid event type mapping", { input: "OTP_VERIFICATION", mapped: eventType });
      throw new Error("Invalid event type for OTP verification");
    }
    const transactionReference = `REG_${user.id}_${uuidv4()}`;
    console.log("Generating and sending OTP for email:", email, "with transactionReference:", transactionReference);

    // Instantiate EmailOtpService
    const emailOtpService = new EmailOtpService();
    await withTimeout(
      emailOtpService.generateAndSendOtp({
        userId: user.id,
        email,
        medium: ["EMAIL"],
        transactionReference,
        eventType,
      }),
      10000
    ).catch((otpError: unknown) => {
      const errorMessage: string = otpError instanceof Error ? otpError.message : "Unknown error";
      logger.error("Failed to generate and send OTP", {
        userId: user.id,
        email,
        transactionReference,
        error: errorMessage,
        platform,
      });
      throw new Error(`Failed to send OTP: ${errorMessage}`);
    });
    console.log("OTP sent successfully");

    const contextRole = determineContextRole(user.role, platform);
    await prismaClient.auditLog.create({
      data: {
        userId: user.id,
        action: "VERIFICATION_OTP_REQUEST",
        entityType: "USER",
        entityId: user.id,
        details: {
          platform,
          contextRole,
          email,
          role: user.role.name, // Use role name
          transactionReference,
          ip: req.ip,
        },
      },
    });

    try {
      const isVendorOrRep = user.role.name === "VENDOR" || user.role.name === "DELIVERY_REP";
      await emailTemplateService.sendEmail({
        eventType: KnownEventTypes.ACCOUNT_VERIFICATION,
        userIds: [user.id],
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
          role: user.role.name, // Use role name
          contextRole,
          platform,
          isVendorOrRep,
          vendorDashboardUrl: isVendorOrRep ? "https://vendor.quicrefill.com" : undefined,
        },
      });
      logger.info("Verification email sent", { userId: user.id, email, platform });
    } catch (emailError: unknown) {
      const errorMessage: string = emailError instanceof Error ? emailError.message : "Unknown error";
      logger.error("Failed to send verification email", {
        userId: user.id,
        email,
        error: errorMessage,
        platform,
      });
    }

    HttpResponse.success(res, { transactionReference }, `Verification OTP sent to ${user.name || "User"} on ${email}`);
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in RequestAccountVerify", {
      email: req.body.email || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};