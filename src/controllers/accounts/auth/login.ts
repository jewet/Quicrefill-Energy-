import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ErrorCodes } from "../../../errors/errorCodes";
import { prismaClient } from "../../../config/db";
import { UnauthorizedRequest } from "../../../exceptions/unauthorizedRequests";
import bcrypt from "bcryptjs";
import { generateTokenPair } from "../../../lib/utils/jwt/generateTokenPair";
import { storeAccessToken } from "../../../lib/storage/jwt_tokens";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";
import { KnownEventTypes, getApplicableRoles } from "../../../utils/EventTypeDictionary";
import { Role } from "@prisma/client";
import { addEmailJob, EmailJobData } from "../../../queues/emailQueue";
import { EmailOtpService } from "../../../lib/utils/mail/otp";
import { v4 as uuidv4 } from "uuid";
import { getAllRoles } from "./roles";

// Instantiate EmailOtpService
const emailOtpService = new EmailOtpService();

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

// Helper to determine contextRole
const determineContextRole = (role: Role, platform: string, migratedToVendor: boolean): string => {
  if (role.name === "VENDOR" && platform === "app" && migratedToVendor) {
    return "DELIVERY_AGENT";
  }
  if (role.name === "VENDOR" && platform === "web") {
    return "VENDOR";
  }
  return role.name;
};

// Role-specific onboarding email content
const getOnboardingEmailContent = (roleName: string, name: string | null, platform: string): string => {
  const baseContent = `<p>Dear ${name || "User"},</p>
                       <p>Welcome to Quicrefill! We're excited to have you on board.</p>`;
  const footer = `<p>Happy refilling!<br>Quicrefill Team</p>`;

  switch (roleName) {
    case "CUSTOMER":
      return `${baseContent}
              <p>Explore our wide range of services on the Quicrefill app or website. Download the app for a seamless experience!</p>
              ${footer}`;
    case "VENDOR":
      return `${baseContent}
              <p>Manage your business, track orders, and grow with Quicrefill. Access your Vendor Dashboard at <a href="https://vendor.quicrefill.com">vendor.quicrefill.com</a>.</p>
              <p>Use the mobile app for on-the-go tasks.</p>
              ${footer}`;
    case "DELIVERY_AGENT":
      return `${baseContent}
              <p>Start delivering services with Quicrefill! Use the mobile app to accept and complete delivery tasks efficiently.</p>
              <p>Upgrade to a Vendor account on the web dashboard for advanced features.</p>
              ${footer}`;
    case "ADMIN":
    case "MANAGER":
    case "SUPERVISOR":
    case "FINANCE_MANAGER":
      return `${baseContent}
              <p>Oversee operations and manage your team with Quicrefill's admin tools. Access the dashboard on the web for full control.</p>
              ${footer}`;
    case "STAFF":
    case "SERVICE_REP":
      return `${baseContent}
              <p>Support our customers and vendors with Quicrefill's tools. Use the app or web dashboard to perform your tasks.</p>
              ${footer}`;
    default:
      return `${baseContent}
              <p>Get started with Quicrefill by downloading our app or visiting our website.</p>
              ${footer}`;
  }
};

// Login success email content
const getLoginSuccessEmailContent = (name: string | null, platform: string, loginTime: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #333; text-align: center;">Quicrefill - Successful Login</h2>
      <p style="color: #333; font-size: 16px;">Dear ${name || "User"},</p>
      <p style="color: #333; font-size: 16px;">You have successfully logged in to your Quicrefill account on our <strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}</strong> platform at ${loginTime} (WAT).</p>
      <p style="color: #333; font-size: 16px;">If you did not initiate this login, please secure your account by resetting your password and contact our support team immediately at <a href="mailto:support@quicrefill.com" style="color: #007bff; text-decoration: none;">support@quicrefill.com</a>.</p>
      <p style="color: #333; font-size: 16px;">Thank you for choosing Quicrefill!</p>
      <p style="color: #333; font-size: 16px; margin-top: 20px;">Best regards,<br>The Quicrefill Team</p>
      <hr style="border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="color: #777; font-size: 12px; text-align: center;">Quicrefill, Inc. | <a href="https://www.quicrefill.com" style="color: #007bff; text-decoration: none;">www.quicrefill.com</a></p>
    </div>
  `;
};

// Email verification required email content
const getEmailVerificationRequiredEmailContent = (name: string | null): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #333; text-align: center;">Quicrefill - Email Verification Required</h2>
      <p style="color: #333; font-size: 16px;">Dear ${name || "User"},</p>
      <p style="color: #333; font-size: 16px;">Your email address has not been verified. To access your Quicrefill account, please request a verification OTP through the Quicrefill app or website.</p>
      <p style="color: #333; font-size: 16px;">Visit <a href="https://www.quicrefill.com/verify" style="color: #007bff; text-decoration: none;">quicrefill.com/verify</a> or use the app to request a new OTP and complete the verification process.</p>
      <p style="color: #333; font-size: 16px;">If you need assistance, please contact our support team at <a href="mailto:support@quicrefill.com" style="color: #007bff; text-decoration: none;">support@quicrefill.com</a>.</p>
      <p style="color: #333; font-size: 16px; margin-top: 20px;">Best regards,<br>The Quicrefill Team</p>
      <hr style="border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="color: #777; font-size: 12px; text-align: center;">Quicrefill, Inc. | <a href="https://www.quicrefill.com" style="color: #007bff; text-decoration: none;">www.quicrefill.com</a></p>
    </div>
  `;
};

export const LoginUserSchema = z.object({
  email: z.string().email({ message: "Invalid email format" }).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" })
    .optional(),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine((data) => data.email || data.phoneNumber, {
  message: "Either email or phoneNumber must be provided",
  path: ["email", "phoneNumber"],
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const start = Date.now();
    console.log("Login controller started:", req.body);
    logger.info(`Login request URL: ${req.url}, Query: ${JSON.stringify(req.query)}`);

    // Validate request body
    console.log("Validating request body...");
    const validatedData = await LoginUserSchema.parseAsync(req.body);
    let { email, phoneNumber, password } = validatedData;
    console.log("Validation passed:", { email, phoneNumber });

    // Normalize inputs
    if (email) email = email.toLowerCase();
    if (phoneNumber && !phoneNumber.startsWith("+")) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Query user by email or phoneNumber, including role and profile
    console.log("Querying user...");
    const queryStart = Date.now();
    const user = await prismaClient.user.findFirst({
      where: {
        OR: [
          email ? { email } : {},
          phoneNumber ? { phoneNumber } : {},
        ].filter(Boolean),
      },
      include: {
        role: true,
        profile: true,
      },
    });
    console.log(`User query took ${Date.now() - queryStart}ms`);
    console.log("User query result:", user ? "Found" : "Not found");

    if (!user) {
      return HttpResponse.error(res, {
        message: "Incorrect email/phone number or password",
        errorCode: ErrorCodes.USER_NOT_FOUND,
        statusCode: 401,
      });
    }

    // Ensure role is loaded
    if (!user.role) {
      return HttpResponse.error(res, {
        message: "User role not configured",
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    // Fetch bannable roles dynamically from Redis/database
    console.log("Fetching bannable roles...");
    const rolesFetchStart = Date.now();
    const roles = await getAllRoles();
    const bannableRoles = roles
      .filter((role) => ["CUSTOMER", "DELIVERY_AGENT", "VENDOR"].includes(role.name))
      .map((role) => role.name);
    console.log(`Roles fetch took ${Date.now() - rolesFetchStart}ms`);
    console.log("Bannable roles:", bannableRoles);

    // Check if user is banned for bannable roles
    if (bannableRoles.includes(user.role.name) && user.blocked) {
      return HttpResponse.error(res, {
        message: `Your account has been banned by admin. Reason: ${user.banReason || "Violation of terms"}`,
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    const platform = typeof req.query.platform === "string" ? req.query.platform.toLowerCase() : "app";

    // Check email verification for non-social accounts
    if (!user.isSocialAccount && !user.emailVerified) {
      // Check if the user's role is applicable for EMAIL_VERIFICATION_REQUIRED
      const applicableRoles = await getApplicableRoles(KnownEventTypes.EMAIL_VERIFICATION_REQUIRED);
      if (!applicableRoles.includes(user.role.name)) {
        logger.warn(`Role ${user.role.name} not applicable for EMAIL_VERIFICATION_REQUIRED event.`);
        return HttpResponse.error(res, {
          message: "Email verification required, but your role does not support this action.",
          errorCode: ErrorCodes.UNAUTHORIZED,
          statusCode: 401,
        });
      }

      return HttpResponse.error(res, {
        message: "Email verification required. Please request a verification OTP through the Quicrefill app or website at quicrefill.com/verify.",
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    // Check password for non-social accounts
    console.log("Checking password...");
    const passwordStart = Date.now();
    if (!user.isSocialAccount) {
      if (!password) {
        return HttpResponse.error(res, {
          message: "Provide a password to authenticate this account",
          errorCode: ErrorCodes.USER_NOT_FOUND,
          statusCode: 401,
        });
      }
      const passwordMatch = await bcrypt.compare(password, user.password || "");
      console.log(`Password verification took ${Date.now() - passwordStart}ms`);
      console.log("Password verification result:", passwordMatch ? "Success" : "Failure");
      if (!passwordMatch) {
        return HttpResponse.error(res, {
          message: "Incorrect email/phone number or password",
          errorCode: ErrorCodes.USER_NOT_FOUND,
          statusCode: 401,
        });
      }
    } else {
      return HttpResponse.error(res, {
        message: "Social account users must login via their provider",
        errorCode: ErrorCodes.USER_NOT_FOUND,
        statusCode: 401,
      });
    }

    const loginTime: string = new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" });
    console.log("Platform detected:", { platform, query: req.query });

    // For Vendor on web: if not migrated, require migration via OTP
    if (user.role.name === "VENDOR" && platform === "web" && !user.migratedToVendor) {
      console.log("Initiating OTP for VENDOR web access migration...");
      const otpStart = Date.now();
      const transactionReference = uuidv4();

      // Generate and send OTP using EmailOtpService
      await emailOtpService.generateAndSendOtp({
        userId: user.id,
        email: user.email,
        medium: ["EMAIL"],
        transactionReference,
        eventType: KnownEventTypes.MIGRATION_VERIFICATION,
        metadata: {
          platform,
          action: "vendor web migration",
        },
      });
      console.log(`OTP generation took ${Date.now() - otpStart}ms`);
      logger.info(`OTP generated`, { userId: user.id, transactionReference, email: user.email });

      // Update last login time
      await prismaClient.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Send response requiring OTP verification without generating tokens
      console.log(`Total login time: ${Date.now() - start}ms`);
      return HttpResponse.success(
        res,
        { requiresMigration: true, transactionReference },
        "Please verify OTP sent to your email to enable web access for your vendor account."
      );
    }

    // Update last login time
    await prismaClient.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Queue onboarding email for first login
    const isFirstLogin = !user.lastLoginAt;
    if (isFirstLogin) {
      const onboardingEmail: EmailJobData = {
        eventType: KnownEventTypes.USER_REGISTRATION,
        customPayload: {
          to: user.email,
          from: "noreply@quicrefill.com",
          subject: `Welcome to Quicrefill, ${user.name || "User"}!`,
          htmlContent: getOnboardingEmailContent(user.role.name, user.name, platform),
        },
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
          role: user.role.name,
          contextRole: determineContextRole(user.role, platform, user.migratedToVendor),
          platform,
        },
      };
      try {
        await addEmailJob(onboardingEmail);
        logger.info("Onboarding email queued", { email: user.email, role: user.role.name });
      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
        logger.error("Failed to queue onboarding email", { email: user.email, role: user.role.name, error: errorMessage });
      }
    }

    // Queue login success email (all roles, including ADMIN)
    const loginSuccessEmail: EmailJobData = {
      eventType: KnownEventTypes.LOGIN_SUCCESS,
      customPayload: {
        to: user.email,
        from: "noreply@quicrefill.com",
        subject: `Successful Login to Quicrefill`,
        htmlContent: getLoginSuccessEmailContent(user.name, platform, loginTime),
      },
      metadata: {
        userId: user.id,
        name: user.name || "User",
        email: user.email,
        role: user.role.name,
        contextRole: determineContextRole(user.role, platform, user.migratedToVendor),
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        loginTime,
      },
    };
    try {
      await addEmailJob(loginSuccessEmail);
      logger.info("Login success email queued", { email: user.email, role: user.role.name });
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      logger.error("Failed to queue login success email", { email: user.email, role: user.role.name, error: errorMessage });
    }

    // Generate token pair
    console.log("Generating token pair...");
    const tokenStart = Date.now();
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role.name,
      contextRole: determineContextRole(user.role, platform, user.migratedToVendor),
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
      return HttpResponse.error(res, {
        message: "Failed to store access token",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        statusCode: 500,
      });
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

    // Send response
    console.log(`Total login time: ${Date.now() - start}ms`);
    return HttpResponse.success(res, { token }, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    logger.error("Login error", { error: error instanceof Error ? error.message : "Unknown error" });
    if (error instanceof UnauthorizedRequest) {
      return HttpResponse.error(res, {
        message: error.message,
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }
    return HttpResponse.error(res, {
      message: error instanceof Error ? error.message : "Internal server error",
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
      statusCode: 500,
    });
  }
};

// verifyMigrationOTP remains unchanged
export const verifyMigrationOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(`Verify migration OTP request URL: ${req.url}, Query: ${JSON.stringify(req.query)}`);

    // Validate request body
    const VerifyMigrationOTPSchema = z.object({
      email: z.string().email({ message: "Invalid email format" }),
      transactionReference: z.string().uuid({ message: "Invalid transaction reference" }),
      otp: z.string().length(6, { message: "OTP must be 6 digits" }),
    });
    const { email, transactionReference, otp } = await VerifyMigrationOTPSchema.parseAsync(req.body);

    // Find user
    const user = await prismaClient.user.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        role: true,
        profile: true,
      },
    });

    if (!user || user.role?.name !== "VENDOR" || user.migratedToVendor) {
      return HttpResponse.error(res, {
        message: "User not eligible for vendor migration",
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    // Fetch bannable roles dynamically from Redis/database
    console.log("Fetching bannable roles...");
    const rolesFetchStart = Date.now();
    const roles = await getAllRoles();
    const bannableRoles = roles
      .filter((role) => ["CUSTOMER", "DELIVERY_AGENT", "VENDOR"].includes(role.name))
      .map((role) => role.name);
    console.log(`Roles fetch took ${Date.now() - rolesFetchStart}ms`);
    console.log("Bannable roles:", bannableRoles);

    // Check if user is banned
    if (bannableRoles.includes(user.role.name) && user.blocked) {
      return HttpResponse.error(res, {
        message: `Your account has been banned by admin. Reason: ${user.banReason || "Violation of terms"}`,
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    const platform = typeof req.query.platform === "string" ? req.query.platform.toLowerCase() : "app";

    // Check email verification
    if (!user.isSocialAccount && !user.emailVerified) {
      // Check if the user's role is applicable for EMAIL_VERIFICATION_REQUIRED
      const applicableRoles = await getApplicableRoles(KnownEventTypes.EMAIL_VERIFICATION_REQUIRED);
      if (!applicableRoles.includes(user.role.name)) {
        logger.warn(`Role ${user.role.name} not applicable for EMAIL_VERIFICATION_REQUIRED event.`);
        return HttpResponse.error(res, {
          message: "Email verification required, but your role does not support this action.",
          errorCode: ErrorCodes.UNAUTHORIZED,
          statusCode: 401,
        });
      }

      // Queue email verification reminder
      const emailVerificationEmail: EmailJobData = {
        eventType: KnownEventTypes.EMAIL_VERIFICATION_REQUIRED,
        customPayload: {
          to: user.email,
          from: "noreply@quicrefill.com",
          subject: "Quicrefill - Verify Your Email",
          htmlContent: getEmailVerificationRequiredEmailContent(user.name),
        },
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
          role: user.role.name,
          contextRole: user.role.name,
          platform,
        },
      };
      try {
        await addEmailJob(emailVerificationEmail);
        logger.info("Email verification reminder queued", { email: user.email, role: user.role.name });
      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
        logger.error("Failed to queue email verification reminder", { email: user.email, role: user.role.name, error: errorMessage });
      }

      return HttpResponse.error(res, {
        message: "Email verification required. Please request a verification OTP through the Quicrefill app or website at quicrefill.com/verify.",
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    // Verify OTP
    console.log("Verifying OTP...");
    const otpStart = Date.now();
    await emailOtpService.verifyOtp(transactionReference, otp);
    console.log(`OTP verification took ${Date.now() - otpStart}ms`);
    logger.info(`OTP verified for migration`, { userId: user.id, transactionReference, email });

    // Perform migration in a transaction
    console.log("Performing migration for user:", { userId: user.id, platform });
    const migrationStart = Date.now();
    await prismaClient.$transaction(async (tx) => {
      // Update User for web access
      await tx.user.update({
        where: { id: user.id },
        data: {
          migratedToVendor: true,
          migrationDate: new Date(),
          webAccessGranted: true,
          webAccessGrantedAt: new Date(),
        },
      });

      // Update Profile for web access
      if (user.profile) {
        await tx.profile.update({
          where: { id: user.profile.id },
          data: { isWebEnabled: true, webEnabledAt: new Date() },
        });
      }

      // Reassign Services if any (update from delivery agent to vendor)
      if (user.profile) {
        await tx.service.updateMany({
          where: { deliveryRepId: user.id },
          data: {
            providerId: user.profile.id,
            providerRole: "VENDOR",
            deliveryRepId: null,
          },
        });
      }

      // Log migration audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "MIGRATE_VENDOR_WEB_ACCESS",
          entityType: "USER",
          entityId: user.id,
          details: { role: "VENDOR", platform },
        },
      });
    });
    logger.info("VENDOR web access migrated", { userId: user.id });
    console.log(`Migration took ${Date.now() - migrationStart}ms`);

    // Generate token pair after migration
    console.log("Generating token pair...");
    const tokenStart = Date.now();
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role.name,
      contextRole: determineContextRole(user.role, platform, true),
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
      return HttpResponse.error(res, {
        message: "Failed to store access token",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        statusCode: 500,
      });
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

    // Queue vendor migration email
    const migrationEmail: EmailJobData = {
      eventType: KnownEventTypes.MIGRATION_VERIFICATION,
      customPayload: {
        to: user.email,
        from: "noreply@quicrefill.com",
        subject: "Your Quicrefill Vendor Dashboard is Ready!",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Quicrefill - Vendor Account Upgrade</h2>
            <p style="color: #333; font-size: 16px;">Dear ${user.name || "Vendor"},</p>
            <p style="color: #333; font-size: 16px;">Your account has been successfully upgraded for full web access!</p>
            <p style="color: #333; font-size: 16px;">Access your Vendor Dashboard at <a href="https://vendor.quicrefill.com" style="color: #007bff; text-decoration: none;">vendor.quicrefill.com</a> to manage multiple businesses, track orders, and assign riders.</p>
            <p style="color: #333; font-size: 16px;">On the mobile app, you can continue delivery tasks.</p>
            <p style="color: #333; font-size: 16px;">Contact our support team at <a href="mailto:support@quicrefill.com" style="color: #007bff; text-decoration: none;">support@quicrefill.com</a> for assistance.</p>
            <p style="color: #333; font-size: 16px; margin-top: 20px;">Best wishes,<br>The Quicrefill Team</p>
            <hr style="border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="color: #777; font-size: 12px; text-align: center;">Quicrefill, Inc. | <a href="https://www.quicrefill.com" style="color: #007bff; text-decoration: none;">www.quicrefill.com</a></p>
          </div>
        `,
      },
      metadata: {
        userId: user.id,
        name: user.name || "Vendor",
        email: user.email,
        role: user.role.name,
        contextRole: determineContextRole(user.role, platform, true),
        platform,
      },
    };

    try {
      console.log("Queuing migration email:", {
        to: migrationEmail.customPayload.to,
        subject: migrationEmail.customPayload.subject,
        eventType: migrationEmail.eventType,
      });
      await addEmailJob(migrationEmail);
      logger.info("Vendor migration email queued successfully", {
        email: user.email,
        userId: user.id,
        transactionReference,
      });
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      console.error("Failed to queue migration email:", errorMessage);
      logger.error("Failed to queue vendor migration email", {
        email: user.email,
        userId: user.id,
        transactionReference,
        error: errorMessage,
        stack: emailError instanceof Error ? emailError.stack : undefined,
      });
    }

    // Send response
    return HttpResponse.success(res, { token }, "Vendor web access completed successfully. You can now access the Vendor Dashboard.");
  } catch (error) {
    console.error("Verify migration OTP error:", error);
    logger.error("Verify migration OTP error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof UnauthorizedRequest) {
      return HttpResponse.error(res, {
        message: error.message,
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }
    return HttpResponse.error(res, {
      message: error instanceof Error ? error.message : "Internal server error",
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
      statusCode: 500,
    });
  }
};