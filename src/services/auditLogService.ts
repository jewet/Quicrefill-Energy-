// auditLogService.ts
import { PrismaClient, Prisma } from "@prisma/client";
import winston from "winston";

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

export interface AuditLogRequest {
  userId: string | null; // Allow null to match Prisma schema
  action: string;
  details: Record<string, any>;
  entityType?: string;
  entityId?: string | undefined | null; // Allow null to fix ts(2322)
  notes?: string;
  investigationStatus?: string;
  investigatedBy?: string;
  investigatedAt?: Date;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  investigationStatus?: string;
  startDate?: string;
  endDate?: string;
}

export class AuditLogService {
  /**
   * Logs an audit event
   * @param request - Audit log request
   */
  async log(request: AuditLogRequest): Promise<void> {
    try {
      let { userId, action, details, entityType, entityId, notes, investigationStatus, investigatedBy, investigatedAt } = request;

      if (!action || !details) {
        throw new Error("Action and details are required");
      }

      // Handle system actions
      if (userId === "SYSTEM") {
        userId = null; // Set to null for system actions
      }

      // Validate userId if not null
      if (userId !== null) {
        // Validate userId as UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          throw new Error("Invalid userId format: must be a valid UUID");
        }
        // Verify user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          throw new Error(`User with ID ${userId} does not exist`);
        }
      }

      // Validate entityId as UUID if provided
      let validEntityId: string | null = null;
      if (entityId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(entityId)) {
          validEntityId = entityId;
        } else {
          logger.warn("Invalid entityId format, setting to null", { entityId, entityType });
        }
      }

      await prisma.auditLog.create({
        data: {
          userId, // Will be null for SYSTEM
          action,
          details: details as Prisma.InputJsonValue,
          entityType,
          entityId: validEntityId, // Use validated UUID or null
          notes,
          investigationStatus,
          investigatedBy,
          investigatedAt,
        },
      });

      logger.info("Audit log created", { userId, action, entityType, entityId: validEntityId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating audit log", { error: errorMessage, request: JSON.stringify(request) });
      throw new Error(`Failed to create audit log: ${errorMessage}`);
    }
  }

  // getLogs method remains unchanged
  async getLogs(filters: AuditLogFilter): Promise<any[]> {
    try {
      const whereClause: Prisma.AuditLogWhereInput = {
        userId: filters.userId,
        action: filters.action,
        entityType: filters.entityType,
        entityId: filters.entityId,
        investigationStatus: filters.investigationStatus,
        createdAt: {
          gte: filters.startDate ? new Date(filters.startDate) : undefined,
          lte: filters.endDate ? new Date(filters.endDate) : undefined,
        },
      };

      Object.keys(whereClause).forEach((key) => {
        if (whereClause[key as keyof typeof whereClause] === undefined) {
          delete whereClause[key as keyof typeof whereClause];
        }
      });

      const logs = await prisma.auditLog.findMany({
        where: whereClause,
        take: 100,
        skip: 0,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true } },
          order: { select: { id: true } },
        },
      });

      logger.info("Audit logs retrieved", { filters, count: logs.length });
      return logs;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error retrieving audit logs", { error: errorMessage, filters });
      throw new Error(`Failed to retrieve audit logs: ${errorMessage}`);
    }
  }
}

export const auditLogService = new AuditLogService();