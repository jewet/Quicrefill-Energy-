import { Request, Response, NextFunction } from "express";
import { PrismaClient, NotificationType } from "@prisma/client";
import { z } from "zod";
import {
  dispatchNotification,
  NotificationPayload,
} from "../../services/notificationServices";
import { KnownEventTypes } from "../../utils/EventTypeDictionary";

// Initialize Prisma client
const prisma = new PrismaClient();

// Helper function to fetch valid role IDs from the Role table
async function getValidRoleIds(): Promise<string[]> {
  const roles = await prisma.role.findMany({
    select: { id: true },
  });
  return roles.map((role) => role.id);
}

// Define the schema for request body validation using zod
const NotificationSchema = z.object({
  eventTypeName: z.enum([
    KnownEventTypes.NEW_ORDER,
    KnownEventTypes.ORDER_UPDATE,
    KnownEventTypes.ORDER_CONFIRMED,
    KnownEventTypes.ORDER_CANCELLED,
    KnownEventTypes.PASSWORD_CHANGE,
    KnownEventTypes.FEEDBACK_SUBMITTED,
    KnownEventTypes.PREFERENCE_UPDATE,
    KnownEventTypes.PROFILE_UPDATE,
    KnownEventTypes.WALLET_EVENT,
    KnownEventTypes.WALLET_TRANSACTION,
    KnownEventTypes.DISCOUNT,
    KnownEventTypes.PROMO_OFFER,
    KnownEventTypes.FLASH_SALE,
  ], {
    errorMap: () => ({ message: "Invalid event type" }),
  }),
  dynamicData: z.record(z.any()).default({}),
  userIds: z.array(z.string().uuid()).optional(), // Enforce UUID format for userIds
  roles: z.array(z.string().uuid()).optional(), // Validate role IDs as UUIDs
  notificationTypes: z.array(z.enum(Object.values(NotificationType) as [string, ...string[]])).optional(), // Optional: Allow specifying notificationTypes
});

// Schema for resending a notification
const ResendNotificationSchema = z.object({
  notificationId: z.string().uuid(),
});

// Schema for querying notification logs
const NotificationLogsSchema = z.object({
  userId: z.string().uuid().optional(),
  eventTypeName: z.enum(Object.values(KnownEventTypes) as [string, ...string[]]).optional(),
  channel: z.enum(["PUSH", "EMAIL", "SMS", "WEBHOOK"]).optional(),
  status: z.enum(["SENT", "FAILED"]).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

// Middleware to validate the request body
const validateNotificationPayload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = NotificationSchema.parse(req.body);
    if (parsed.roles && parsed.roles.length > 0) {
      const validRoleIds = await getValidRoleIds();
      const invalidRoles = parsed.roles.filter((roleId) => !validRoleIds.includes(roleId));
      if (invalidRoles.length > 0) {
        throw new z.ZodError([
          {
            code: "custom",
            path: ["roles"],
            message: `Invalid role IDs: ${invalidRoles.join(", ")}`,
          },
        ]);
      }
    }
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next({
        status: 400,
        message: "Invalid request payload",
        errors: error.errors,
      });
    } else {
      next(error);
    }
  }
};

// Middleware to validate resend notification request
const validateResendNotificationPayload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    ResendNotificationSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next({
        status: 400,
        message: "Invalid resend notification payload",
        errors: error.errors,
      });
    } else {
      next(error);
    }
  }
};

// Middleware to validate notification logs query
const validateNotificationLogsQuery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    NotificationLogsSchema.parse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10,
    });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next({
        status: 400,
        message: "Invalid notification logs query parameters",
        errors: error.errors,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Sends a notification based on the provided payload.
 * @param req - Express request object containing the notification payload
 * @param res - Express response object
 * @param next - Express next function for error handling
 */
const sendNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { eventTypeName, dynamicData, userIds, roles, notificationTypes } =
      NotificationSchema.parse(req.body) as NotificationPayload & { notificationTypes?: NotificationType[] };

    // Verify that userIds exist if provided
    if (userIds && userIds.length > 0) {
      const existingUsers = await prisma.user.count({
        where: { id: { in: userIds } },
      });
      if (existingUsers !== userIds.length) {
        res.status(400).json({
          status: "error",
          message: "One or more user IDs are invalid",
        });
        return;
      }
    }

    // If notificationTypes is provided, verify they are valid for the eventTypeName
    if (notificationTypes && notificationTypes.length > 0) {
      const expectedNotificationType = mapEventTypeToNotificationType(eventTypeName);
      if (!notificationTypes.includes(expectedNotificationType) && !notificationTypes.includes(NotificationType.ALL)) {
        res.status(400).json({
          status: "error",
          message: `Notification types must include ${expectedNotificationType} or ${NotificationType.ALL} for event ${eventTypeName}`,
        });
        return;
      }
    }

    // Trigger the notification dispatch
    await dispatchNotification(
      {
        eventTypeName,
        dynamicData,
        userIds,
        roles,
      },
      req,
      res
    );

    res.status(200).json({
      status: "success",
      message: `Notifications for event ${eventTypeName} dispatched successfully`,
    });
  } catch (error) {
    console.error(`Error dispatching notification: ${error}`);
    next({
      status: 500,
      message: "Failed to dispatch notifications",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Resends a notification based on a previous notification log.
 * @param req - Express request object containing the notification ID
 * @param res - Express response object
 * @param next - Express next function for error handling
 */
const resendNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notificationId } = ResendNotificationSchema.parse(req.body);

    // Fetch the notification log
    const notificationLog = await prisma.notificationLog.findUnique({
      where: { id: notificationId },
      include: { eventType: true },
    });

    if (!notificationLog) {
      res.status(404).json({
        status: "error",
        message: "Notification log not found",
      });
      return;
    }

    // Check if eventType is present
    if (!notificationLog.eventType) {
      res.status(400).json({
        status: "error",
        message: "Notification log has no associated event type",
      });
      return;
    }

    // Parse the payload from the log
    let payload: {
      eventType?: KnownEventTypes;
      email?: string;
      phoneNumber?: string;
      title?: string;
      body?: string;
      url?: string;
      dynamicData?: Record<string, any>;
    };

    if (typeof notificationLog.payload === "string") {
      payload = JSON.parse(notificationLog.payload);
    } else {
      res.status(400).json({
        status: "error",
        message: "Invalid notification payload format",
      });
      return;
    }

    // Verify eventType in payload
    if (!payload.eventType || !Object.values(KnownEventTypes).includes(payload.eventType)) {
      res.status(400).json({
        status: "error",
        message: "Invalid or missing event type in notification payload",
      });
      return;
    }

    // Reconstruct the notification payload
    const notificationPayload: NotificationPayload = {
      eventTypeName: notificationLog.eventType.name as KnownEventTypes,
      dynamicData: payload.dynamicData || {},
      userIds: notificationLog.userId ? [notificationLog.userId] : undefined,
    };

    // Trigger the notification dispatch
    await dispatchNotification(notificationPayload, req, res);

    res.status(200).json({
      status: "success",
      message: `Notification ${notificationId} resent successfully`,
    });
  } catch (error) {
    console.error(`Error resending notification: ${error}`);
    next({
      status: 500,
      message: "Failed to resend notification",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Retrieves notification logs based on query parameters.
 * @param req - Express request object with query parameters
 * @param res - Express response object
 * @param next - Express next function for error handling
 */
const getNotificationLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, eventTypeName, channel, status, page, pageSize } = NotificationLogsSchema.parse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10,
    });

    const where = {
      ...(userId && { userId }),
      ...(eventTypeName && { eventType: { name: eventTypeName } }),
      ...(channel && { channel }),
      ...(status && { status }),
    };

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        include: { eventType: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notificationLog.count({ where }),
    ]);

    res.status(200).json({
      status: "success",
      data: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        eventType: log.eventType ? log.eventType.name : null,
        channel: log.channel,
        status: log.status,
        payload: typeof log.payload === "string" ? JSON.parse(log.payload) : null,
        message: log.message,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error(`Error fetching notification logs: ${error}`);
    next({
      status: 500,
      message: "Failed to fetch notification logs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Helper function to map eventTypeName to NotificationType
function mapEventTypeToNotificationType(eventType: KnownEventTypes): NotificationType {
  switch (eventType) {
    case KnownEventTypes.NEW_ORDER:
    case KnownEventTypes.ORDER_UPDATE:
    case KnownEventTypes.ORDER_CONFIRMED:
      return NotificationType.NEW_ORDER;
    case KnownEventTypes.ORDER_CANCELLED:
      return NotificationType.ORDER_CANCELLED;
    case KnownEventTypes.PASSWORD_CHANGE:
      return NotificationType.PASSWORD_CHANGE;
    case KnownEventTypes.FEEDBACK_SUBMITTED:
      return NotificationType.FEEDBACK_SUBMITTED;
    case KnownEventTypes.PREFERENCE_UPDATE:
    case KnownEventTypes.PROFILE_UPDATE:
      return NotificationType.PREFERENCE_UPDATE;
    case KnownEventTypes.WALLET_EVENT:
    case KnownEventTypes.WALLET_TRANSACTION:
      return NotificationType.WALLET_EVENT;
    case KnownEventTypes.DISCOUNT:
    case KnownEventTypes.PROMO_OFFER:
    case KnownEventTypes.FLASH_SALE:
      return NotificationType.DISCOUNT;
    default:
      return NotificationType.ALL;
  }
}

// Create notificationController object
const notificationController = {
  sendNotification,
  resendNotification,
  getNotificationLogs,
  validateNotificationPayload,
  validateResendNotificationPayload,
  validateNotificationLogsQuery,
};

// Export the controller and middleware
export { notificationController, validateNotificationPayload, validateResendNotificationPayload, validateNotificationLogsQuery };