import winston from "winston";
import fs from "fs";
import path from "path";

// Initialize log directory once
const logDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.resolve(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err: unknown) {
    console.error(`Failed to create log directory ${logDir}:`, err);
    throw new Error(`Cannot initialize logger: Log directory ${logDir} could not be created`);
  }
}

// Singleton logger instances by context
const loggerInstances: { [context: string]: winston.Logger } = {};

export const captureLogs = (logMessage: { message: string; error: string; stack: string; timestamp: string }) => {
  const logger = getLogger("ErrorCapture");
  logger.error("Captured error", logMessage);
};

export class Logger {
  private logger: winston.Logger;

  constructor(context: string) {
    if (loggerInstances[context]) {
      this.logger = loggerInstances[context];
      return;
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: "customer-service", context },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: path.join(logDir, "customer-service.log"),
          handleExceptions: true,
          handleRejections: true,
        }),
      ],
    });

    loggerInstances[context] = this.logger;
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }
}

// Function to get or create a logger instance for a specific context
export function getLogger(context: string): winston.Logger {
  if (!loggerInstances[context]) {
    new Logger(context);
  }
  return loggerInstances[context];
}

// Export a default logger instance for general use
export const logger = getLogger("Default");