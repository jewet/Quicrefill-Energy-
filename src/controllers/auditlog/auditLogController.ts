import { Request, Response, NextFunction } from "express";
import { auditLogService, AuditLogRequest, AuditLogFilter } from "../../services/auditLogService";
import Joi from "joi";
import winston from "winston";

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


const auditLogSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "any.required": "User ID is required",
  }),
  action: Joi.string().required().messages({
    "any.required": "Action is required",
  }),
  details: Joi.object().required().messages({
    "any.required": "Details are required",
  }),
  entityType: Joi.string().optional(),
  entityId: Joi.string().uuid().optional(),
  notes: Joi.string().optional(),
  investigationStatus: Joi.string().optional(),
  investigatedBy: Joi.string().uuid().optional(),
});

const logFilterSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  action: Joi.string().optional(),
  entityType: Joi.string().optional(),
  entityId: Joi.string().uuid().optional(),
  investigationStatus: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
});

export class AuditLogController {
  /**
   * Creates an audit log entry
   */
  async createLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        logger.warn("Unauthorized access attempt to createLog", { userId: "unknown" });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { error, value } = auditLogSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for createLog", { error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const auditLogRequest: AuditLogRequest = value;
      await auditLogService.log(auditLogRequest);

      logger.info("Audit log created via API", { action: auditLogRequest.action });
      res.status(200).json({ message: "Audit log created successfully" });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating audit log", { error: errorMessage });
      res.status(500).json({ error: `Failed to create audit log: ${errorMessage}` });
      next(error);
    }
  }

  /**
   * Retrieves audit logs with filters
   */
  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        logger.warn("Unauthorized access attempt to getLogs", { userId: "unknown" });
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

  

      
      const { error, value } = logFilterSchema.validate(req.query);
      if (error) {
        logger.warn("Validation failed for getLogs", { error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const filters: AuditLogFilter = value;
      const logs = await auditLogService.getLogs(filters);

      logger.info("Audit logs retrieved", { filter: filters, count: logs.length });
      res.status(200).json({ logs });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error retrieving audit logs", { error: errorMessage });
      res.status(500).json({ error: `Failed to retrieve audit logs: ${errorMessage}` });
      next(error);
    }
  }
}

export default new AuditLogController();