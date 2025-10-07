import nodemailer from "nodemailer";
import winston from "winston";
import { ENV } from "./env";
import path from "path";
import fs from "fs";

// Create log directory before logger usage
const logDir = path.resolve(__dirname, "../../logs");
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Created email log directory: ${logDir}`);
  }
} catch (err) {
  console.error(`Failed to create email log directory: ${(err as Error).message}`);
}

// Initialize logger with proper file paths
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "email-error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "email-combined.log"),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

if (ENV.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
      level: "info" // Suppress debug logs in console
    })
  );
}

let transporter: nodemailer.Transporter | null = null;
let isInitialized = false;

/**
 * Initialize email transporter with connection pooling
 */
export const initializeEmailTransporter = async (): Promise<void> => {
  if (isInitialized && transporter) {
    logger.info("Email transporter already initialized");
    return;
  }

  try {
    // Create email configuration directory if it doesn't exist
    const emailConfigDir = path.resolve(__dirname, "../../config");
    if (!fs.existsSync(emailConfigDir)) {
      fs.mkdirSync(emailConfigDir, { recursive: true });
      logger.debug(`Created email config directory: ${emailConfigDir}`);
    }

    const emailConfig = {
      host: ENV.SMTP_HOST || "smtp.gmail.com",
      port: ENV.SMTP_PORT || 587,
      secure: ENV.SMTP_SECURE || false,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
      logger: false, // Disable nodemailer internal logging
      debug: ENV.NODE_ENV !== "production", // Enable debug only in dev
    };

    logger.info("Initializing SMTP transporter", {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      pool: emailConfig.pool,
      maxConnections: emailConfig.maxConnections
    });

    transporter = nodemailer.createTransport(emailConfig);

    // Verify connection
    await transporter.verify();
    
    isInitialized = true;
    logger.info("SMTP transporter initialized successfully with connection pooling");

    // Log critical transporter events only
    transporter.on('error', (error) => {
      logger.error('SMTP transporter error', { error: error.message });
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to initialize email transporter: ${err.message}`, {
      stack: err.stack
    });
    throw error;
  }
};

/**
 * Get the email transporter instance
 */
export const getEmailTransporter = (): nodemailer.Transporter => {
  if (!transporter || !isInitialized) {
    throw new Error("Email transporter not initialized. Call initializeEmailTransporter first.");
  }
  return transporter;
};

/**
 * Close email transporter connections
 */
export const closeEmailTransporter = async (): Promise<void> => {
  if (transporter) {
    try {
      const shutdownLogPath = path.join(logDir, "email-shutdown.log");
      const shutdownTime = new Date().toISOString();
      
      fs.appendFileSync(shutdownLogPath, `Email transporter shutdown at: ${shutdownTime}\n`);
      
      await transporter.close();
      logger.info("Email transporter connections closed");
      
      fs.appendFileSync(shutdownLogPath, `Email transporter closed successfully at: ${shutdownTime}\n`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      const errorLogPath = path.join(logDir, "email-shutdown-errors.log");
      const errorTime = new Date().toISOString();
      fs.appendFileSync(errorLogPath, `[${errorTime}] Error closing email transporter: ${err.message}\n`);
      
      logger.error(`Error closing email transporter: ${err.message}`, {
        stack: err.stack
      });
    } finally {
      transporter = null;
      isInitialized = false;
    }
  }
};

/**
 * Send email using the shared transporter
 */
export const sendEmail = async (mailOptions: nodemailer.SendMailOptions): Promise<nodemailer.SentMessageInfo> => {
  const emailTransporter = getEmailTransporter();
  
  try {
    const emailLogPath = path.join(logDir, "email-sent.log");
    const sendTime = new Date().toISOString();
    const logEntry = `[${sendTime}] Sending email to: ${mailOptions.to}, Subject: ${mailOptions.subject}\n`;
    fs.appendFileSync(emailLogPath, logEntry);
    
    const result = await emailTransporter.sendMail({
      from: ENV.SMTP_FROM || ENV.SMTP_USER,
      ...mailOptions,
    });
    
    const successLog = `[${sendTime}] Email sent successfully to ${mailOptions.to}, MessageID: ${result.messageId}\n`;
    fs.appendFileSync(emailLogPath, successLog);
    
    logger.info(`Email sent successfully to ${mailOptions.to}`, {
      messageId: result.messageId,
      subject: mailOptions.subject
    });
    
    return result;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    const errorLogPath = path.join(logDir, "email-errors.log");
    const errorTime = new Date().toISOString();
    const errorEntry = `[${errorTime}] Failed to send email to ${mailOptions.to}: ${err.message}\n`;
    fs.appendFileSync(errorLogPath, errorEntry);
    
    logger.error(`Failed to send email to ${mailOptions.to}: ${err.message}`, {
      stack: err.stack
    });
    throw error;
  }
};

/**
 * Check if email transporter is healthy
 */
export const checkEmailHealth = async (): Promise<boolean> => {
  if (!transporter || !isInitialized) {
    const healthLogPath = path.join(logDir, "email-health.log");
    const checkTime = new Date().toISOString();
    fs.appendFileSync(healthLogPath, `[${checkTime}] Health check failed: Transporter not initialized\n`);
    
    return false;
  }

  try {
    await transporter.verify();
    
    const healthLogPath = path.join(logDir, "email-health.log");
    const checkTime = new Date().toISOString();
    fs.appendFileSync(healthLogPath, `[${checkTime}] Health check passed\n`);
    
    return true;
  } catch (error) {
    const healthLogPath = path.join(logDir, "email-health.log");
    const checkTime = new Date().toISOString();
    const err = error instanceof Error ? error : new Error(String(error));
    fs.appendFileSync(healthLogPath, `[${checkTime}] Health check failed: ${err.message}\n`);
    
    logger.warn("Email health check failed", { error: err.message });
    return false;
  }
};

/**
 * Get email statistics from log files
 */
export const getEmailStats = (): { 
  totalSent: number; 
  totalErrors: number; 
  lastSent: string | null;
  lastError: string | null;
} => {
  const stats = {
    totalSent: 0,
    totalErrors: 0,
    lastSent: null as string | null,
    lastError: null as string | null
  };

  try {
    const sentLogPath = path.join(logDir, "email-sent.log");
    if (fs.existsSync(sentLogPath)) {
      const sentContent = fs.readFileSync(sentLogPath, 'utf8');
      const sentLines = sentContent.split('\n').filter(line => line.includes('Email sent successfully'));
      stats.totalSent = sentLines.length;
      stats.lastSent = sentLines[sentLines.length - 1] || null;
    }

    const errorLogPath = path.join(logDir, "email-errors.log");
    if (fs.existsSync(errorLogPath)) {
      const errorContent = fs.readFileSync(errorLogPath, 'utf8');
      const errorLines = errorContent.split('\n').filter(line => line.includes('Failed to send email'));
      stats.totalErrors = errorLines.length;
      stats.lastError = errorLines[errorLines.length - 1] || null;
    }
  } catch (error) {
    logger.error("Failed to read email statistics", { error: String(error) });
  }

  return stats;
};

/**
 * Clean up old email log files
 */
export const cleanupEmailLogs = (maxAgeDays: number = 30): void => {
  try {
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    const logFiles = [
      "email-sent.log",
      "email-errors.log", 
      "email-health.log",
      "email-shutdown.log",
      "email-shutdown-errors.log"
    ];

    logFiles.forEach(filename => {
      const filePath = path.join(logDir, filename);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          const rotatedName = `${filename}.${new Date(stats.mtimeMs).toISOString().split('T')[0]}.bak`;
          const rotatedPath = path.join(logDir, rotatedName);
          fs.renameSync(filePath, rotatedPath);
          logger.info(`Rotated email log file: ${filename} -> ${rotatedName}`);
        }
      }
    });
  } catch (error) {
    logger.error("Failed to cleanup email logs", { error: String(error) });
  }
};