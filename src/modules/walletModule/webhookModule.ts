import { Prisma, PrismaClient } from "@prisma/client";
import { getRedisClient } from "../../config/redis";
import CircuitBreaker from "opossum";
import axios from "axios";
import retry from "async-retry";
import { createHmac } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";
import { NotificationPayload, dispatchNotification } from "../../services/notificationServices";
import { Request, Response } from "express";
import { KnownEventTypes } from "../../utils/EventTypeDictionary";

// Metrics storage
const metrics = {
  webhookSuccess: 0,
  webhookFailures: 0,
  redisFailures: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

// Circuit breaker configuration for Redis
const circuitBreakerOptions = {
  timeout: 1000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};
const redisCircuitBreaker = new CircuitBreaker(
  async (fn: () => Promise<any>) => fn(),
  circuitBreakerOptions
);

// Updated WebhookPayload interface to include orderId and entityType
interface WebhookPayload {
  event: string;
  transactionId: string;
  userId: string | null;
  amount?: number;
  status?: string;
  createdAt?: string;
  metadata?: any;
  timestamp: string;
  orderId?: string;
  entityType?: "SERVICE_ORDER" | "PRODUCT_ORDER" | "WALLET_TOPUP" | undefined; 
}

interface WebhookAttempt {
  id: string;
  transactionId: string;
  eventType: string;
  webhookUrl: string;
  payload: WebhookPayload;
  status: "PENDING" | "SUCCESS" | "FAILED";
  attempts: number;
  lastAttemptAt?: Date;
  createdAt: Date;
}

const prisma = new PrismaClient();

export class WebhookModule {
  private readonly MAX_WEBHOOK_ATTEMPTS = 5;
  private readonly WEBHOOK_TIMEOUT_MS = 10000;
  private readonly DLQ_KEY = "webhook:dlq";

  /**
   * Verifies webhook signature.
   * @param payload The webhook payload.
   * @param signature The signature to verify.
   * @returns True if valid, false otherwise.
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET || "secret";
    const computedSignature = createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");
    return computedSignature === signature;
  }

  /**
   * Generates webhook signature.
   * @param payload The webhook payload.
   * @returns The computed signature.
   */
  generateWebhookSignature(payload: any): string {
    const secret = process.env.WEBHOOK_SECRET || "secret";
    return createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  /**
   * Queues a webhook retry attempt.
   * @param webhookUrl The webhook URL.
   * @param payload The webhook payload.
   * @param transactionId The transaction ID.
   * @param eventType The event type.
   */
  async queueWebhookRetry(
    webhookUrl: string,
    payload: WebhookPayload,
    transactionId: string,
    eventType: string
  ): Promise<void> {
    let webhookAttempt: WebhookAttempt | undefined;
    try {
      const redis = await getRedisClient();
      let resolvedPayload: WebhookPayload = payload;
      if (!payload.userId && transactionId) {
        try {
          const payment = await prisma.payment.findFirst({
            where: { transactionRef: transactionId },
            select: { userId: true },
          });
          resolvedPayload = {
            ...payload,
            userId: payment?.userId || null,
          };
          if (!payment?.userId) {
            logger.warn("Could not resolve userId for webhook retry queue", { transactionId, webhookUrl });
          }
        } catch (error) {
          logger.error("Error fetching userId for webhook retry queue", {
            transactionId,
            webhookUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      webhookAttempt = {
        id: uuidv4(),
        transactionId,
        eventType,
        webhookUrl,
        payload: resolvedPayload,
        status: "PENDING",
        attempts: 0,
        createdAt: new Date(),
      };
      await redisCircuitBreaker.fire(async () => {
        await redis.lPush(`webhook:retry:${transactionId}`, JSON.stringify(webhookAttempt));
      });
      logger.info("Webhook retry queued", {
        transactionId,
        webhookUrl,
        eventType,
        userId: resolvedPayload.userId,
      });
      await this.processWebhookQueue(transactionId);
    } catch (error) {
      logger.error("Failed to queue webhook retry", {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
        webhookDetails: webhookAttempt,
      });
      if (webhookAttempt) {
        await this.moveToDeadLetterQueue(webhookAttempt);
      } else {
        logger.warn("Webhook attempt undefined, cannot move to DLQ", { transactionId });
      }
    }
  }

  /**
   * Moves a webhook attempt to the dead-letter queue.
   * @param attempt The webhook attempt to move.
   */
  private async moveToDeadLetterQueue(attempt: WebhookAttempt): Promise<void> {
    try {
      const redis = await getRedisClient();
      await redisCircuitBreaker.fire(async () => {
        await redis.lPush(this.DLQ_KEY, JSON.stringify(attempt));
      });
      logger.warn("Webhook attempt moved to DLQ", { transactionId: attempt.transactionId, webhookUrl: attempt.webhookUrl });

      const notificationPayload: NotificationPayload = {
        eventTypeName: KnownEventTypes.WEBHOOK_FAILED,
        dynamicData: {
          message: `Webhook attempt moved to DLQ for transaction ${attempt.transactionId}`,
          transactionId: attempt.transactionId,
          webhookUrl: attempt.webhookUrl,
          error: "Max retries exceeded, moved to DLQ",
        },
        userIds: attempt.payload.userId ? [attempt.payload.userId] : undefined,
      };

      const mockRequest = {} as Request;
      const mockRes = {} as Response;
      await dispatchNotification(notificationPayload, mockRequest, mockRes);
    } catch (error) {
      logger.error("Failed to move webhook attempt to DLQ", {
        transactionId: attempt.transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Processes the webhook retry queue for a transaction.
   * @param transactionId The transaction ID.
   */
  async processWebhookQueue(transactionId: string): Promise<void> {
    const redis = await getRedisClient();
    const key = `webhook:retry:${transactionId}`;

    while (true) {
      let webhookData: string | null = null;
      try {
        webhookData = await redisCircuitBreaker.fire(async () => {
          return await redis.rPop(key);
        });
      } catch (error) {
        logger.error("Redis error during webhook queue processing, skipping", { transactionId, error });
        break;
      }

      if (!webhookData) break;

      const attempt: WebhookAttempt = JSON.parse(webhookData);
      if (attempt.attempts >= this.MAX_WEBHOOK_ATTEMPTS) {
        logger.error("Max webhook attempts reached, moving to DLQ", { transactionId, webhookUrl: attempt.webhookUrl });
        await this.moveToDeadLetterQueue(attempt);
        continue;
      }

      try {
        await retry(
          async () => {
            const response = await axios.post(attempt.webhookUrl, attempt.payload, {
              headers: { "X-Webhook-Signature": this.generateWebhookSignature(attempt.payload) },
              timeout: this.WEBHOOK_TIMEOUT_MS,
            });

            if (response.status >= 200 && response.status < 300) {
              await this.updateWebhookAttemptStatus(attempt.id, "SUCCESS");
              metrics.webhookSuccess++;
              logger.info("Webhook retry successful", {
                transactionId,
                webhookUrl: attempt.webhookUrl,
                attempt: attempt.attempts + 1,
              });
            } else {
              throw new Error(`Webhook failed with status ${response.status}`);
            }
          },
          {
            retries: 1,
            factor: 2,
            minTimeout: 1000 + Math.random() * 100,
            maxTimeout: 30000,
            onRetry: (error, attemptNumber) => {
              logger.warn("Retrying webhook delivery", {
                transactionId,
                webhookUrl: attempt.webhookUrl,
                attempt: attempt.attempts + attemptNumber,
                error,
              });
            },
          }
        );
      } catch (error) {
        metrics.webhookFailures++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        attempt.attempts += 1;
        attempt.lastAttemptAt = new Date();
        try {
          await redisCircuitBreaker.fire(async () => {
            await redis.lPush(key, JSON.stringify(attempt));
          });
        } catch (redisError) {
          logger.error("Redis error, moving webhook attempt to DLQ", { transactionId, error: redisError });
          await this.moveToDeadLetterQueue(attempt);
        }
        logger.error("Webhook retry attempt failed", {
          transactionId,
          webhookUrl: attempt.webhookUrl,
          attempt: attempt.attempts,
          error: errorMessage,
        });
        await this.updateWebhookAttemptStatus(attempt.id, "PENDING");
      }
    }
  }

  /**
   * Updates the status of a webhook attempt in the database.
   * @param attemptId The webhook attempt ID.
   * @param status The new status.
   */
  private async updateWebhookAttemptStatus(attemptId: string, status: "PENDING" | "SUCCESS" | "FAILED"): Promise<void> {
    try {
      await prisma.webhookAttempt.upsert({
        where: { id: attemptId },
        update: { status, updatedAt: new Date() },
        create: {
          id: attemptId,
          transactionId: null,
          eventType: "UNKNOWN",
          webhookUrl: "unknown",
          payload: {},
          status,
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Prisma.WebhookAttemptUncheckedCreateInput,
      });
      logger.info("Webhook attempt status updated", { attemptId, status });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Failed to update webhook attempt status", { attemptId, status, error: errorMessage });
    }
  }

  /**
   * Triggers a webhook for a transaction.
   * @param userId The user ID or null.
   * @param transaction The transaction data.
   * @param eventType The event type.
   * @param req Optional Express request object for notification dispatching.
   */
  async triggerWebhook(
    userId: string | null,
    transaction: {
      id: string | number;
      amount?: any;
      status?: string;
      createdAt?: any;
      metadata?: any;
      userId?: string;
      orderId?: string;
      entityType?: "SERVICE_ORDER" | "PRODUCT_ORDER" | "WALLET_TOPUP" | undefined; 
    },
    eventType: string,
    req?: Request
  ): Promise<void> {
    const internalWebhookUrl = process.env.INTERNAL_WEBHOOK_URL || "http://localhost:5000/internal/webhook";
    const flutterwaveWebhookUrl = process.env.FLUTTERWAVE_WEBHOOK_URL || "http://localhost:5000/flutterwave/webhook";
    let webhookUrls: string[] = [];

    if (eventType === "TOPUP_PENDING" || eventType === "DEPOSIT_PENDING") {
      webhookUrls = [internalWebhookUrl];
    } else if (eventType.startsWith("WEBHOOK_") || eventType.includes("FLUTTERWAVE") || eventType.includes("TOPUP")) {
      webhookUrls = [flutterwaveWebhookUrl];
    } else {
      webhookUrls = (process.env.WEBHOOK_URLS?.split(",") || [internalWebhookUrl]).map(url => url.trim());
    }

    if (!webhookUrls.length) {
      logger.warn("No webhook URLs configured", { eventType });
      return;
    }

    let resolvedUserId: string | null = userId || transaction.userId || null;
    if (!resolvedUserId && typeof transaction.id === "string") {
      try {
        const payment = await prisma.payment.findFirst({
          where: { transactionRef: transaction.id.toString() },
          select: { userId: true },
        });
        resolvedUserId = payment?.userId || null;
        if (!resolvedUserId) {
          logger.warn("Could not resolve userId for webhook", { eventType, transactionId: transaction.id });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Error fetching userId from payment", { eventType, transactionId: transaction.id, error: errorMessage });
      }
    }

    let baseAmount: number | undefined;
    if (typeof transaction.id === "string") {
      const walletTx = await prisma.walletTransaction.findUnique({
        where: { id: transaction.id },
        select: { amount: true, serviceOrderId: true, productOrderId: true },
      });
      baseAmount = walletTx?.amount.toNumber();
      // Ensure orderId and entityType are derived correctly
      if (!transaction.orderId || !transaction.entityType) {
        transaction.orderId = walletTx?.serviceOrderId || walletTx?.productOrderId || transaction.orderId;
        transaction.entityType = walletTx?.serviceOrderId
          ? "SERVICE_ORDER"
          : walletTx?.productOrderId
          ? "PRODUCT_ORDER"
          : "WALLET_TOPUP"; // Default to WALLET_TOPUP if no service or product order
      }
    }

    const payload: WebhookPayload = {
      event: eventType,
      transactionId: transaction.id.toString(),
      userId: resolvedUserId,
      amount: baseAmount || (typeof transaction.amount === "object" ? transaction.amount?.toNumber() : transaction.amount),
      status: transaction.status,
      createdAt: transaction.createdAt || new Date().toISOString(),
      metadata: transaction.metadata,
      timestamp: new Date().toISOString(),
      orderId: transaction.orderId,
      entityType: transaction.entityType,
    };

    const mockRequest = req || ({} as Request);
    const mockRes = {} as Response;

    for (const webhookUrl of webhookUrls) {
      const attemptId = uuidv4();
      try {
        await retry(
          async () => {
            const response = await axios.post(webhookUrl, payload, {
              headers: {
                "Content-Type": "application/json",
                "X-Webhook-Signature": this.generateWebhookSignature(payload),
                "X-Webhook-Attempt-Id": attemptId,
              },
              timeout: this.WEBHOOK_TIMEOUT_MS,
            });

            if (response.status >= 200 && response.status < 300) {
              logger.info("Webhook triggered successfully", {
                eventType,
                transactionId: transaction.id,
                webhookUrl,
                baseAmount,
                orderId: transaction.orderId,
                entityType: transaction.entityType,
              });
              await prisma.walletTransaction.update({
                where: { id: transaction.id.toString() },
                data: {
                  metadata: transaction.metadata && typeof transaction.metadata === "object"
                    ? { ...transaction.metadata, webhookStatus: "SENT" }
                    : { webhookStatus: "SENT" },
                },
              });
              await this.updateWebhookAttemptStatus(attemptId, "SUCCESS");
              metrics.webhookSuccess++;
            } else {
              throw new Error(`Webhook failed with status ${response.status}`);
            }
          },
          {
            retries: 2,
            factor: 2,
            minTimeout: 1000 + Math.random() * 100,
            maxTimeout: 30000,
            onRetry: (error, attempt) => {
              logger.warn("Retrying webhook trigger", {
                eventType,
                transactionId: transaction.id,
                webhookUrl,
                attempt,
                error,
              });
              if (typeof error === "object" && error !== null && "message" in error && typeof (error as any).message === "string" && (error as any).message.includes("Unknown event type")) {
                throw new Error("Unresolvable webhook error, aborting retries");
              }
            },
          }
        );
      } catch (error: unknown) {
        metrics.webhookFailures++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Webhook trigger failed", {
          error: errorMessage,
          eventType,
          transactionId: transaction.id,
          webhookUrl,
          orderId: transaction.orderId,
          entityType: transaction.entityType,
        });
        await this.queueWebhookRetry(webhookUrl, payload, transaction.id.toString(), eventType);
        if (resolvedUserId) {
          const notificationPayload: NotificationPayload = {
            eventTypeName: KnownEventTypes.WEBHOOK_FAILED,
            dynamicData: {
              message: `Webhook failed for transaction ${transaction.id}`,
              transactionId: transaction.id.toString(),
              webhookUrl,
              error: errorMessage,
            },
            userIds: [resolvedUserId],
          };
          await dispatchNotification(notificationPayload, mockRequest, mockRes);
        }
        await this.updateWebhookAttemptStatus(attemptId, "FAILED");
      }
    }
  }

  /**
   * Exposes metrics for monitoring.
   * @returns Current metrics.
   */
  async getMetrics(): Promise<any> {
    return metrics;
  }
}

export default new WebhookModule();