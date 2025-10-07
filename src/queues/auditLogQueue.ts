// src/queues/auditLogQueue.ts
import Bull from "bull";
import { auditLogService, AuditLogRequest } from "../services/auditLogService";
import { logger } from "../utils/logger";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
};

const auditLogQueue = new Bull("audit-log-queue", {
  redis: redisConfig,
});

auditLogQueue.process(async (job: { data: AuditLogRequest }) => {
  try {
    await auditLogService.log(job.data);
  } catch (error: unknown) {
    logger.error("Failed to process audit log job", {
      error: error instanceof Error ? error.message : String(error),
      data: job.data,
    });
    throw error; // Let Bull handle retries
  }
});

auditLogQueue.on("error", (error) => {
  logger.error("Audit log queue error", {
    error: error.message,
    stack: error.stack,
  });
});

export async function addAuditLogJob(data: AuditLogRequest): Promise<void> {
  try {
    await auditLogQueue.add(data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  } catch (error: unknown) {
    logger.error("Failed to add audit log job", {
      error: error instanceof Error ? error.message : String(error),
      data,
    });
    throw error;
  }
}