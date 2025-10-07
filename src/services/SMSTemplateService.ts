import { PrismaClient } from "@prisma/client";
import winston from "winston";
import { getRedisClient } from "../config/redis";
import { mapToEventType, KnownEventTypes } from "../utils/EventTypeDictionary";
import { SMSTemplate, SMSTemplateRequest, BulkSMSRequest, Metadata } from "../models/messageModel";
import axios from "axios";

// Initialize Prisma client
const prisma = new PrismaClient();

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

// Interface for SMS configuration
interface SMSConfig {
  smsProvider: string;
  senderId: string;
  apiKey: string;
  apiUrl: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
}

// Fetch SMS settings from database with fallback to environment variables
const getSMSConfig = async (): Promise<SMSConfig> => {
  try {
    const smsSettings = await prisma.sMSSettings.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        smsProvider: true,
        senderId: true,
        user: true,
        password: true,
        host: true,
        port: true,
      },
    });

    if (
      smsSettings &&
      smsSettings.smsProvider &&
      smsSettings.senderId &&
      smsSettings.user &&
      smsSettings.password &&
      smsSettings.host
    ) {
      logger.info("Using SMS settings from database");
      return {
        smsProvider: smsSettings.smsProvider,
        senderId: smsSettings.senderId,
        apiKey: smsSettings.password,
        apiUrl: smsSettings.host,
        user: smsSettings.user,
        port: smsSettings.port ?? undefined,
      };
    } else {
      logger.warn("Incomplete or no SMS settings found in database, falling back to environment variables");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to fetch SMS settings from database", { error: errorMessage });
    logger.warn("Falling back to environment variables for SMS configuration");
  }

  const requiredVars = {
    FLUTTERWAVE_SENDER_ID: process.env.FLUTTERWAVE_SENDER_ID,
    FLUTTERWAVE_API_KEY: process.env.FLUTTERWAVE_API_KEY,
  };
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      logger.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    smsProvider: "Flutterwave",
    senderId: process.env.FLUTTERWAVE_SENDER_ID!,
    apiKey: process.env.FLUTTERWAVE_API_KEY!,
    apiUrl: "https://api.flutterwave.com/v3/sms",
  };
};

// Flutterwave SMS client
const flutterwaveSMS = {
  async sendSMS({ to, message }: { to: string; message: string }) {
    const config = await getSMSConfig();
    try {
      const response = await axios.post(
        config.apiUrl,
        {
          to,
          message,
          from: config.senderId,
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.status === "success") {
        logger.info("SMS sent via provider", { to, provider: config.smsProvider });
        return { status: "success" };
      } else {
        throw new Error(response.data.message || `${config.smsProvider} SMS failed`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Failed to send SMS via ${config.smsProvider}`, { to, error: errorMessage });
      throw new Error(`${config.smsProvider} SMS failed: ${errorMessage}`);
    }
  },
};

const defaultSMSTemplate: SMSTemplate = {
  id: "default",
  name: "Default SMS",
  content: "You have a notification: {message}",
  roles: [],
  eventTypeId: null,
  updatedBy: "system",
  updatedAt: new Date(),
  isActive: true,
};

// Export SMSTemplateRequest and BulkSMSRequest for use in SMSTemplateController
export { SMSTemplateRequest, BulkSMSRequest };

export class SMSTemplateService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly ALL_TEMPLATES_CACHE_KEY = "sms_templates";
  private readonly TEMPLATE_CACHE_KEY = (id: string) => `sms_template:${id}`;
  private readonly RATE_LIMIT_KEY = (id: string) => `sms_rate_limit:${id}`;
  private readonly AUDIT_QUEUE_KEY = "audit:queue";

  // Ensure EventType exists or create it
  private async ensureEventType(name: string, createdBy: string): Promise<string> {
    try {
      const mappedEventType = mapToEventType(name);
      let eventType = await prisma.eventType.findUnique({ where: { name: mappedEventType } });
      if (!eventType) {
        eventType = await prisma.eventType.create({
          data: {
            name: mappedEventType,
            createdBy,
            description: `Event type for ${mappedEventType}`,
          },
        });
        logger.info("EventType created", { name: mappedEventType, createdBy });
      }
      return eventType.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to ensure EventType", { name, error: errorMessage });
      throw new Error(`Failed to ensure EventType: ${errorMessage}`);
    }
  }

  async createTemplate(data: SMSTemplateRequest, updatedBy: string): Promise<SMSTemplate> {
    try {
      if (data.content.length > 160) {
        throw new Error("SMS content must not exceed 160 characters");
      }

      // Convert role IDs to Prisma relation format
      const rolesConnect = data.roles?.map((roleId) => ({ id: roleId })) || [];

      const template = await prisma.sMSTemplate.create({
        data: {
          name: data.name,
          content: data.content,
          roles: {
            connect: rolesConnect,
          },
          eventTypeId: data.eventTypeId ?? null,
          updatedBy,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        include: {
          roles: true, // Include roles in the response
        },
      });

      const redis = await getRedisClient();
      const auditDetails: Metadata = {
        templateData: JSON.stringify({
          name: data.name,
          content: data.content,
          roles: data.roles || [],
          eventTypeId: data.eventTypeId ?? null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        }),
      };
      await Promise.all([
        redis.del(this.ALL_TEMPLATES_CACHE_KEY),
        this.queueAuditLog(updatedBy, "CREATE_SMS_TEMPLATE", "SMS_TEMPLATE", template.id, auditDetails),
      ]);
      logger.info("SMS template created", { name: data.name, updatedBy });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to create SMS template", { name: data.name, error: errorMessage });
      throw new Error(`Failed to create template: ${errorMessage}`);
    }
  }

  async updateTemplate(id: string, data: Partial<SMSTemplateRequest>, updatedBy: string): Promise<SMSTemplate> {
    try {
      if (data.content && data.content.length > 160) {
        throw new Error("SMS content must not exceed 160 characters");
      }

      // Convert role IDs to Prisma relation format
      const rolesConnect = data.roles?.map((roleId) => ({ id: roleId })) || [];

      const template = await prisma.sMSTemplate.update({
        where: { id },
        data: {
          name: data.name,
          content: data.content,
          roles: data.roles ? { set: rolesConnect } : undefined, // Only update roles if provided
          eventTypeId: data.eventTypeId ?? null,
          updatedBy,
          isActive: data.isActive,
          updatedAt: new Date(),
        },
        include: {
          roles: true, // Include roles in the response
        },
      });

      const redis = await getRedisClient();
      const auditDetails: Metadata = {
        changesData: JSON.stringify({
          name: data.name ?? null,
          content: data.content ?? null,
          roles: data.roles ?? null,
          eventTypeId: data.eventTypeId ?? null,
          isActive: data.isActive ?? null,
        }),
      };
      await Promise.all([
        redis.del(this.ALL_TEMPLATES_CACHE_KEY),
        redis.del(this.TEMPLATE_CACHE_KEY(id)),
        this.queueAuditLog(updatedBy, "UPDATE_SMS_TEMPLATE", "SMS_TEMPLATE", id, auditDetails),
      ]);
      logger.info("SMS template updated", { id, updatedBy });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to update SMS template", { id, error: errorMessage });
      throw new Error(`Failed to update template: ${errorMessage}`);
    }
  }

  async deleteTemplate(id: string, deletedBy: string): Promise<void> {
    try {
      await prisma.sMSTemplate.delete({ where: { id } });
      const redis = await getRedisClient();
      await Promise.all([
        redis.del(this.ALL_TEMPLATES_CACHE_KEY),
        redis.del(this.TEMPLATE_CACHE_KEY(id)),
        this.queueAuditLog(deletedBy, "DELETE_SMS_TEMPLATE", "SMS_TEMPLATE", id, { deleted: true }),
      ]);
      logger.info("SMS template deleted", { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to delete SMS template", { id, error: errorMessage });
      throw new Error(`Failed to delete template: ${errorMessage}`);
    }
  }

  async getTemplates(): Promise<SMSTemplate[]> {
    try {
      const redis = await getRedisClient();
      const cachedTemplates = await redis.get(this.ALL_TEMPLATES_CACHE_KEY);
      if (cachedTemplates) {
        logger.info("SMS templates retrieved from cache", { cacheKey: this.ALL_TEMPLATES_CACHE_KEY });
        return JSON.parse(cachedTemplates);
      }
      const templates = await prisma.sMSTemplate.findMany({
        include: {
          roles: true, // Include roles in the response
        },
      });
      await redis.setEx(this.ALL_TEMPLATES_CACHE_KEY, this.CACHE_TTL, JSON.stringify(templates));
      logger.info("SMS templates retrieved", { count: templates.length });
      return templates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve SMS templates", { error: errorMessage });
      throw new Error(`Failed to retrieve templates: ${errorMessage}`);
    }
  }

  async getById(id: string): Promise<SMSTemplate | null> {
    try {
      const redis = await getRedisClient();
      const cacheKey = this.TEMPLATE_CACHE_KEY(id);
      const cachedTemplate = await redis.get(cacheKey);
      if (cachedTemplate) {
        logger.info("SMS template retrieved from cache", { id, cacheKey });
        return JSON.parse(cachedTemplate);
      }
      const template = await prisma.sMSTemplate.findUnique({
        where: { id },
        include: {
          roles: true, // Include roles in the response
        },
      });
      if (template) {
        await redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(template));
      }
      logger.info("SMS template retrieved", { id });
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve SMS template", { id, error: errorMessage });
      throw new Error(`Failed to retrieve template: ${errorMessage}`);
    }
  }

  async sendOtpSMS({
    phoneNumber,
    otpCode,
    eventType = "OTP_VERIFICATION",
    metadata = {},
  }: {
    phoneNumber: string;
    otpCode: string;
    eventType?: string;
    metadata?: Metadata;
  }): Promise<void> {
    try {
      const redis = await getRedisClient();
      const rateLimitKey = this.RATE_LIMIT_KEY(phoneNumber);
      const smsCount = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 60);
      if (smsCount > 5) {
        throw new Error("SMS sending rate limit exceeded for this phone number");
      }

      const normalizedPhoneNumber = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;
      if (!normalizedPhoneNumber.match(/^\+\d{10,15}$/)) {
        throw new Error("Invalid phone number format");
      }

      const mappedEventType = mapToEventType(eventType);
      if (mappedEventType !== KnownEventTypes.OTP_VERIFICATION) {
        throw new Error("Invalid event type for OTP verification");
      }

      const eventTypeId = await this.ensureEventType(mappedEventType, (metadata.userId as string) || "system");
      const template = await prisma.sMSTemplate.findFirst({
        where: { eventTypeId, isActive: true },
        include: { roles: true },
      });

      let content: string;
      if (template) {
        content = this.renderTemplate(template.content, metadata);
      } else {
        content = this.renderTemplate("Your OTP code is {otpCode}. It expires in 5 minutes.", {
          otpCode,
          ...metadata,
        });
      }

      await prisma.notificationLog.create({
        data: {
          userId: (metadata.userId as string) || null,
          type: "SMS",
          channel: "SMS",
          recipient: normalizedPhoneNumber,
          eventTypeId,
          status: "SENT",
          payload: JSON.stringify({
            templateId: template?.id || null,
            content,
            metadata,
          }),
        },
      });

      await flutterwaveSMS.sendSMS({ to: normalizedPhoneNumber, message: content });
      logger.info("OTP SMS sent", { phoneNumber: normalizedPhoneNumber, eventType });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const mappedEventType = mapToEventType(eventType);
      const eventTypeId = await this.ensureEventType(mappedEventType, (metadata.userId as string) || "system");
      await prisma.notificationLog.create({
        data: {
          userId: (metadata.userId as string) || null,
          type: "SMS",
          channel: "SMS",
          recipient: phoneNumber,
          eventTypeId,
          status: "FAILED",
          payload: JSON.stringify({
            templateId: null,
            error: errorMessage,
            metadata,
          }),
        },
      });
      logger.error("Failed to send OTP SMS", { phoneNumber, error: errorMessage });
      throw new Error(`Failed to send OTP SMS: ${errorMessage}`);
    }
  }

  async sendSMS({
    templateId,
    eventType,
    roles,
    customPayload,
    userIds,
    metadata = {},
  }: BulkSMSRequest): Promise<void> {
    let recipients: string[] = [];
    try {
      let content: string;
      const redis = await getRedisClient();
      const rateLimitIdentifier = templateId || customPayload?.to.toString() || "default";
      const rateLimitKey = this.RATE_LIMIT_KEY(rateLimitIdentifier);
      const smsCount = await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 60);
      if (smsCount > 10) {
        throw new Error("SMS sending rate limit exceeded");
      }

      if (userIds && userIds.length > 0) {
        recipients = await this.getPhoneNumbersByUserIds(userIds);
      } else if (roles && roles.length > 0) {
        recipients = await this.getPhoneNumbersByRoles(roles);
      } else if (customPayload) {
        recipients = Array.isArray(customPayload.to) ? customPayload.to : [customPayload.to];
      }
      if (!recipients.length) {
        throw new Error("No recipients found");
      }

      const validRecipients = await this.filterValidSMSRecipients(recipients);
      if (!validRecipients.length) {
        logger.info("No valid recipients after preference check", { recipients });
        return;
      }

      let eventTypeId: string | undefined;
      let mappedEventType: string = KnownEventTypes.OTHERS;
      if (eventType) {
        mappedEventType = mapToEventType(eventType);
        eventTypeId = await this.ensureEventType(mappedEventType, (metadata.userId as string) || "system");
      } else {
        eventTypeId = await this.ensureEventType(mappedEventType, (metadata.userId as string) || "system");
      }

      if (templateId) {
        const template = await prisma.sMSTemplate.findUnique({
          where: { id: templateId },
          include: { roles: true },
        });
        if (!template || !template.isActive) {
          throw new Error("Invalid or inactive template");
        }
        content = this.renderTemplate(template.content, metadata);
      } else if (eventType) {
        const template = await prisma.sMSTemplate.findFirst({
          where: { eventTypeId, isActive: true },
          include: { roles: true },
        });
        if (template) {
          content = this.renderTemplate(template.content, metadata);
        } else {
          content = this.renderTemplate(defaultSMSTemplate.content, {
            message: (metadata.message as string) || "You have a new notification.",
          });
        }
      } else if (customPayload) {
        content = customPayload.content;
      } else {
        throw new Error("Either templateId, eventType, or customPayload is required");
      }

      for (const recipient of validRecipients) {
        await flutterwaveSMS.sendSMS({ to: recipient, message: content });
        await prisma.notificationLog.create({
          data: {
            userId: userIds?.[0] || null,
            type: "SMS",
            channel: "SMS",
            recipient,
            eventTypeId,
            status: "SENT",
            payload: JSON.stringify({
              templateId: templateId || null,
              content,
              metadata,
            }),
          },
        });
      }
      logger.info("SMS sent", { recipients: validRecipients, content, eventType: mappedEventType });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const eventTypeId = await this.ensureEventType(KnownEventTypes.OTHERS, (metadata.userId as string) || "system");
      await prisma.notificationLog.create({
        data: {
          userId: userIds?.[0] || null,
          type: "SMS",
          channel: "SMS",
          recipient: recipients.join(",") || null,
          eventTypeId,
          status: "FAILED",
          payload: JSON.stringify({
            templateId: templateId || null,
            error: errorMessage,
            metadata,
          }),
        },
      });
      logger.error("Failed to send SMS", { error: errorMessage, recipients });
      throw new Error(`Failed to send SMS: ${errorMessage}`);
    }
  }

  private async getPhoneNumbersByRoles(roleIds: string[]): Promise<string[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          roleId: { in: roleIds },
        },
        select: { phoneNumber: true },
      });
      const phoneNumbers = users
        .map((u) => u.phoneNumber)
        .filter((phone): phone is string => Boolean(phone));
      logger.info("Phone numbers retrieved by roles", { roleIds, count: phoneNumbers.length });
      return phoneNumbers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve phone numbers by roles", { roleIds, error: errorMessage });
      throw new Error(`Failed to retrieve phone numbers: ${errorMessage}`);
    }
  }

  private async getPhoneNumbersByUserIds(userIds: string[]): Promise<string[]> {
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { phoneNumber: true },
      });
      const phoneNumbers = users
        .map((u) => u.phoneNumber)
        .filter((phone): phone is string => Boolean(phone));
      logger.info("Phone numbers retrieved by user IDs", { userIds, count: phoneNumbers.length });
      return phoneNumbers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve phone numbers by user IDs", { userIds, error: errorMessage });
      throw new Error(`Failed to retrieve phone numbers: ${errorMessage}`);
    }
  }

  private async filterValidSMSRecipients(phoneNumbers: string[]): Promise<string[]> {
    try {
      const users = await prisma.user.findMany({
        where: { phoneNumber: { in: phoneNumbers } },
        select: { phoneNumber: true, notificationsEnabled: true, notificationPreference: true },
      });
      return users
        .filter(
          (user) =>
            user.notificationsEnabled &&
            (!user.notificationPreference ||
              user.notificationPreference === "SMS" ||
              user.notificationPreference === "ALL")
        )
        .map((user) => user.phoneNumber)
        .filter((phone): phone is string => Boolean(phone));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to filter SMS recipients", { error: errorMessage });
      throw new Error(`Failed to filter recipients: ${errorMessage}`);
    }
  }

  private renderTemplate(template: string, data: Metadata): string {
    return template.replace(/{(\w+)}/g, (_, key) => {
      const value = data[key];
      return value !== undefined ? String(value) : "";
    });
  }

  private async queueAuditLog(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: Metadata
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const auditLog = {
        userId,
        action,
        entityType,
        entityId,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
      };
      await redis.lPush(this.AUDIT_QUEUE_KEY, JSON.stringify(auditLog));
      logger.info("Audit log queued", { action, entityType, entityId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to queue audit log", { action, entityType, entityId, error: errorMessage });
    }
  }
}

export const smsTemplateService = new SMSTemplateService();