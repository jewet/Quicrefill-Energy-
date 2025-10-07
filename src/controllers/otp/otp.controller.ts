import { Request, Response } from "express";
import { OtpService } from "../../services/otp.service";
import { HttpResponse } from "../../utils/http.util";
import { CreateOtpRequest, ValidateOtpRequest } from "../../models/otp.model";
import winston from "winston";

declare module "express" {
  interface Request {
    userId?: string;
  }
}

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

export class OtpController {
  static async createOtp(req: Request, res: Response) {
    const userId = req.userId;
    const { phoneNumber, email, medium } = req.body as Partial<CreateOtpRequest>;

    try {
      logger.info("createOtp Request", {
        userId,
        phoneNumber,
        email,
        medium,
        token: req.headers.authorization?.split(" ")[1]?.slice(0, 20) + "...",
      });

      if (!userId) {
        HttpResponse.error(res, "User not authenticated", 401);
        return;
      }
      if (!phoneNumber && !email) {
        HttpResponse.error(res, "Phone number or email is required", 400);
        return;
      }
      if (phoneNumber && !phoneNumber.match(/^(\+?\d{10,15})$/)) {
        logger.error("Invalid phone number format", { phoneNumber });
        HttpResponse.error(
          res,
          "Phone number must be 10-15 digits, with or without + prefix (e.g., +2349069284815 or 2349069284815)",
          400
        );
        return;
      }
      if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        logger.error("Invalid email format", { email });
        HttpResponse.error(res, "Invalid email format", 400);
        return;
      }

      const otpVerification = await OtpService.createOtp(userId, {
        phoneNumber: phoneNumber || "",
        email: email || "",
        medium: medium || ["sms"],
      });
      HttpResponse.success(
        res,
        {
          transactionReference: otpVerification.transactionReference,
          expiresAt: otpVerification.expiresAt,
        },
        "OTP sent successfully",
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send OTP";
      logger.error("createOtp Controller Error", {
        message,
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        phoneNumber,
        email,
        medium,
      });

      let statusCode = 500;
      if (message.includes("User not found") || message.includes("email and name")) {
        statusCode = 404;
      } else if (
        message.includes("Invalid phone number") ||
        message.includes("Invalid email") ||
        message.includes("Medium must be")
      ) {
        statusCode = 400;
      }
      HttpResponse.error(res, message, statusCode);
    }
  }

  static async validateOtp(req: Request, res: Response) {
    const { transactionReference, otp } = req.body as Partial<ValidateOtpRequest>;

    try {
      logger.info("validateOtp Request", { transactionReference });

      if (!transactionReference || typeof transactionReference !== "string" || transactionReference.trim() === "") {
        HttpResponse.error(res, "Valid transaction reference is required", 400);
        return;
      }
      if (!otp || typeof otp !== "string" || otp.trim() === "" || !/^\d{7}$/.test(otp)) {
        HttpResponse.error(res, "Valid 7-digit OTP is required", 400);
        return;
      }

      const otpVerification = await OtpService.validateOtp({ transactionReference, otp });
      HttpResponse.success(res, { verified: otpVerification.verified }, "OTP validated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to validate OTP";
      logger.error("validateOtp Controller Error", {
        message,
        stack: error instanceof Error ? error.stack : undefined,
        transactionReference,
      });

      let statusCode = 400;
      if (message.includes("Invalid transaction reference")) {
        statusCode = 404;
      } else if (
        message.includes("OTP expired") ||
        message.includes("OTP already verified") ||
        message.includes("Invalid OTP")
      ) {
        statusCode = 400;
      }
      HttpResponse.error(res, message, statusCode);
    }
  }
}