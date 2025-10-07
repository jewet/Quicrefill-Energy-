import cron from "node-cron";
import winston from "winston";
import { prismaClient } from "../config/db";
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
      filename: `${ENV.LOG_DIR || "./logs"}/cron.log`,
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

// Cron job to clean up expired sessions
export const startCronJobs = () => {
  // Run every hour in production, every 10 minutes in development
  const schedule = ENV.NODE_ENV === "production" ? "0 * * * *" : "*/10 * * * *";

  cron.schedule(schedule, async () => {
    try {
      logger.info("Starting cron job: Clean expired sessions");

      // Check if the Session table exists
      const tableExists = await prismaClient.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Session'
      );`;

      if (!tableExists[0]?.exists) {
        logger.warn("Session table does not exist in the database. Skipping cleanup.");
        return;
      }

      // Delete expired sessions
      const deletedCount = await prismaClient.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      logger.info(`Expired sessions cleaned successfully. Deleted ${deletedCount.count} sessions.`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Cron job failed: Clean expired sessions", {
        error: err.message,
        stack: err.stack,
      });
    }
  });

  logger.info("Cron jobs started");
};