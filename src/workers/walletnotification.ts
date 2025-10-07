import winston from 'winston';
import { NotificationPayload } from '../services/notificationServices';
import { inMemoryStore } from '../utils/inMemoryStore';
import { ENV } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const logDir = path.resolve(__dirname, "../../logs");

// Create the directory if it doesn't exist
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log(`Created log directory: ${logDir}`);
  }
} catch (err) {
  console.error(`Failed to create log directory: ${(err as Error).message}`);
}

const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'customer-service.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'customer-service-combined.log'), level: 'info' }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

let isWorkerRunning = false;

/**
 * Starts the notification queue worker in the background
 */
export async function startNotificationWorker(): Promise<void> {
  logger.info('Starting notification worker');

  if (isWorkerRunning) {
    logger.warn('Notification worker is already running');
    return;
  }

  isWorkerRunning = true;
  logger.debug('Starting background notification worker loop');

  // Start processing notifications
  inMemoryStore.processNotifications();

  logger.debug('Notification worker initialized');
}

/**
 * Stops the notification worker
 */
export async function stopNotificationWorker(): Promise<void> {
  logger.info('Stopping notification worker');
  isWorkerRunning = false;
  logger.debug('Notification worker stop signal sent');
}

/**
 * Enqueues a notification for processing
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    const notificationId = uuidv4();
    const job = {
      notificationId,
      payload,
      timestamp: new Date().toISOString(),
    };
    logger.debug('Enqueuing notification', { notificationId });
    inMemoryStore.enqueueNotification(job);
    logger.info('Notification enqueued', { notificationId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to enqueue notification', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to enqueue notification: ${errorMessage}`);
  }
}