import { NextFunction, Request, Response } from "express";
import { prismaClient } from "../../../config/db";
import bcrypt from "bcryptjs";
import { BadRequest } from "../../../exceptions/badRequests";
import { AppErrorCode } from "../../../exceptions/root";
import { z } from "zod";
import { EmailOtpService } from "../../../lib/utils/mail/otp";
import { v4 as uuid } from "uuid";
import { emailTemplateService } from "../../../services/email";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";
import { mapToEventType, KnownEventTypes } from "../../../utils/EventTypeDictionary";
import { Prisma } from "@prisma/client";

// Logger setup
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

// Validation schema
const RegisterUserSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .optional()
    .or(z.literal(undefined)), // Optional for social accounts
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  roleId: z.string().uuid({ message: "Invalid role ID" }).optional(),
  isSocialAccount: z.boolean().default(false),
  socialAccountProvider: z.enum(['FACEBOOK', 'GOOGLE']).nullable().optional(), // Matches SocialAccountProvider enum
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  let platform: string = "app"; // Default to app

  try {
    // Handle platform query parameter
    const platformRaw = req.query.platform;
    if (typeof platformRaw === "string") {
      platform = platformRaw;
    } else if (platformRaw) {
      logger.warn("Invalid platform query parameter", { platformRaw, ip: req.ip, platform });
    }

    console.log("Request body:", req.body);

    // Validate request body
    const requestBody = { isSocialAccount: false, ...req.body };
    const validatedData = await RegisterUserSchema.parseAsync(requestBody).catch((err: z.ZodError) => {
      logger.error("Validation error in registration", {
        errors: err.issues,
        email: requestBody.email,
        ip: req.ip,
        platform,
      });
      throw err;
    });
    console.log("Validated data:", validatedData, `Time after validation: ${Date.now() - startTime}ms`);

    const {
      email,
      password,
      firstName,
      lastName,
      roleId,
      isSocialAccount = false,
      socialAccountProvider,
      address,
      phoneNumber,
    } = validatedData;

    // Default to CUSTOMER role if none provided
    let selectedRoleId = roleId;
    if (!selectedRoleId) {
      const defaultRole = await prismaClient.role.findFirst({
        where: { name: "CUSTOMER" },
      });
      if (!defaultRole) {
        throw new BadRequest("Default CUSTOMER role not found", AppErrorCode.INVALID_INPUT);
      }
      selectedRoleId = defaultRole.id;
    }

    // Validate role exists
    const role = await prismaClient.role.findUnique({
      where: { id: selectedRoleId },
    });
    if (!role) {
      throw new BadRequest("Invalid role ID", AppErrorCode.INVALID_INPUT);
    }

    // Check for existing user
    const existingUser = await prismaClient.user.findUnique({ where: { email } });
    console.log("Existing user check:", existingUser, `Time after user check: ${Date.now() - startTime}ms`);
    if (existingUser) {
      await sendFailureEmail(email, "User already exists", platform);
      throw new BadRequest("User already exists", AppErrorCode.USER_ALREADY_EXIST);
    }

    // Check for existing phone number
    if (phoneNumber) {
      const existingUserByPhone = await prismaClient.user.findUnique({ where: { phoneNumber } });
      console.log("Existing phone check:", existingUserByPhone, `Time after phone check: ${Date.now() - startTime}ms`);
      if (existingUserByPhone) {
        await sendFailureEmail(email, "Phone number already in use", platform);
        throw new BadRequest("Phone number already in use", AppErrorCode.PHONE_ALREADY_EXIST);
      }
    }

    const name = `${firstName} ${lastName}`;

    // Prepare user data
    const userData: Prisma.UserCreateInput = {
      id: uuid(),
      email,
      firstName,
      lastName,
      name,
      role: { connect: { id: selectedRoleId } }, // Connect to existing Role record
      address: address || null,
      phoneNumber: phoneNumber || null,
      isSocialAccount,
      emailVerified: isSocialAccount,
      createdAt: new Date(),
      password: null,
      socialAccountProvider: socialAccountProvider || null,
    };

    if (!isSocialAccount) {
      if (!password) {
        await sendFailureEmail(email, "Password is required for non-social accounts", platform);
        throw new BadRequest("Password is required for non-social accounts", AppErrorCode.INVALID_INPUT);
      }
      userData.password = await bcrypt.hash(password, 8);
      console.log(`Time after password hashing: ${Date.now() - startTime}ms`);
    }

    console.log("User data to create:", userData);

    // Create user, profile, wallet, and audit log
    const newUser = await prismaClient.$transaction(async (tx) => {
      const user = await tx.user.create({ data: userData });
      await createProfileForRole(selectedRoleId, user.id, tx);
      console.log("Creating wallet for user:", user.id);
      await tx.wallet.create({
        data: {
          id: uuid(),
          userId: user.id,
          balance: 0.0,
        },
      });

      // Log successful registration
      const contextRoleId = determineContextRoleId(selectedRoleId, platform);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "REGISTRATION_SUCCESS",
          entityType: "USER",
          entityId: user.id,
          details: {
            platform,
            contextRoleId,
            email,
            roleId: selectedRoleId,
            ip: req.ip,
          },
        },
      });

      return user;
    });
    console.log("New user created:", newUser, `Time after transaction: ${Date.now() - startTime}ms`);

    // Send OTP for non-social accounts
    let transactionReference: string | undefined;
    if (!isSocialAccount) {
      try {
        console.log("Attempting to send OTP to:", email);
        transactionReference = `REG_${newUser.id}_${Date.now()}`;
        const eventType = mapToEventType("otp_verification");
        if (eventType !== KnownEventTypes.OTP_VERIFICATION) {
          logger.error("Unexpected event type mapping", {
            input: "otp_verification",
            mapped: eventType,
            expected: KnownEventTypes.OTP_VERIFICATION,
          });
          throw new Error(
            `Invalid event type mapping: expected ${KnownEventTypes.OTP_VERIFICATION}, got ${eventType}`
          );
        }

        // Initialize EmailOtpService
        const emailOtpService = new EmailOtpService();

        // Send OTP email with registration success message
        await emailOtpService.generateAndSendOtp({
          userId: newUser.id,
          email,
          medium: ["EMAIL"],
          transactionReference,
          eventType,
          metadata: {
            userId: newUser.id,
            name: newUser.name || "User",
            roleId: selectedRoleId,
            platform,
            registrationSuccess: true,
          },
        });
        console.log(`Time after OTP sending: ${Date.now() - startTime}ms`);

        logger.info("OTP and registration success email sent", {
          userId: newUser.id,
          email,
          platform,
          eventType,
        });

        HttpResponse.success(
          res,
          { ...userResponse(newUser), transactionReference },
          "User registered successfully. Please check your email for OTP.",
          201
        );
      } catch (otpError: unknown) {
        const errorMessage: string = otpError instanceof Error ? otpError.message : "Unknown error";
        logger.error("OTP sending failed", {
          userId: newUser.id,
          email,
          error: errorMessage,
          platform,
          eventType: KnownEventTypes.OTP_VERIFICATION,
        });
        // Fallback to success email if OTP fails
        await sendSuccessEmail(newUser, platform, true);
        HttpResponse.success(
          res,
          { ...userResponse(newUser), transactionReference },
          "User registered successfully. OTP sending failed; please request verification manually.",
          201
        );
      }
    } else {
      // Send success email for social accounts
      await sendSuccessEmail(newUser, platform);
      logger.info("User registered successfully (social account)", {
        userId: newUser.id,
        email,
        roleId: selectedRoleId,
        contextRoleId: determineContextRoleId(selectedRoleId, platform),
        platform,
      });
      HttpResponse.success(
        res,
        userResponse(newUser),
        "User registered successfully.",
        201
      );
    }
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
    logger.error("Registration error", {
      email: req.body.email || "unknown",
      error: errorMessage,
      ip: req.ip,
      platform,
    });

    // Log failure in AuditLog
    await prismaClient.auditLog.create({
      data: {
        action: "REGISTRATION_FAILED",
        entityType: "USER",
        entityId: null,
        details: {
          platform,
          email: req.body.email || "unknown",
          error: errorMessage,
          ip: req.ip,
        },
      },
    });

    next(error);
  }
};

// Helper to determine contextRoleId
const determineContextRoleId = (roleId: string, platform: string): string => {
  if (platform === "app") {
    return roleId;
  }
  if (platform === "web") {
    return roleId;
  }
  return roleId;
};

// Helper to send success email
const sendSuccessEmail = async (user: any, platform: string, otpFailed: boolean = false): Promise<void> => {
  try {
    const contextRoleId = determineContextRoleId(user.roleId, platform);
    const isVendor = user.roleId === (await prismaClient.role.findFirst({ where: { name: "VENDOR" } }))?.id;
    const eventType = mapToEventType("registration success");
    if (eventType !== KnownEventTypes.REGISTRATION_SUCCESS) {
      logger.error("Invalid event type mapping", { input: "registration success", mapped: eventType });
      throw new Error("Invalid event type for registration success");
    }

    await emailTemplateService.sendEmail({
      eventType,
      userIds: [user.id],
      metadata: {
        userId: user.id,
        name: user.name || "User",
        email: user.email,
        roleId: user.roleId,
        contextRoleId,
        platform,
        isVendor,
        vendorDashboardUrl: isVendor ? "https://vendor.quicrefill.com" : undefined,
        isSocialAccount: user.isSocialAccount,
        otpFailed,
      },
    });
    logger.info("Registration success email sent", { userId: user.id, email: user.email, platform });
  } catch (emailError: unknown) {
    const errorMessage: string = emailError instanceof Error ? emailError.message : "Unknown error";
    logger.error("Failed to send registration success email", {
      userId: user.id,
      email: user.email,
      error: errorMessage,
      platform,
    });
  }
};

// Helper to send failure email
const sendFailureEmail = async (email: string, reason: string, platform: string): Promise<void> => {
  try {
    const eventType = mapToEventType("registration failed");
    if (eventType !== KnownEventTypes.REGISTRATION_FAILED) {
      logger.error("Invalid event type mapping", { input: "registration failed", mapped: eventType });
      throw new Error("Invalid event type for registration failed");
    }

    await emailTemplateService.sendEmail({
      eventType,
      userIds: [],
      metadata: {
        email,
        reason,
        platform,
      },
    });
    logger.info("Registration failure email sent", { email, reason, platform });
  } catch (emailError: unknown) {
    const errorMessage: string = emailError instanceof Error ? emailError.message : "Unknown error";
    logger.error("Failed to send registration failure email", { email, error: errorMessage, platform });
  }
};

// Helper to format user response
const userResponse = (user: any) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  name: user.name,
  roleId: user.roleId,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

// Helper to create profile for specific roles
const createProfileForRole = async (roleId: string, userId: string, tx: any): Promise<void> => {
  try {
    const role = await tx.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new Error(`Role with ID ${roleId} not found`);
    }

    const profileRoles = ["CUSTOMER", "ADMIN", "VENDOR", "DELIVERY_AGENT"];
    if (profileRoles.includes(role.name)) {
      const profileData = {
        id: uuid(),
        userId,
        roleId,
        ...(role.name === "VENDOR" || role.name === "DELIVERY_AGENT"
          ? { status: "PENDING", vehicleType: "Unknown" }
          : {}),
      };
      console.log("Creating profile for role:", role.name, "with data:", profileData);
      await tx.profile.create({ data: profileData });
      console.log("Profile created successfully for user:", userId);
    } else {
      console.log(`No profile creation needed for role ${role.name}`);
    }
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
    logger.error("Profile creation error", { userId, roleId, error: errorMessage });
    throw new Error(`Failed to create profile for role ${roleId}: ${errorMessage}`);
  }
};