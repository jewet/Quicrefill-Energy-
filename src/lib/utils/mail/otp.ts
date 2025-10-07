import { PrismaClient } from "@prisma/client"; // Removed unused Role import
import winston from "winston";
import { emailTemplateService } from "../../../services/email";
import { mapToEventType, KnownEventTypes, RoleEventApplicability } from "../../../utils/EventTypeDictionary";
import { getRedisClient } from "../../../config/redis";

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Winston Logger
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

// Interfaces for OTP Request and Verification
export interface OtpRequest {
  userId: string;
  email: string;
  medium: string[];
  transactionReference: string;
  eventType: string;
  metadata?: Record<string, any>;
}

export interface OtpVerification {
  id: string;
  userId: string;
  transactionReference: string;
  email: string;
  expiresAt: Date;
  verified: boolean;
  eventType: string | null;
  verifiedAt?: Date | null;
}

export class EmailOtpService {
  private readonly RATE_LIMIT_KEY = (email: string) => `otp_email_rate_limit:${email}`;
  private readonly RATE_LIMIT_TTL = 60;
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly MAX_ATTEMPTS = 3;

  async generateAndSendOtp(request: OtpRequest): Promise<OtpVerification> {
    const { userId, email, medium, transactionReference, eventType, metadata = {} } = request;

    try {
      // Validate medium
      if (!medium.includes("EMAIL") || medium.length !== 1) {
        throw new Error("Medium must be ['EMAIL'] for this service");
      }
      if (!email) {
        throw new Error("Email is required");
      }
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error("Invalid email format");
      }

      // Validate event type
      const mappedEventType = mapToEventType(eventType);
      const validEventTypes = [
        KnownEventTypes.ACCOUNT_VERIFICATION,
        KnownEventTypes.PHONE_VERIFICATION,
        KnownEventTypes.MIGRATION_VERIFICATION,
        KnownEventTypes.OTP_VERIFICATION,
        KnownEventTypes.PASSWORD_RESET,
        KnownEventTypes.ACCOUNT_DELETION_REQUEST,
      ];
      if (!validEventTypes.includes(mappedEventType as KnownEventTypes)) {
        throw new Error(`Invalid OTP event type: ${eventType} (mapped to ${mappedEventType})`);
      }

      // Rate limiting with Redis
      const redis = await getRedisClient();
      const rateLimitKey = this.RATE_LIMIT_KEY(email);
      const otpCount = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, this.RATE_LIMIT_TTL);
      if (otpCount > this.MAX_OTP_ATTEMPTS) {
        throw new Error("OTP generation rate limit exceeded for this email");
      }

      // Fetch user with role
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          roleId: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      if (!user) throw new Error("User not found");
      if (!user.name) throw new Error("User must have a name");
      if (!user.role) throw new Error("User role is not defined");

      // Validate role applicability
      const applicableRoles = RoleEventApplicability[mappedEventType as KnownEventTypes];
      if (!applicableRoles.includes(user.role.id)) {
        throw new Error(`Role ${user.role.name} is not applicable for ${mappedEventType}`);
      }

      // Generate OTP and expiration
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create OTP record
      const [_, otpRecord] = await prisma.$transaction([
        prisma.otp.deleteMany({
          where: { userId, email, verified: false, eventType: mappedEventType },
        }),
        prisma.otp.create({
          data: {
            userId,
            transactionReference,
            email,
            code: otpCode,
            medium,
            expiresAt,
            verified: false,
            attempts: 0,
            eventType: mappedEventType,
          },
        }),
      ]);

      logger.info("OTP record created", { otpId: otpRecord.id, transactionReference, userId, email, code: otpCode });

      // Validate email event type
      const otpEmailEventType = eventType;
      const mappedOtpEmailEventType = mapToEventType(otpEmailEventType);
      if (!validEventTypes.includes(mappedOtpEmailEventType as KnownEventTypes)) {
        throw new Error(`Invalid OTP email event type: ${otpEmailEventType} (mapped to ${mappedOtpEmailEventType})`);
      }

      // Send OTP email with role ID
      const payload = await emailTemplateService.sendOtpEmail({
        email,
        otpCode,
        eventType: otpEmailEventType,
        metadata: {
          userId,
          name: user.name,
          roleId: user.role.id, // Use role ID
          expiresAt: expiresAt.toLocaleString(),
          eventType: mappedEventType,
          ...metadata,
        },
      });

      logger.info("OTP email sent", { email, subject: payload.subject, eventType: otpEmailEventType, mappedEventType: mappedOtpEmailEventType });

      return {
        id: otpRecord.id,
        userId: otpRecord.userId,
        transactionReference: otpRecord.transactionReference,
        email: otpRecord.email || "",
        expiresAt: otpRecord.expiresAt,
        verified: otpRecord.verified,
        eventType: otpRecord.eventType,
        verifiedAt: otpRecord.verifiedAt,
      };
    } catch (error: unknown) {
      const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to generate and send OTP", {
        userId,
        transactionReference,
        eventType,
        email,
        error: errorMessage,
      });
      throw new Error(`Failed to generate OTP: ${errorMessage}`);
    }
  }

  async verifyOtp(transactionReference: string, code: string): Promise<OtpVerification> {
    try {
      logger.info("Attempting to verify OTP", { transactionReference, code });

      // Fetch OTP record
      const otpRecord = await prisma.otp.findUnique({
        where: { transactionReference },
        include: { user: true },
      });
      if (!otpRecord) {
        logger.warn("OTP record not found", { transactionReference });
        throw new Error("OTP not found");
      }
      logger.info("OTP record found", {
        otpId: otpRecord.id,
        userId: otpRecord.userId,
        email: otpRecord.email,
        expiresAt: otpRecord.expiresAt,
        verified: otpRecord.verified,
        attempts: otpRecord.attempts,
      });

      // Check if OTP is already verified
      if (otpRecord.verified) {
        logger.warn("OTP already verified", { transactionReference });
        throw new Error("OTP already verified");
      }

      // Check if OTP is expired
      if (otpRecord.expiresAt < new Date()) {
        logger.warn("OTP expired", { transactionReference, expiresAt: otpRecord.expiresAt });
        throw new Error("OTP expired");
      }

      // Check attempt limit
      if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
        logger.warn("Maximum OTP verification attempts exceeded", { transactionReference });
        throw new Error("Maximum OTP verification attempts exceeded");
      }

      // Validate OTP code
      if (otpRecord.code !== code) {
        await prisma.otp.update({
          where: { transactionReference },
          data: { attempts: otpRecord.attempts + 1 },
        });
        logger.warn("Invalid OTP code", { transactionReference, attempts: otpRecord.attempts + 1 });
        throw new Error("Invalid OTP code");
      }

      // Update OTP record as verified
      const updatedOtpRecord = await prisma.otp.update({
        where: { transactionReference },
        data: {
          verified: true,
          attempts: otpRecord.attempts + 1,
          verifiedAt: new Date(),
        },
      });

      logger.info("OTP verified successfully", {
        otpId: updatedOtpRecord.id,
        userId: updatedOtpRecord.userId,
        transactionReference,
      });

      return {
        id: updatedOtpRecord.id,
        userId: updatedOtpRecord.userId,
        transactionReference: updatedOtpRecord.transactionReference,
        email: updatedOtpRecord.email || "",
        expiresAt: updatedOtpRecord.expiresAt,
        verified: updatedOtpRecord.verified,
        eventType: updatedOtpRecord.eventType,
        verifiedAt: updatedOtpRecord.verifiedAt,
      };
    } catch (error: unknown) {
      const errorMessage: string = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to verify OTP", { transactionReference, error: errorMessage });
      throw new Error(`Failed to verify OTP: ${errorMessage}`);
    }
  }
}