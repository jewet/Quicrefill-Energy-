import Bull from "bull";
import { emailTemplateService } from "../services/email";
import { logger } from "../utils/logger";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
};

export interface EmailJobData {
  eventType: string;
  customPayload: {
    to: string;
    from: string; // Now compatible with updated BulkEmailRequest
    subject: string;
    htmlContent: string;
  };
  metadata: {
    userId: string;
    name: string;
    email: string;
    role: string;
    contextRole: string;
    platform: string;
    loginTime?: string;
  };
}

const emailQueue = new Bull("email-queue", {
  redis: redisConfig,
});

emailQueue.process(async (job: { data: EmailJobData }) => {
  try {
    await emailTemplateService.sendEmail({
      eventType: job.data.eventType,
      customPayload: {
        to: job.data.customPayload.to,
        from: job.data.customPayload.from, // Pass the 'from' field
        subject: job.data.customPayload.subject,
        htmlContent: job.data.customPayload.htmlContent,
      },
      metadata: job.data.metadata,
    });
    logger.info("Email processed successfully", {
      eventType: job.data.eventType,
      email: job.data.customPayload.to,
      from: job.data.customPayload.from,
    });
  } catch (error: unknown) {
    logger.error("Failed to process email job", {
      error: error instanceof Error ? error.message : String(error),
      data: job.data,
    });
    throw error; // Let Bull handle retries
  }
});

emailQueue.on("error", (error) => {
  logger.error("Email queue error", {
    error: error.message,
    stack: error.stack,
  });
});

export async function addEmailJob(data: EmailJobData): Promise<void> {
  try {
    await emailQueue.add(data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
    logger.info("Email job added to queue", {
      eventType: data.eventType,
      email: data.customPayload.to,
      from: data.customPayload.from,
    });
  } catch (error: unknown) {
    logger.error("Failed to add email job", {
      error: error instanceof Error ? error.message : String(error),
      data,
    });
    throw error;
  }
}