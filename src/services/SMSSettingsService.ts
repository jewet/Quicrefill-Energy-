import { PrismaClient } from "@prisma/client";
import winston from "winston";

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

interface SMSSettings {
  enableNotifications: boolean;
  senderId: string;
  deliveryTimeStart: string;
  deliveryTimeEnd: string;
  smsProvider: string;
  serviceType: string;
  user: string;
  password: string;
  host: string;
  port: number;
}

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

export class SMSSettingsService {
  // Define default settings as a class-level constant
  private readonly defaultSettings: SMSSettings = {
    enableNotifications: process.env.SMS_NOTIFICATIONS_ENABLED === "true" || true,
    senderId: process.env.SMS_SENDER_ID || "Quicrefil",
    deliveryTimeStart: process.env.SMS_DELIVERY_TIME_START || "06:00",
    deliveryTimeEnd: process.env.SMS_DELIVERY_TIME_END || "18:00",
    smsProvider: process.env.SMS_PROVIDER || "Twilio",
    serviceType: process.env.SMS_SERVICE_TYPE || "API",
    user: process.env.SMS_USER || "admin",
    password: process.env.SMS_PASSWORD || "default_password",
    host: process.env.SMS_HOST || "api.twilio.com",
    port: parseInt(process.env.SMS_PORT || "443", 10),
  };

  // Get SMS settings, falling back to environment variables if necessary
  async getSMSSettings(): Promise<SMSSettings> {
    try {
      const settings = await prisma.sMSSettings.findFirst();

      if (!settings) {
        logger.info("No SMS settings found in database, using environment variables");
        return this.defaultSettings;
      }

      // Check if all required fields are present; if not, fall back to env vars
      const result: SMSSettings = {
        enableNotifications: settings.enableNotifications ?? this.defaultSettings.enableNotifications,
        senderId: settings.senderId || this.defaultSettings.senderId,
        deliveryTimeStart: settings.deliveryTimeStart || this.defaultSettings.deliveryTimeStart,
        deliveryTimeEnd: settings.deliveryTimeEnd || this.defaultSettings.deliveryTimeEnd,
        smsProvider: settings.smsProvider || this.defaultSettings.smsProvider,
        serviceType: settings.serviceType || this.defaultSettings.serviceType,
        user: settings.user || this.defaultSettings.user,
        password: settings.password || this.defaultSettings.password,
        host: settings.host || this.defaultSettings.host,
        port: settings.port || this.defaultSettings.port,
      };

      logger.info("Retrieved SMS settings", { smsProvider: result.smsProvider });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve SMS settings", { error: errorMessage });
      throw new Error(`Failed to retrieve SMS settings: ${errorMessage}`);
    }
  }

  // Update SMS settings (admin only)
  async updateSMSSettings(data: UpdateSMSSettingsInput, updatedBy: string): Promise<SMSSettings> {
    try {
      // Validate time format for deliveryTimeStart and deliveryTimeEnd
      if (data.deliveryTimeStart && !/^\d{2}:\d{2}$/.test(data.deliveryTimeStart)) {
        throw new Error("Invalid deliveryTimeStart format; use HH:mm");
      }
      if (data.deliveryTimeEnd && !/^\d{2}:\d{2}$/.test(data.deliveryTimeEnd)) {
        throw new Error("Invalid deliveryTimeEnd format; use HH:mm");
      }

      // Check if settings exist; if not, create a new record
      const existingSettings = await prisma.sMSSettings.findFirst();
      let updatedSettings;

      if (existingSettings) {
        updatedSettings = await prisma.sMSSettings.update({
          where: { id: existingSettings.id },
          data: {
            enableNotifications: data.enableNotifications,
            senderId: data.senderId,
            deliveryTimeStart: data.deliveryTimeStart,
            deliveryTimeEnd: data.deliveryTimeEnd,
            smsProvider: data.smsProvider,
            serviceType: data.serviceType,
            user: data.user,
            password: data.password,
            host: data.host,
            port: data.port,
            updatedBy,
            updatedAt: new Date(),
          },
        });
      } else {
        updatedSettings = await prisma.sMSSettings.create({
          data: {
            enableNotifications: data.enableNotifications ?? true,
            senderId: data.senderId,
            deliveryTimeStart: data.deliveryTimeStart,
            deliveryTimeEnd: data.deliveryTimeEnd,
            smsProvider: data.smsProvider,
            serviceType: data.serviceType,
            user: data.user,
            password: data.password,
            host: data.host,
            port: data.port,
            updatedBy,
            createdAt: new Date(),
          },
        });
      }

      logger.info("SMS settings updated", { updatedBy, smsProvider: updatedSettings.smsProvider });
      return {
        enableNotifications: updatedSettings.enableNotifications,
        senderId: updatedSettings.senderId || this.defaultSettings.senderId,
        deliveryTimeStart: updatedSettings.deliveryTimeStart || this.defaultSettings.deliveryTimeStart,
        deliveryTimeEnd: updatedSettings.deliveryTimeEnd || this.defaultSettings.deliveryTimeEnd,
        smsProvider: updatedSettings.smsProvider || this.defaultSettings.smsProvider,
        serviceType: updatedSettings.serviceType || this.defaultSettings.serviceType,
        user: updatedSettings.user || this.defaultSettings.user,
        password: updatedSettings.password || this.defaultSettings.password,
        host: updatedSettings.host || this.defaultSettings.host,
        port: updatedSettings.port || this.defaultSettings.port,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to update SMS settings", { error: errorMessage });
      throw new Error(`Failed to update SMS settings: ${errorMessage}`);
    }
  }
}

export const smsSettingsService = new SMSSettingsService();