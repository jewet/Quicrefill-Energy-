import { PrismaClient, Role } from "@prisma/client";
import { smsTemplateService } from "./SMSTemplateService";
import { emailTemplateService } from "./email";
import crypto from "crypto";
import winston from "winston";

const prisma = new PrismaClient();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "info" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

// Define interfaces for request and response models
interface CreateOtpRequest {
  phoneNumber?: string;
  email?: string;
  medium?: string[];
}

interface ValidateOtpRequest {
  transactionReference: string;
  otp: string;
}

interface OtpVerification {
  id: string;
  userId: string;
  transactionReference: string;
  phoneNumber: string;
  email: string;
  expiresAt: Date; // Changed from DateTime to Date
  verified: boolean;
}

export class OtpService {
  static async createOtp(
    userId: string,
    { phoneNumber, email, medium = ["sms"] }: CreateOtpRequest
  ): Promise<OtpVerification> {
    try {
      // Explicitly type the user object to include Role
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          role: true,
        },
      });
      if (!user) throw new Error("User not found");
      if (!user.name) throw new Error("User must have a name");

      // Handle the case where user.role might be null
      const userRole: Role | null = user.role;
      if (!userRole) {
        throw new Error("User role is required for OTP creation");
      }

      const validMediums = ["sms", "email", "whatsapp"];
      if (!medium.every((m) => validMediums.includes(m))) {
        throw new Error("Medium must be an array containing 'sms', 'email', or 'whatsapp'");
      }
      if (medium.includes("sms") && !phoneNumber) {
        throw new Error("Phone number is required for SMS medium");
      }
      if (medium.includes("email") && !email && !user.email) {
        throw new Error("Email is required for email medium");
      }
      if (phoneNumber && !phoneNumber.match(/^(\+?\d{10,15})$/)) {
        logger.error("Invalid phone number format", { phoneNumber });
        throw new Error(
          "Phone number must be 10-15 digits, with or without + prefix (e.g., +2349069284815 or 2349069284815)"
        );
      }
      if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        logger.error("Invalid email format", { email });
        throw new Error("Invalid email format");
      }

      // Normalize phone number
      const normalizedPhoneNumber = phoneNumber?.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
      const normalizedEmail = email || user.email;

      // Generate OTP
      const otpCode = crypto.randomInt(1000000, 9999999).toString(); // 7-digit OTP
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
      const transactionReference = crypto.randomBytes(16).toString("hex");

      // Check for existing unverified OTP and delete if present
      const existingOtp = await prisma.otp.findFirst({
        where: {
          userId,
          OR: [{ phoneNumber: normalizedPhoneNumber }, { email: normalizedEmail }],
          verified: false,
        },
      });
      if (existingOtp) {
        await prisma.otp.delete({ where: { id: existingOtp.id } });
        logger.info("Deleted stale OTP", { otpId: existingOtp.id });
      }

      // Create OTP record
      const otpRecord = await prisma.otp.create({
        data: {
          userId,
          transactionReference,
          phoneNumber: normalizedPhoneNumber,
          email: normalizedEmail,
          code: otpCode,
          medium,
          expiresAt,
          verified: false,
        },
      });

      // Use role name instead of the full Role object
      const roleName = userRole.name;

      // Send OTP via requested mediums
      if (medium.includes("sms") && normalizedPhoneNumber) {
        await smsTemplateService.sendOtpSMS({
          phoneNumber: normalizedPhoneNumber,
          otpCode,
          eventType: "OTP_VERIFICATION",
          metadata: { userId, name: user.name, role: roleName },
        });
      }
      if (medium.includes("email") && normalizedEmail) {
        await emailTemplateService.sendOtpEmail({
          email: normalizedEmail,
          otpCode,
          eventType: "OTP_VERIFICATION",
          metadata: { userId, name: user.name, role: roleName },
        });
      }
      // TODO: Implement WhatsApp OTP delivery

      return {
        id: otpRecord.id,
        userId: otpRecord.userId,
        transactionReference: otpRecord.transactionReference,
        phoneNumber: otpRecord.phoneNumber || "",
        email: otpRecord.email || "",
        expiresAt: otpRecord.expiresAt,
        verified: otpRecord.verified,
      } as OtpVerification;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to create OTP", {
        userId,
        phoneNumber,
        email,
        error: errorMessage,
      });
      throw new Error(`Failed to send OTP: ${errorMessage}`);
    }
  }

  static async validateOtp({ transactionReference, otp }: ValidateOtpRequest): Promise<OtpVerification> {
    try {
      const otpRecord = await prisma.otp.findUnique({
        where: { transactionReference },
        include: { user: true },
      });
      if (!otpRecord) throw new Error("Invalid transaction reference");
      if (new Date() > otpRecord.expiresAt) throw new Error("OTP expired");
      if (otpRecord.verified) throw new Error("OTP already verified");
      if (otpRecord.code !== otp) throw new Error("Invalid OTP");

      const updatedOtpRecord = await prisma.otp.update({
        where: { transactionReference },
        data: {
          verified: true,
          updatedAt: new Date(),
          verifiedAt: new Date(), // Set verifiedAt field
        },
      });

      // Update user's phone number or email if verified
      await prisma.user.update({
        where: { id: otpRecord.userId },
        data: {
          phoneNumber: otpRecord.phoneNumber || undefined,
          email: otpRecord.email || undefined,
          phoneVerified: otpRecord.phoneNumber ? true : undefined,
          emailVerified: otpRecord.email ? true : undefined,
        },
      });

      logger.info("OTP validated", { transactionReference, userId: otpRecord.userId });
      return {
        id: updatedOtpRecord.id,
        userId: updatedOtpRecord.userId,
        transactionReference: updatedOtpRecord.transactionReference,
        phoneNumber: updatedOtpRecord.phoneNumber || "",
        email: updatedOtpRecord.email || "",
        expiresAt: updatedOtpRecord.expiresAt,
        verified: updatedOtpRecord.verified,
      } as OtpVerification;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to validate OTP", { transactionReference, error: errorMessage });
      throw new Error(`Failed to validate OTP: ${errorMessage}`);
    }
  }
}