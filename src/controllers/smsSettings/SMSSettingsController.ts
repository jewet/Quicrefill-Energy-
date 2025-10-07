import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { smsSettingsService } from "../../services/SMSSettingsService";
import { PrismaClient } from "@prisma/client"; // Removed unused Role import
import winston from "winston";

// Define interface for req.user based on AuthUser type from authentication.ts
interface AuthenticatedUser {
  id: string;
  email: string;
  role: string; // String to match Prisma enum usage
  contextRole?: string; // Optional, as per AuthUser
  isAdmin: boolean; // Added to match AuthUser requirement
}

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const prisma = new PrismaClient();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

interface UpdateSMSSettingsInput {
  enableNotifications?: boolean;
  senderId?: string;
  deliveryTimeStart?: string;
  deliveryTimeEnd?: string;
  smsProvider?: string;
  serviceType?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
}

export class SMSSettingsController {
  // Validation middleware for updating SMS settings
  static validateSMSSettings = [
    body("enableNotifications")
      .optional()
      .isBoolean()
      .withMessage("Enable notifications must be a boolean"),
    body("senderId")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 50 })
      .withMessage("Sender ID must be a non-empty string, max 50 characters"),
    body("deliveryTimeStart")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Delivery time start must be in HH:mm format"),
    body("deliveryTimeEnd")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Delivery time end must be in HH:mm format"),
    body("smsProvider")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("SMS provider must be a non-empty string"),
    body("serviceType")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Service type must be a non-empty string"),
    body("user")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("User must be a non-empty string"),
    body("password")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Password must be a non-empty string"),
    body("host")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Host must be a non-empty string"),
    body("port")
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage("Port must be an integer between 1 and 65535"),
  ];

  // Get SMS settings for admin dashboard or settings form
  async getSMSSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || user.role !== "ADMIN") {
        res.status(403).json({ message: "Access denied: Admin role required" });
        return;
      }

      // Fetch SMS settings with updatedByUser relation
      const settings = await prisma.sMSSettings.findFirst({
        include: {
          updatedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Use SMSSettingsService to ensure fallback to environment variables
      const smsSettings = await smsSettingsService.getSMSSettings();

      // Format response
      const response = {
        enableNotifications: smsSettings.enableNotifications,
        senderId: smsSettings.senderId,
        deliveryTimeStart: smsSettings.deliveryTimeStart,
        deliveryTimeEnd: smsSettings.deliveryTimeEnd,
        smsProvider: smsSettings.smsProvider,
        serviceType: smsSettings.serviceType,
        user: smsSettings.user,
        password: "********", // Mask password for security
        host: smsSettings.host,
        port: smsSettings.port,
        lastUpdated: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
        updatedBy: settings?.updatedByUser
          ? {
              id: settings.updatedByUser.id,
              name: `${settings.updatedByUser.firstName} ${settings.updatedByUser.lastName}`,
              email: settings.updatedByUser.email,
            }
          : null,
      };

      logger.info("SMS settings retrieved", { userId: user.id });
      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve SMS settings", {
        error: errorMessage,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  // Update SMS settings (admin only)
  async updateSMSSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const user = req.user;
      if (!user || user.role !== "ADMIN") {
        res.status(403).json({ message: "Access denied: Admin role required" });
        return;
      }

      const data: UpdateSMSSettingsInput = req.body;
      const updatedSettings = await smsSettingsService.updateSMSSettings(data, user.id);

      // Fetch updated settings with updatedByUser for response
      const settings = await prisma.sMSSettings.findFirst({
        include: {
          updatedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      logger.info("SMS settings updated", {
        updatedBy: user.id,
        smsProvider: updatedSettings.smsProvider,
      });
      res.status(200).json({
        enableNotifications: updatedSettings.enableNotifications,
        senderId: updatedSettings.senderId,
        deliveryTimeStart: updatedSettings.deliveryTimeStart,
        deliveryTimeEnd: updatedSettings.deliveryTimeEnd,
        smsProvider: updatedSettings.smsProvider,
        serviceType: updatedSettings.serviceType,
        user: updatedSettings.user,
        password: "********", // Mask password
        host: updatedSettings.host,
        port: updatedSettings.port,
        lastUpdated: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
        updatedBy: settings?.updatedByUser
          ? {
              id: settings.updatedByUser.id,
              name: `${settings.updatedByUser.firstName} ${settings.updatedByUser.lastName}`,
              email: settings.updatedByUser.email,
            }
          : null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to update SMS settings", {
        error: errorMessage,
        userId: req.user?.id,
      });
      next(error);
    }
  }
}

export const smsSettingsController = new SMSSettingsController();