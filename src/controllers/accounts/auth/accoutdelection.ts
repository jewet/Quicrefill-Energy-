import { Request, Response, NextFunction } from "express";
import { AppErrorCode } from "../../../exceptions/root";
import { UnprocessableEntity } from "../../../exceptions/validation";
import { z } from "zod";
import { prismaClient } from "../../../";
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests";
import { EmailOtpService as EmailOtpServiceClass } from "../../../lib/utils/mail/otp";
import { v4 as uuidv4 } from "uuid";
import { emailTemplateService } from "../../../services/email";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";
import { AccountDeletionStatus } from "@prisma/client";
import { KnownEventTypes } from "../../../utils/EventTypeDictionary";
import { AuthUser } from "../../../middlewares/authentication"; // Import AuthUser for consistency

// Instantiate EmailOtpService
const emailOtpService = new EmailOtpServiceClass(); // Adjust based on constructor requirements

// Logger setup
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

// Helper function to add a timeout to a promise
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

// Interface for Role model (from Prisma)
interface Role {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  isActive: boolean;
  createdById: string | null;
}

// Interface for User model with Role relation
interface UserWithRole {
  id: string;
  email: string;
  name: string | null;
  role: Role | null;
  accountDeletionRequest: { id: number; status: AccountDeletionStatus } | null;
  [key: string]: any; // Allow additional fields from Prisma schema
}

// Interface for OTP verification result
interface OtpVerification {
  userId: string;
  eventType: string;
  // Add other fields as needed based on EmailOtpService.verifyOtp response
}

// Helper to determine contextRole
const determineContextRole = (role: string, platform: string): string => {
  if (role === "VENDOR" && platform === "web") {
    return "VENDOR";
  }
  return role;
};

// Extend Request interface to align with AuthUser
interface AuthenticatedRequest extends Request {
  user?: AuthUser; // Use imported AuthUser type
}

// Interface for audit log details
interface AccountDeletionAuditDetails {
  platform: string;
  contextRole: string;
  email: string;
  role: string;
  ip: string | undefined;
  reason?: string | undefined; // Updated to match expected type
  transactionReference: string;
  deletionRequestId?: number;
}

// RequestAccountDeletion controller
export const RequestAccountDeletion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let platform: string = "app";
  try {
    console.log("Starting account deletion OTP request for email:", req.body.email);

    const authUser = req.user;
    if (!authUser) {
      logger.warn("No authenticated user found for account deletion request", {
        email: req.body.email,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest("Unauthorized: No authenticated user", AppErrorCode.UNAUTHORIZED);
    }
    if (authUser.email !== req.body.email) {
      logger.warn("Unauthorized account deletion attempt: Email mismatch", {
        authUserEmail: authUser.email,
        requestedEmail: req.body.email,
        authUserId: authUser.id,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest("Unauthorized: Email does not match authenticated user", AppErrorCode.UNAUTHORIZED);
    }

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
      reason: z.string().optional(),
    });
    const validatedData = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      logger.error("Validation error in account deletion OTP request", {
        errors: err.issues,
        email: req.body.email,
        ip: req.ip,
        platform,
      });
      throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });
    const { email, reason } = validatedData;
    console.log("Input validated:", email);

    const user: UserWithRole | null = await withTimeout(
      prismaClient.user.findUnique({
        where: { email },
        include: {
          accountDeletionRequest: true,
          role: true,
        },
      }),
      5000
    ).catch((dbError: unknown) => {
      const errorMessage = dbError instanceof Error ? dbError.message : "Unknown error";
      logger.error("Database query failed", {
        email,
        error: errorMessage,
        platform,
      });
      throw new Error("Failed to query user from database");
    });
    if (!user) {
      logger.warn("User not found for account deletion OTP request", {
        email,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest("User does not exist", AppErrorCode.USER_DOES_NOT_EXIST);
    }
    console.log("User query completed, user found:", user.id);

    if (
      user.accountDeletionRequest &&
      (user.accountDeletionRequest.status === AccountDeletionStatus.PENDING ||
        user.accountDeletionRequest.status === AccountDeletionStatus.UNDER_REVIEW)
    ) {
      logger.warn("Active account deletion request already exists", {
        userId: user.id,
        email,
        deletionRequestId: user.accountDeletionRequest.id,
        status: user.accountDeletionRequest.status,
        platform,
      });
      throw new UnprocessableEntity(
        "An active account deletion request already exists",
        AppErrorCode.DUPLICATE_DELETION_REQUEST,
        { deletionRequestId: user.accountDeletionRequest.id, status: user.accountDeletionRequest.status }
      );
    }

    const transactionReference = uuidv4();
    console.log("Generating and sending OTP for email:", email, "with transactionReference:", transactionReference);
    await withTimeout(
      emailOtpService.generateAndSendOtp({
        userId: user.id,
        email,
        medium: ["EMAIL"],
        transactionReference,
        eventType: KnownEventTypes.ACCOUNT_DELETION_REQUEST,
      }),
      10000
    ).catch((otpError: unknown) => {
      const errorMessage = otpError instanceof Error ? otpError.message : "Unknown error";
      logger.error("Failed to generate and send OTP", {
        userId: user.id,
        email,
        error: errorMessage,
        platform,
      });
      throw new Error("Failed to send OTP, please try again");
    });
    console.log("OTP sent successfully");

    const contextRole = determineContextRole(authUser.role, platform);
    await prismaClient.auditLog.create({
      data: {
        userId: user.id,
        action: "ACCOUNT_DELETION_OTP_REQUESTED",
        entityType: "USER",
        entityId: user.id,
        details: {
          platform,
          contextRole,
          email,
          role: authUser.role,
          ip: req.ip,
          reason: reason || undefined, // Fix: Changed from null to undefined
          transactionReference,
        },
        createdAt: new Date(),
      },
    });
    console.log("Audit log created for account deletion OTP request");

    try {
      const isVendor = authUser.role === "VENDOR";
      const emailContent = isVendor
        ? `<p>Dear ${user.name || "User"},</p>
           <p>We have received your request to delete your Quicrefill account (${authUser.role}). An OTP has been sent to your email to verify this request.</p>
           <p>Please check your inbox (and spam/junk folder) for the OTP and enter it in the Quicrefill app or website to confirm your account deletion request.</p>
           <p>If you were accessing the Vendor dashboard at <a href="https://vendor.quicrefill.com">vendor.quicrefill.com</a>, access will remain active until the request is approved.</p>
           ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ""}
           <p>If you did not initiate this request, please contact support at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a> immediately.</p>
           <p>Best regards,<br>Quicrefill Team</p>`
        : `<p>Dear ${user.name || "User"},</p>
           <p>We have received your request to delete your Quicrefill account (${authUser.role}). An OTP has been sent to your email to verify this request.</p>
           <p>Please check your inbox (and spam/junk folder) for the OTP and enter it in the Quicrefill app or website to confirm your account deletion request.</p>
           ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ""}
           <p>If you did not initiate this request, please contact support at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a> immediately.</p>
           <p>Best regards,<br>Quicrefill Team</p>`;

      await emailTemplateService.sendEmail({
        eventType: KnownEventTypes.ACCOUNT_DELETION_REQUEST,
        customPayload: {
          to: user.email,
          subject: "Account Deletion Request Received",
          htmlContent: emailContent,
        },
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
          role: authUser.role,
          contextRole,
          platform,
          reason: reason || undefined, // Fix: Changed from null to undefined
          transactionReference,
        },
      });
      logger.info("Account deletion confirmation email sent", {
        userId: user.id,
        email,
        platform,
        transactionReference,
      });
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      logger.error("Failed to send account deletion confirmation email", {
        userId: user.id,
        email,
        error: errorMessage,
        platform,
        transactionReference,
      });
    }

    HttpResponse.success(
      res,
      { transactionReference },
      `OTP sent to ${user.name || "User"} on ${email} to verify account deletion request`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in RequestAccountDeletion", {
      email: req.body.email || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};

// VerifyAccountDeletionOtp controller
export const VerifyAccountDeletionOtp = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let platform: string = "app";
  try {
    console.log("Starting account deletion OTP verification for transactionReference:", req.body.transactionReference);

    const authUser = req.user;
    if (!authUser) {
      logger.warn("No authenticated user found for OTP verification", {
        transactionReference: req.body.transactionReference,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest("Unauthorized: No authenticated user", AppErrorCode.UNAUTHORIZED);
    }

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
      transactionReference: z.string().uuid({ message: "Invalid transaction reference format" }),
      code: z.string().length(6, { message: "OTP code must be 6 digits" }).regex(/^\d{6}$/, { message: "OTP code must be numeric" }),
    });
    const validatedData = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      logger.error("Validation error in account deletion OTP verification", {
        errors: err.issues,
        transactionReference: req.body.transactionReference,
        ip: req.ip,
        platform,
      });
      throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });
    const { transactionReference, code } = validatedData;
    console.log("Input validated:", transactionReference);

    const otpVerification = (await withTimeout(
      emailOtpService.verifyOtp(transactionReference, code),
      5000
    )) as OtpVerification;
    console.log("OTP verified successfully:", otpVerification);

    if (otpVerification.eventType !== KnownEventTypes.ACCOUNT_DELETION_REQUEST) {
      logger.warn("Invalid OTP event type for account deletion", {
        transactionReference,
        eventType: otpVerification.eventType,
        userId: authUser.id,
        platform,
      });
      throw new UnprocessableEntity(
        "OTP is not valid for account deletion request",
        AppErrorCode.INVALID_OTP,
        { eventType: otpVerification.eventType }
      );
    }

    if (otpVerification.userId !== authUser.id) {
      logger.warn("User ID mismatch in OTP verification", {
        transactionReference,
        otpUserId: otpVerification.userId,
        authUserId: authUser.id,
        platform,
      });
      throw new UnauthorizedRequest("Unauthorized: OTP does not belong to this user", AppErrorCode.UNAUTHORIZED);
    }

    const user: UserWithRole | null = await withTimeout(
      prismaClient.user.findUnique({
        where: { id: authUser.id },
        include: {
          role: true,
          accountDeletionRequest: true,
        },
      }),
      5000
    ).catch((dbError: unknown) => {
      const errorMessage = dbError instanceof Error ? dbError.message : "Unknown error";
      logger.error("Database query failed", {
        userId: authUser.id,
        error: errorMessage,
        platform,
      });
      throw new Error("Failed to query user from database");
    });
    if (!user) {
      logger.warn("User not found for OTP verification", {
        userId: authUser.id,
        transactionReference,
        ip: req.ip,
        platform,
      });
      throw new UnauthorizedRequest("User does not exist", AppErrorCode.USER_DOES_NOT_EXIST);
    }

    const auditLog = await prismaClient.auditLog.findFirst({
      where: {
        userId: authUser.id,
        action: "ACCOUNT_DELETION_OTP_REQUESTED",
        details: { path: ["transactionReference"], equals: transactionReference },
      },
      select: { details: true },
    });

    let reason: string | undefined;
    if (auditLog?.details) {
      const details = auditLog.details as unknown as AccountDeletionAuditDetails;
      reason = details.reason ?? undefined;
    }
    console.log("Reason fetched from audit log:", reason);

    const existingDeletionRequest = await prismaClient.accountDeletionRequest.findUnique({
      where: { userId: user.id },
    });
    if (
      existingDeletionRequest &&
      (existingDeletionRequest.status === AccountDeletionStatus.PENDING ||
        existingDeletionRequest.status === AccountDeletionStatus.UNDER_REVIEW)
    ) {
      logger.warn("Active account deletion request already exists", {
        userId: user.id,
        deletionRequestId: existingDeletionRequest.id,
        status: existingDeletionRequest.status,
        platform,
      });
      throw new UnprocessableEntity(
        "An active account deletion request already exists",
        AppErrorCode.DUPLICATE_DELETION_REQUEST,
        { deletionRequestId: existingDeletionRequest.id, status: existingDeletionRequest.status }
      );
    }

    const accountDeletionRequest = await prismaClient.accountDeletionRequest.create({
      data: {
        userId: user.id,
        reason: reason || undefined, // Fix: Changed from null to undefined
        status: AccountDeletionStatus.PENDING,
        requestedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log("Account deletion request created:", accountDeletionRequest.id);

    const contextRole = determineContextRole(authUser.role, platform);
    await prismaClient.auditLog.create({
      data: {
        userId: user.id,
        action: "ACCOUNT_DELETION_REQUESTED",
        entityType: "ACCOUNT_DELETION_REQUEST",
        entityId: uuidv4(),
        details: {
          platform,
          contextRole,
          email: user.email,
          role: authUser.role,
          ip: req.ip,
          reason: reason || undefined, // Fix: Changed from null to undefined
          transactionReference,
          deletionRequestId: accountDeletionRequest.id,
        },
        createdAt: new Date(),
      },
    });
    console.log("Audit log created for account deletion request");

    try {
      const isVendor = authUser.role === "VENDOR";
      const emailContent = isVendor
        ? `<p>Dear ${user.name || "User"},</p>
           <p>Your request to delete your Quicrefill account (${authUser.role}) has been received and is now pending review.</p>
           <p>We will process your request within 7 business days. If approved, your account will be permanently deleted, and you will receive a confirmation email.</p>
           <p>If you were accessing the Vendor dashboard at <a href="https://vendor.quicrefill.com">vendor.quicrefill.com</a>, access will remain active until the request is approved.</p>
           ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ""}
           <p>If you did not initiate this request or wish to cancel it, please contact support at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a> immediately.</p>
           <p>Best regards,<br>Quicrefill Team</p>`
        : `<p>Dear ${user.name || "User"},</p>
           <p>Your request to delete your Quicrefill account (${authUser.role}) has been received and is now pending review.</p>
           <p>We will process your request within 7 business days. If approved, your account will be permanently deleted, and you will receive a confirmation email.</p>
           ${reason ? `<p><strong>Reason provided:</strong> ${reason}</p>` : ""}
           <p>If you did not initiate this request or wish to cancel it, please contact support at <a href="mailto:support@quicrefill.com">support@quicrefill.com</a> immediately.</p>
           <p>Best regards,<br>Quicrefill Team</p>`;

      await emailTemplateService.sendEmail({
        eventType: KnownEventTypes.ACCOUNT_DELETION_REQUEST,
        customPayload: {
          to: user.email,
          subject: "Account Deletion Request Submitted",
          htmlContent: emailContent,
        },
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
          role: authUser.role,
          contextRole,
          platform,
          reason: reason || undefined, // Fix: Changed from null to undefined
          transactionReference,
          deletionRequestId: accountDeletionRequest.id,
        },
      });
      logger.info("Account deletion request confirmation email sent", {
        userId: user.id,
        email: user.email,
        platform,
        transactionReference,
        deletionRequestId: accountDeletionRequest.id,
      });
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      logger.error("Failed to send account deletion request confirmation email", {
        userId: user.id,
        email: user.email,
        error: errorMessage,
        platform,
        transactionReference,
        deletionRequestId: accountDeletionRequest.id,
      });
    }

    HttpResponse.success(
      res,
      { deletionRequestId: accountDeletionRequest.id, transactionReference },
      `Account deletion request submitted successfully for ${user.email}. A confirmation email has been sent.`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error in VerifyAccountDeletionOtp", {
      transactionReference: req.body.transactionReference || "unknown",
      error: errorMessage,
      ip: req.ip || "unknown",
      platform,
    });
    next(error);
  }
};