import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../../../lib/types/auth";
import { UnprocessableEntity } from "../../../exceptions/validation";
import { AppErrorCode } from "../../../exceptions/root";
import { ProfileUpdateSchema } from "../../../schemas/profile";
import { prismaClient } from "../../..";
import { EmailOtpService } from "../../../lib/utils/mail/otp";
import { getRedisClient } from "../../../config/redis";
import { Prisma } from "@prisma/client";
import winston from "winston";
import * as crypto from "crypto";

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

// Initialize EmailOtpService
const emailOtpService = new EmailOtpService();

export const ProfileUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Validate authenticated user
    if (!req.user || !req.user.id || !req.user.role) {
      throw new UnprocessableEntity("Unauthorized: No user authenticated", AppErrorCode.UNAUTHENTICATED, null);
    }

    // Validate user role by checking if it exists in the Role table
    const role = await prismaClient.role.findUnique({
      where: { name: req.user.role },
    });
    if (!role) {
      throw new UnprocessableEntity(`Invalid user role: ${req.user.role}`, AppErrorCode.INVALID_REQUEST, null);
    }

    // Validate request body against schema
    const validatedData = await ProfileUpdateSchema.parseAsync(req.body);
    logger.info("Validated profile update data", { userId: req.user.id, data: validatedData });

    // Define data to update for User
    const userUpdateData: {
      email?: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      phoneNumber?: string;
      avatar?: string;
      dateOfBirth?: Date;
      emailVerified?: boolean;
    } = {
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      name: validatedData.name,
      phoneNumber: validatedData.phoneNumber,
      avatar: validatedData.avatar,
      dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
    };

    // Handle email update with OTP verification
    const redis = await getRedisClient();
    const transactionReference = crypto.randomUUID();

    if (validatedData.email && validatedData.email !== req.user.email) {
      userUpdateData.email = validatedData.email;
      userUpdateData.emailVerified = false;

      // Generate and send OTP
      const user = await prismaClient.user.findUnique({
        where: { id: req.user.id },
        select: { firstName: true, lastName: true, roleId: true },
      });
      if (!user || (!user.firstName && !user.lastName)) {
        throw new UnprocessableEntity("User not found or missing name", AppErrorCode.INVALID_REQUEST, null);
      }

      const otpRequest = {
        userId: req.user.id,
        email: validatedData.email,
        medium: ["EMAIL"],
        transactionReference,
        eventType: "PROFILE_UPDATE",
        metadata: {
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          role: role.name,
        },
      };

      await emailOtpService.generateAndSendOtp(otpRequest);
      logger.info("OTP sent for email update", { userId: req.user.id, email: validatedData.email, transactionReference });

      // Store pending user update in Redis (expires in 10 minutes)
      const pendingUpdate = {
        userId: req.user.id,
        userUpdateData,
        transactionReference,
      };
      await redis.setEx(`pending_profile_update:${transactionReference}`, 600, JSON.stringify(pendingUpdate));
      logger.info("Pending profile update stored in Redis", { transactionReference });

      return res.json({
        success: true,
        data: { transactionReference },
        message: "OTP sent to new email. Please verify to complete profile update.",
      });
    }

    // Perform update if no email change
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      // Update User
      const user = await tx.user.update({
        where: { id: req.user!.id },
        data: userUpdateData,
      });

      // Find or create Profile
      let profile = await tx.profile.findFirst({
        where: { userId: req.user!.id },
      });

      if (!profile) {
        profile = await tx.profile.create({
          data: {
            id: crypto.randomUUID(),
            userId: req.user!.id,
            roleId: role.id, // Set roleId directly
            createdAt: new Date(),
            updatedAt: new Date(),
            isWebEnabled: false,
            deliveries: 0,
            walletBalance: 0.0,
            businessVerificationStatus: "PENDING",
            identityVerificationStatus: "PENDING",
            serviceVerificationStatus: "PENDING",
            rating: 0.0,
            yearsOnPlatform: 0.0,
            fiveStarRatingsCount: 0,
          } as Prisma.ProfileUncheckedCreateInput, // Explicitly type as UncheckedCreateInput
        });
      }

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "UPDATE_PROFILE",
          entityType: "USER_PROFILE",
          entityId: req.user!.id,
          details: {
            updatedFields: Object.keys(validatedData).filter((key) => validatedData[key as keyof typeof validatedData] !== undefined),
            emailChanged: !!validatedData.email,
          } as Prisma.JsonObject,
        },
      });

      return { user, profile };
    });

    logger.info("Profile updated successfully", { userId: req.user.id });

    res.json({
      success: true,
      data: {
        user: updatedUser.user,
        profile: updatedUser.profile,
      },
      message: "Profile updated successfully",
    });
  } catch (err: any) {
    logger.error("ProfileUpdate error", { error: err.message, userId: req.user?.id });
    if (err instanceof UnprocessableEntity) {
      next(err);
    } else {
      next(new UnprocessableEntity(err.message || "Unprocessable Entity", AppErrorCode.UNPROCESSABLE_ENTITY, err?.issues || null));
    }
  }
};

export const VerifyProfileUpdateOtp = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Validate authenticated user
    if (!req.user || !req.user.id) {
      throw new UnprocessableEntity("Unauthorized: No user authenticated", AppErrorCode.UNAUTHENTICATED, null);
    }

    // Validate user role by checking if it exists in the Role table
    const role = await prismaClient.role.findUnique({
      where: { name: req.user.role },
    });
    if (!role) {
      throw new UnprocessableEntity(`Invalid user role: ${req.user.role}`, AppErrorCode.INVALID_REQUEST, null);
    }

    const { transactionReference, otpCode } = req.body;
    if (!transactionReference || !otpCode) {
      throw new UnprocessableEntity("Transaction reference and OTP code are required", AppErrorCode.INVALID_REQUEST, null);
    }

    // Verify OTP
    const otpVerification = await emailOtpService.verifyOtp(transactionReference, otpCode);
    if (!otpVerification.verified) {
      throw new UnprocessableEntity("OTP verification failed", AppErrorCode.INVALID_OTP, null);
    }

    // Retrieve pending update from Redis
    const redis = await getRedisClient();
    const pendingUpdateKey = `pending_profile_update:${transactionReference}`;
    const pendingUpdateRaw = await redis.get(pendingUpdateKey);
    if (!pendingUpdateRaw) {
      throw new UnprocessableEntity("Pending profile update not found or expired", AppErrorCode.INVALID_REQUEST, null);
    }

    const pendingUpdate = JSON.parse(pendingUpdateRaw);
    if (pendingUpdate.userId !== req.user.id) {
      throw new UnprocessableEntity("Unauthorized: Invalid user for this update", AppErrorCode.UNAUTHENTICATED, null);
    }

    // Perform update in transaction
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      // Update User
      const user = await tx.user.update({
        where: { id: req.user!.id },
        data: pendingUpdate.userUpdateData,
      });

      // Find or create Profile
      let profile = await tx.profile.findFirst({
        where: { userId: req.user!.id },
      });

      if (!profile) {
        profile = await tx.profile.create({
          data: {
            id: crypto.randomUUID(),
            userId: req.user!.id,
            roleId: role.id, // Set roleId directly
            createdAt: new Date(),
            updatedAt: new Date(),
            isWebEnabled: false,
            deliveries: 0,
            walletBalance: 0.0,
            businessVerificationStatus: "PENDING",
            identityVerificationStatus: "PENDING",
            serviceVerificationStatus: "PENDING",
            rating: 0.0,
            yearsOnPlatform: 0.0,
            fiveStarRatingsCount: 0,
          } as Prisma.ProfileUncheckedCreateInput, // Explicitly type as UncheckedCreateInput
        });
      }

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "UPDATE_PROFILE",
          entityType: "USER_PROFILE",
          entityId: req.user!.id,
          details: {
            updatedFields: Object.keys(pendingUpdate.userUpdateData),
            emailChanged: !!pendingUpdate.userUpdateData.email,
          } as Prisma.JsonObject,
        },
      });

      return { user, profile };
    });

    // Clean up Redis
    await redis.del(pendingUpdateKey);
    logger.info("Profile updated after OTP verification", { userId: req.user.id, transactionReference });

    res.json({
      success: true,
      data: {
        user: updatedUser.user,
        profile: updatedUser.profile,
      },
      message: "Profile updated successfully after OTP verification",
    });
  } catch (err: any) {
    logger.error("VerifyProfileUpdateOtp error", { error: err.message, userId: req.user?.id });
    if (err instanceof UnprocessableEntity) {
      next(err);
    } else {
      next(new UnprocessableEntity(err.message || "Unprocessable Entity", AppErrorCode.UNPROCESSABLE_ENTITY, err?.issues || null));
    }
  }
};