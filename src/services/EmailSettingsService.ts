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

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;
  enableNotifications: boolean; // New
  deliveryTimeStart: string;   // New
  deliveryTimeEnd: string;     // New
}

interface UpdateEmailSettingsInput {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom?: string;
  enableNotifications?: boolean; // New
  deliveryTimeStart?: string;    // New
  deliveryTimeEnd?: string;      // New
}

export class EmailSettingsService {
  private readonly defaultSettings: EmailSettings = {
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
    smtpUser: process.env.SMTP_USER || "astralearnia@gmail.com",
    smtpPassword: process.env.SMTP_PASSWORD || "default_password",
    emailFrom: process.env.EMAIL_FROM || "astralearnia@gmail.com",
    enableNotifications: process.env.EMAIL_NOTIFICATIONS_ENABLED === "true" || true, // New
    deliveryTimeStart: process.env.EMAIL_DELIVERY_TIME_START || "06:00",           // New
    deliveryTimeEnd: process.env.EMAIL_DELIVERY_TIME_END || "18:00",               // New
  };

  // Get email settings, falling back to environment variables if necessary
  async getEmailSettings(): Promise<EmailSettings> {
    try {
      const settings = await prisma.emailSettings.findFirst();

      if (!settings) {
        logger.info("No email settings found in database, using environment variables");
        return this.defaultSettings;
      }

      // Check if all required fields are present; if not, fall back to env vars
      const result: EmailSettings = {
        smtpHost: settings.smtpHost || this.defaultSettings.smtpHost,
        smtpPort: settings.smtpPort || this.defaultSettings.smtpPort,
        smtpUser: settings.smtpUser || this.defaultSettings.smtpUser,
        smtpPassword: settings.smtpPassword || this.defaultSettings.smtpPassword,
        emailFrom: settings.emailFrom || this.defaultSettings.emailFrom,
        enableNotifications: settings.enableNotifications ?? this.defaultSettings.enableNotifications, // New
        deliveryTimeStart: settings.deliveryTimeStart || this.defaultSettings.deliveryTimeStart,      // New
        deliveryTimeEnd: settings.deliveryTimeEnd || this.defaultSettings.deliveryTimeEnd,            // New
      };

      logger.info("Retrieved email settings", { smtpHost: result.smtpHost });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve email settings", { error: errorMessage });
      throw new Error(`Failed to retrieve email settings: ${errorMessage}`);
    }
  }

  // Update email settings (admin only)
  async updateEmailSettings(data: UpdateEmailSettingsInput, updatedBy: string): Promise<EmailSettings> {
    try {
      // Validate time format for deliveryTimeStart and deliveryTimeEnd
      if (data.deliveryTimeStart && !/^\d{2}:\d{2}$/.test(data.deliveryTimeStart)) {
        throw new Error("Invalid deliveryTimeStart format; use HH:mm");
      }
      if (data.deliveryTimeEnd && !/^\d{2}:\d{2}$/.test(data.deliveryTimeEnd)) {
        throw new Error("Invalid deliveryTimeEnd format; use HH:mm");
      }

      // Check if settings exist; if not, create a new record
      const existingSettings = await prisma.emailSettings.findFirst();
      let updatedSettings;

      if (existingSettings) {
        updatedSettings = await prisma.emailSettings.update({
          where: { id: existingSettings.id },
          data: {
            smtpHost: data.smtpHost,
            smtpPort: data.smtpPort,
            smtpUser: data.smtpUser,
            smtpPassword: data.smtpPassword,
            emailFrom: data.emailFrom,
            enableNotifications: data.enableNotifications, // New
            deliveryTimeStart: data.deliveryTimeStart,     // New
            deliveryTimeEnd: data.deliveryTimeEnd,         // New
            updatedBy,
            updatedAt: new Date(),
          },
        });
      } else {
        updatedSettings = await prisma.emailSettings.create({
          data: {
            smtpHost: data.smtpHost,
            smtpPort: data.smtpPort,
            smtpUser: data.smtpUser,
            smtpPassword: data.smtpPassword,
            emailFrom: data.emailFrom,
            enableNotifications: data.enableNotifications ?? true, // New
            deliveryTimeStart: data.deliveryTimeStart,            // New
            deliveryTimeEnd: data.deliveryTimeEnd,                // New
            updatedBy,
            createdAt: new Date(),
          },
        });
      }

      logger.info("Email settings updated", { updatedBy, smtpHost: updatedSettings.smtpHost });
      return {
        smtpHost: updatedSettings.smtpHost || this.defaultSettings.smtpHost,
        smtpPort: updatedSettings.smtpPort || this.defaultSettings.smtpPort,
        smtpUser: updatedSettings.smtpUser || this.defaultSettings.smtpUser,
        smtpPassword: updatedSettings.smtpPassword || this.defaultSettings.smtpPassword,
        emailFrom: updatedSettings.emailFrom || this.defaultSettings.emailFrom,
        enableNotifications: updatedSettings.enableNotifications ?? this.defaultSettings.enableNotifications, // New
        deliveryTimeStart: updatedSettings.deliveryTimeStart || this.defaultSettings.deliveryTimeStart,      // New
        deliveryTimeEnd: updatedSettings.deliveryTimeEnd || this.defaultSettings.deliveryTimeEnd,            // New
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to update email settings", { error: errorMessage });
      throw new Error(`Failed to update email settings: ${errorMessage}`);
    }
  }
}

export const emailSettingsService = new EmailSettingsService();