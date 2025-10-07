import { Worker, Queue, ConnectionOptions } from "bullmq";
import { getRedisClient } from "../config/redis";
import winston from "winston";
import { ENV } from "../config/env";

// Logger setup
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: `${ENV.LOG_DIR || "./logs"}/worker.log`,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

// Notification worker instance
let notificationWorker: Worker | null = null;

// Parse Redis URL to extract connection options
const getConnectionOptions = async (): Promise<ConnectionOptions> => {
  const redisUrl = ENV.REDIS_URL || "redis://:x7kPmN9qL2vR8tW5zY3jB6hA4eD0cF@localhost:6379";
  try {
    const url = new URL(redisUrl);
    const connection: ConnectionOptions = {
      host: url.hostname || "localhost",
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      enableTLSForSentinelMode: false,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error("Redis connection failed after maximum retries", { retries: times });
          return null; // Stop retrying
        }
        const delay = Math.min(300 * Math.pow(2, times), 5000);
        logger.warn(`Redis reconnect attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      connectTimeout: 5000,
      maxRetriesPerRequest: null, // Set to null to avoid BullMQ warning
    };

    // Verify Redis connection
    const redisClient = await getRedisClient();
    await redisClient.ping();
    logger.info("Redis connection verified for worker");
    return connection;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to parse Redis URL or connect", { error: err.message, stack: err.stack });
    throw err;
  }
};

// Start the notification worker
export const startNotificationWorker = async (): Promise<void> => {
  if (notificationWorker) {
    logger.info("Notification worker already running");
    return;
  }

  try {
    const connection = await getConnectionOptions();
    notificationWorker = new Worker(
      "notification-queue",
      async (job) => {
        logger.info(`Processing notification job ${job.id}`, { data: job.data });
        // Simulate notification processing
        await new Promise((resolve) => setTimeout(resolve, 50));
        logger.info(`Completed notification job ${job.id}`);
      },
      {
        connection,
        concurrency: ENV.NODE_ENV === "production" ? 500 : 100,
        limiter: {
          max: ENV.NODE_ENV === "production" ? 5000 : 1000,
          duration: 1000,
        },
      }
    );

    notificationWorker.on("completed", (job) => {
      logger.info(`Notification job ${job.id} completed`);
    });

    notificationWorker.on("failed", (job, err) => {
      logger.error(`Notification job ${job?.id} failed: ${err.message}`, { stack: err.stack });
    });

    logger.info("Notification worker started successfully");
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to start notification worker", { error: err.message, stack: err.stack });
    throw err;
  }
};

// Stop the notification worker
export const stopNotificationWorker = async (): Promise<void> => {
  if (notificationWorker) {
    try {
      await notificationWorker.close();
      logger.info("Notification worker stopped successfully");
      notificationWorker = null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to stop notification worker", { error: err.message, stack: err.stack });
      throw err;
    }
  }
};

// Add a job to the notification queue
export const addNotificationJob = async (data: any): Promise<void> => {
  try {
    const connection = await getConnectionOptions();
    const queue = new Queue("notification-queue", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
      },
    });
    await queue.add("notification", data);
    logger.info("Notification job added to queue", { data });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to add notification job", { error: err.message, stack: err.stack });
    throw err;
  }
};