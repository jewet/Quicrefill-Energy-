import { Request, Response, NextFunction } from "express";
import { fraudDetectionService, FraudCheckRequest, FraudAlertFilter } from "../../services/fraudDetectionService";
import Joi from "joi";
import winston from "winston";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

const fraudCheckSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "any.required": "User ID is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  type: Joi.string().required().messages({
    "any.required": "Transaction type is required",
  }),
  entityType: Joi.string().required().messages({
    "any.required": "Entity type is required",
  }),
  entityId: Joi.string().uuid().required().messages({
    "any.required": "Entity ID is required",
  }),
  vendorId: Joi.string().uuid().optional(),
});

const logFilterSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  vendorId: Joi.string().uuid().optional(),
  type: Joi.string().optional(),
  entityType: Joi.string().optional(),
  entityId: Joi.string().uuid().optional(),
  status: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export class FraudDetectionController {
  /**
   * Checks for suspicious activity in a transaction
   */
  async checkFraud(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        logger.warn("Unauthorized access attempt to checkFraud", { userId: "unknown" });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { error, value } = fraudCheckSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for checkFraud", { error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const fraudCheckRequest: FraudCheckRequest = value;
      await fraudDetectionService.checkForSuspiciousActivity(
        fraudCheckRequest.userId,
        fraudCheckRequest.amount,
        fraudCheckRequest.type,
        fraudCheckRequest.entityType,
        fraudCheckRequest.entityId,
        fraudCheckRequest.vendorId
      );

      logger.info("Fraud check passed", { userId: fraudCheckRequest.userId, type: fraudCheckRequest.type });
      res.status(200).json({ message: "No suspicious activity detected" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Fraud check failed", { error: errorMessage });
      res.status(400).json({ error: `Fraud check failed: ${errorMessage}` });
      next(error);
    }
  }

  /**
   * Retrieves fraud alerts with filters
   */
  async getFraudAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        logger.warn("Unauthorized access attempt to getFraudAlerts", { userId: "unknown" });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { error, value } = logFilterSchema.validate(req.query);
      if (error) {
        logger.warn("Validation failed for getFraudAlerts", { error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const filters: FraudAlertFilter = value;
      const alerts = await prisma.fraudAlert.findMany({
        where: {
          userId: filters.userId,
          vendorId: filters.vendorId,
          type: filters.type,
          entityType: filters.entityType,
          entityId: filters.entityId,
          status: filters.status,
          createdAt: {
            gte: filters.startDate ? new Date(filters.startDate) : undefined,
            lte: filters.endDate ? new Date(filters.endDate) : undefined,
          },
        },
        take: 100,
        skip: 0,
        orderBy: { createdAt: "desc" },
      });

      logger.info("Fraud alerts retrieved", { filter: filters, count: alerts.length });
      res.status(200).json({ alerts });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error retrieving fraud alerts", { error: errorMessage });
      res.status(500).json({ error: `Failed to retrieve fraud alerts: ${errorMessage}` });
      next(error);
    }
  }
}

export const fraudDetectionController = new FraudDetectionController();