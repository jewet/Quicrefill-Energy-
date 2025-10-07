import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { emailSettingsService } from "../../services/EmailSettingsService";
import { PrismaClient } from "@prisma/client";
import winston from "winston";

// Define interface for req.user to match AuthUser from authentication.ts
interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  contextRole?: string;
  isAdmin: boolean;
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

// Interface for input validation
interface UpdateEmailSettingsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom?: string;
  enableNotifications?: boolean;
  deliveryTimeStart?: string;
  deliveryTimeEnd?: string;
}

export class EmailSettingsController {
  // Validation middleware for updating email settings
  static validateEmailSettings = [
    body("smtpHost")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("SMTP host must be a non-empty string"),
    body("smtpPort")
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage("SMTP port must be an integer between 1 and 65535"),
    body("smtpUser")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("SMTP user must be a non-empty string"),
    body("smtpPassword")
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage("SMTP password must be a non-empty string"),
    body("emailFrom")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Email from must be a valid email address"),
    body("enableNotifications")
      .optional()
      .isBoolean()
      .withMessage("Enable notifications must be a boolean"),
    body("deliveryTimeStart")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Delivery time start must be in HH:mm format"),
    body("deliveryTimeEnd")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Delivery time end must be in HH:mm format"),
  ];

  // Get all email-related data for admin dashboard
  async getEmailDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.isAdmin) {
        res.status(403).json({ message: "Access denied: Admin role required" });
        return;
      }

      // Fetch email settings with updatedByUser relation
      const settings = await prisma.emailSettings.findFirst({
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

      // Use EmailSettingsService to ensure fallback to environment variables
      const emailSettings = await emailSettingsService.getEmailSettings();

      // Fetch total emails sent this month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);
      const totalEmailsSent = await prisma.notificationLog.count({
        where: {
          type: "EMAIL",
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      // Fetch daily success rate
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));
      const totalEmails = await prisma.notificationLog.count({
        where: {
          type: "EMAIL",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      const successfulEmails = await prisma.notificationLog.count({
        where: {
          type: "EMAIL",
          status: "SUCCESS",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      const successRate = totalEmails > 0 ? (successfulEmails / totalEmails) * 100 : 0;

      // Fetch email templates
      const templates = await prisma.emailTemplate.findMany({
        select: {
          id: true,
          name: true,
          htmlContent: true,
          isActive: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      // Format response for dashboard
      const response = {
        emailSettings: {
          serviceType: "SMTP",
          smtpHost: emailSettings.smtpHost,
          smtpPort: emailSettings.smtpPort,
          smtpUser: emailSettings.smtpUser,
          smtpPassword: "********",
          emailFrom: emailSettings.emailFrom,
          enableNotifications: emailSettings.enableNotifications,
          deliveryTimeStart: emailSettings.deliveryTimeStart,
          deliveryTimeEnd: emailSettings.deliveryTimeEnd,
          lastUpdated: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
          updatedBy: settings?.updatedByUser
            ? {
                id: settings.updatedByUser.id,
                name: `${settings.updatedByUser.firstName} ${settings.updatedByUser.lastName}`,
                email: settings.updatedByUser.email,
              }
            : null,
        },
        totalEmailsSent,
        successRate: successRate.toFixed(2),
        templates: templates.map((t) => ({
          messageId: t.id,
          templateName: t.name,
          content: t.htmlContent.substring(0, 50) + "...",
          status: t.isActive ? "Active" : "Inactive",
          provider: "SMTP",
          dateCreated: t.updatedAt.toISOString(),
        })),
      };

      logger.info("Email dashboard data retrieved", {
        userId: user.id,
        totalEmailsSent,
        successRate: successRate.toFixed(2),
      });
      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve email dashboard data", {
        error: errorMessage,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  // Get current email settings (for settings form)
  async getEmailSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.isAdmin) {
        res.status(403).json({ message: "Access denied: Admin role required" });
        return;
      }

      // Fetch email settings with updatedByUser relation
      const settings = await prisma.emailSettings.findFirst({
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

      // Use EmailSettingsService to ensure fallback to environment variables
      const emailSettings = await emailSettingsService.getEmailSettings();

      // Format response
      const response = {
        serviceType: "SMTP",
        smtpHost: emailSettings.smtpHost,
        smtpPort: emailSettings.smtpPort,
        smtpUser: emailSettings.smtpUser,
        smtpPassword: "********",
        emailFrom: emailSettings.emailFrom,
        enableNotifications: emailSettings.enableNotifications,
        deliveryTimeStart: emailSettings.deliveryTimeStart,
        deliveryTimeEnd: emailSettings.deliveryTimeEnd,
        lastUpdated: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
        updatedBy: settings?.updatedByUser
          ? {
              id: settings.updatedByUser.id,
              name: `${settings.updatedByUser.firstName} ${settings.updatedByUser.lastName}`,
              email: settings.updatedByUser.email,
            }
          : null,
      };

      logger.info("Email settings retrieved", { userId: user.id });
      res.status(200).json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve email settings", {
        error: errorMessage,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  // Update email settings (admin only)
  async updateEmailSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const user = req.user;
      if (!user || !user.isAdmin) {
        res.status(403).json({ message: "Access denied: Admin role required" });
        return;
      }

      const data: UpdateEmailSettingsInput = req.body;
      const updatedSettings = await emailSettingsService.updateEmailSettings(data, user.id);

      // Fetch updated settings with updatedByUser for response
      const settings = await prisma.emailSettings.findFirst({
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

      logger.info("Email settings updated", {
        updatedBy: user.id,
        smtpHost: updatedSettings.smtpHost,
      });
      res.status(200).json({
        serviceType: "SMTP",
        smtpHost: updatedSettings.smtpHost,
        smtpPort: updatedSettings.smtpPort,
        smtpUser: updatedSettings.smtpUser,
        smtpPassword: "********",
        emailFrom: updatedSettings.emailFrom,
        enableNotifications: updatedSettings.enableNotifications,
        deliveryTimeStart: updatedSettings.deliveryTimeStart,
        deliveryTimeEnd: updatedSettings.deliveryTimeEnd,
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
      logger.error("Failed to update email settings", {
        error: errorMessage,
        userId: req.user?.id,
      });
      next(error);
    }
  }
}

export const emailSettingsController = new EmailSettingsController();