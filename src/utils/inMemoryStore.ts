import { PrismaClient } from "@prisma/client";
import { NotificationPayload, dispatchNotification } from "../services/notificationServices";
import { Request, Response } from "express"; // Added Response import
import logger  from "../config/logger"; // Fixed: Named import

const prisma = new PrismaClient();

class InMemoryStore {
  private cache: Map<string, any>;
  private blacklistedTokens: Map<string, number>;
  private auditQueue: Array<{ userId: string; action: string; details: any; timestamp: string }>;
  private notificationQueue: Array<{ notificationId: string; payload: NotificationPayload; timestamp: string }>;
  public processAuditLogsRunning: boolean;
  public processNotificationsRunning: boolean;

  constructor() {
    this.cache = new Map();
    this.blacklistedTokens = new Map();
    this.auditQueue = [];
    this.notificationQueue = [];
    this.processAuditLogsRunning = false;
    this.processNotificationsRunning = false;
  }

  // Sets a key/value pair in the cache with an optional TTL in seconds.
  set(key: string, value: any, ttlSeconds?: number): void {
    this.cache.set(key, value);
    if (ttlSeconds) {
      setTimeout(() => this.cache.delete(key), ttlSeconds * 1000);
    }
  }

  // Retrieves a value from the cache by key.
  get(key: string): any {
    return this.cache.get(key);
  }

  // Deletes a key from the cache.
  delete(key: string): void {
    this.cache.delete(key);
  }

  // Blacklists a token for a specified TTL in seconds.
  blacklistToken(token: string, ttlSeconds: number): void {
    this.blacklistedTokens.set(token, Date.now() + ttlSeconds * 1000);
    setTimeout(() => this.blacklistedTokens.delete(token), ttlSeconds * 1000);
  }

  // Checks if a token is blacklisted.
  isTokenBlacklisted(token: string): boolean {
    const expiration = this.blacklistedTokens.get(token);
    return expiration !== undefined && Date.now() < expiration;
  }

  // Enqueues an audit log job.
  enqueueAudit(job: { userId: string; action: string; details: any; timestamp: string }): void {
    this.auditQueue.push(job);
  }

  // Dequeues an audit log job.
  dequeueAudit(): { userId: string; action: string; details: any; timestamp: string } | undefined {
    return this.auditQueue.shift();
  }

  // Processes audit logs from the queue.
  processAuditLogs(): void {
    if (this.processAuditLogsRunning) return;

    this.processAuditLogsRunning = true;
    const interval = setInterval(() => {
      const job = this.dequeueAudit();
      if (job) {
        this.processAuditJob(job);
      } else if (this.auditQueue.length === 0) {
        clearInterval(interval);
        this.processAuditLogsRunning = false;
      }
    }, 1000);
  }

  // Internal method to process a single audit log job.
  private async processAuditJob(job: { userId: string; action: string; details: any; timestamp: string }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: job.userId,
          action: job.action,
          details: job.details,
          createdAt: new Date(job.timestamp),
        },
      });
      logger.info(`Audit log processed for action: ${job.action}`); // Updated to use logger
    } catch (error: any) {
      logger.error(`Error processing audit log: ${error.message}`); // Updated to use logger
    }
  }

  // Enqueues a notification job.
  enqueueNotification(job: { notificationId: string; payload: NotificationPayload; timestamp: string }): void {
    this.notificationQueue.push(job);
  }

  // Dequeues a notification job.
  dequeueNotification(): { notificationId: string; payload: NotificationPayload; timestamp: string } | undefined {
    return this.notificationQueue.shift();
  }

  // Processes notifications from the queue.
  processNotifications(): void {
    if (this.processNotificationsRunning) return;

    this.processNotificationsRunning = true;
    const interval = setInterval(() => {
      const job = this.dequeueNotification();
      if (job) {
        this.processNotificationJob(job);
      } else if (this.notificationQueue.length === 0) {
        clearInterval(interval);
        this.processNotificationsRunning = false;
      }
    }, 500); // Increased interval to 500ms to reduce CPU load
  }

  // Internal method to process a single notification job.
  private async processNotificationJob(job: { notificationId: string; payload: NotificationPayload; timestamp: string }): Promise<void> {
    try {
      const mockRes = {} as Response; // Added mock Response
      await dispatchNotification(job.payload, {} as Request, mockRes); // Fixed: Added mockRes
      logger.info(`Notification processed for notificationId: ${job.notificationId}`); // Updated to use logger
    } catch (error: any) {
      logger.error(`Error processing notification ${job.notificationId}: ${error.message}`); // Updated to use logger
    }
  }
}

// Create a singleton instance of InMemoryStore.
export const inMemoryStore = new InMemoryStore();

/**
 * setWithExpiry sets a key/value pair in the in-memory store with a time-to-live.
 * @param key The key to store.
 * @param value The value to store.
 * @param ttlSeconds The time-to-live in seconds.
 */
export const setWithExpiry = (key: string, value: any, ttlSeconds: number): void => {
  inMemoryStore.set(key, value, ttlSeconds);
};