import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { prismaClient } from "../../config/db"; // Import Prisma client
import { smsTemplateService, SMSTemplateRequest, BulkSMSRequest } from "../../services/SMSTemplateService";
import { SMSTemplate } from "../../models/messageModel";
import winston from "winston";

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

export class SMSTemplateController {
  // Validation middleware for creating/updating templates
  static validateTemplate = [
    body("name").isString().notEmpty().withMessage("Name is required"),
    body("content").isString().notEmpty().withMessage("Content is required"),
    body("roles")
      .optional()
      .isArray()
      .withMessage("Roles must be an array")
      .custom(async (roles: string[]) => {
        if (roles.length === 0) return true;
        const validRoles = await prismaClient.role.findMany({
          where: { id: { in: roles } },
          select: { id: true },
        });
        const validRoleIds = validRoles.map((role: { id: string }) => role.id);
        const invalidRoles = roles.filter((roleId: string) => !validRoleIds.includes(roleId));
        if (invalidRoles.length > 0) {
          throw new Error(`Invalid roles: ${invalidRoles.join(", ")}`);
        }
        return true;
      }),
    body("eventTypeId").optional().isString().withMessage("EventTypeId must be a string"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ];

  // Validation middleware for sending OTP
  static validateOtpSMS = [
    body("phoneNumber").isString().notEmpty().withMessage("Phone number is required"),
    body("otpCode").isString().notEmpty().withMessage("OTP code is required"),
    body("eventType").optional().isString().withMessage("Event type must be a string"),
    body("metadata").optional().isObject().withMessage("Metadata must be an object"),
  ];

  // Validation middleware for sending bulk SMS
  static validateBulkSMS = [
    body("templateId").optional().isString().withMessage("Template ID must be a string"),
    body("eventType").optional().isString().withMessage("Event type must be a string"),
    body("roles")
      .optional()
      .isArray()
      .withMessage("Roles must be an array")
      .custom(async (roles: string[]) => {
        if (roles.length === 0) return true;
        const validRoles = await prismaClient.role.findMany({
          where: { id: { in: roles } },
          select: { id: true },
        });
        const validRoleIds = validRoles.map((role: { id: string }) => role.id);
        const invalidRoles = roles.filter((roleId: string) => !validRoleIds.includes(roleId));
        if (invalidRoles.length > 0) {
          throw new Error(`Invalid roles: ${invalidRoles.join(", ")}`);
        }
        return true;
      }),
    body("customPayload").optional().isObject().withMessage("Custom payload must be an object"),
    body("customPayload.content").optional().isString().withMessage("Custom payload content must be a string"),
    body("customPayload.to")
      .optional()
      .custom((value: string | string[]) => {
        if (Array.isArray(value)) {
          return value.every((item) => typeof item === "string");
        }
        return typeof value === "string";
      })
      .withMessage("Custom payload 'to' must be a string or array of strings"),
    body("userIds").optional().isArray().withMessage("User IDs must be an array"),
    body("userIds.*").isString().withMessage("User ID must be a string"),
    body("metadata").optional().isObject().withMessage("Metadata must be an object"),
  ];

  // Create a new SMS template
  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const data: SMSTemplateRequest = req.body;
      const updatedBy = (req.user as any)?.userId || "system";
      const template = await smsTemplateService.createTemplate(data, updatedBy);
      logger.info("SMS template created via controller", { name: data.name, updatedBy });
      res.status(201).json(template);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to create SMS template via controller", { error: errorMessage });
      next(error);
    }
  }

  // Update an existing SMS template
  async updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const id = req.params.id;
      const data: Partial<SMSTemplateRequest> = req.body;
      const updatedBy = (req.user as any)?.userId || "system";
      const template = await smsTemplateService.updateTemplate(id, data, updatedBy);
      logger.info("SMS template updated via controller", { id, updatedBy });
      res.status(200).json(template);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to update SMS template via controller", { id: req.params.id, error: errorMessage });
      next(error);
    }
  }

  // Delete an SMS template
  async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const deletedBy = (req.user as any)?.userId || "system";
      await smsTemplateService.deleteTemplate(id, deletedBy);
      logger.info("SMS template deleted via controller", { id, deletedBy });
      res.status(204).send();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to delete SMS template via controller", { id: req.params.id, error: errorMessage });
      next(error);
    }
  }

  // Get all SMS templates
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates: SMSTemplate[] = await smsTemplateService.getTemplates();
      logger.info("SMS templates retrieved via controller", { count: templates.length });
      res.status(200).json(templates);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve SMS templates via controller", { error: errorMessage });
      next(error);
    }
  }

  // Get a single SMS template by ID
  async getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const template = await smsTemplateService.getById(id);
      if (!template) {
        res.status(404).json({ message: "Template not found" });
        return;
      }
      logger.info("SMS template retrieved via controller", { id });
      res.status(200).json(template);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve SMS template via controller", { id: req.params.id, error: errorMessage });
      next(error);
    }
  }

  // Send OTP SMS
  async sendOtpSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { phoneNumber, otpCode, eventType, metadata } = req.body;
      await smsTemplateService.sendOtpSMS({ phoneNumber, otpCode, eventType, metadata });
      logger.info("OTP SMS sent via controller", { phoneNumber, eventType });
      res.status(200).json({ message: "OTP SMS sent successfully" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to send OTP SMS via controller", { phoneNumber: req.body.phoneNumber, error: errorMessage });
      next(error);
    }
  }

  // Send bulk SMS
  async sendBulkSMS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const data: BulkSMSRequest = req.body;
      await smsTemplateService.sendSMS(data);
      logger.info("Bulk SMS sent via controller", { templateId: data.templateId, eventType: data.eventType });
      res.status(200).json({ message: "Bulk SMS sent successfully" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to send bulk SMS via controller", { error: errorMessage });
      next(error);
    }
  }
}

export const smsTemplateController = new SMSTemplateController();