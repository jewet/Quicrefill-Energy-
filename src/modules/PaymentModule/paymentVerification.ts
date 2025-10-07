// File: PaymentVerification.ts
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { Request } from "express";
import dotenv from "dotenv";
import { PrismaClient, PaymentMethod, TransactionStatus } from "@prisma/client";
import { getRedisClient } from "../../config/redis";
import winston from "winston";
import crypto from "crypto";

dotenv.config();

// Validate Monnify environment variables
if (!process.env.MONNIFY_API_KEY || !process.env.MONNIFY_SECRET_KEY || !process.env.MONNIFY_CONTRACT_CODE) {
  console.error("Missing MONNIFY_API_KEY, MONNIFY_SECRET_KEY, or MONNIFY_CONTRACT_CODE in environment");
  throw new Error("Monnify configuration missing");
}

const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.metadata({ fillExcept: ["message", "level", "timestamp"] })
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

// Define Monnify-specific payment methods
type MonnifyPaymentMethod = "CARD" | "TRANSFER" | "VIRTUAL_ACCOUNT";

// Define Monnify webhook payload interface
interface MonnifyWebhookPayload {
  transactionReference: string;
  paymentStatus: string;
  amount: number;
  eventType: string;
  [key: string]: any;
}

// Define Monnify-specific verification response
interface MonnifyVerificationResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    transactionReference: string;
    paymentReference: string;
    amount: number;
    paymentStatus: string;
  };
}

class PaymentVerification {
  private prisma: PrismaClient;
  private baseUrl: string = "https://api.monnify.com";

  constructor() {
    this.prisma = new PrismaClient();
  }

  private async getMonnifyAuthToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/auth/login`,
        {},
        {
          auth: {
            username: process.env.MONNIFY_API_KEY!,
            password: process.env.MONNIFY_SECRET_KEY!,
          },
        }
      );
      return response.data.responseBody.accessToken;
    } catch (error: any) {
      logger.error("Failed to get Monnify auth token", { message: error.message });
      throw new Error("Unable to authenticate with Monnify");
    }
  }

  async verifyPayment(
    transactionId: string
  ): Promise<{ status: TransactionStatus; transactionId: string; amount?: number; paymentMethod?: PaymentMethod }> {
    try {
      logger.info(`🔍 Verifying payment: ${transactionId}...`);

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef: transactionId },
        include: { provider: true },
      });
      if (!payment) throw new Error("Payment not found.");

      // Validate payment method
      const paymentMethod: PaymentMethod = payment.paymentMethod;
      if (!["CARD", "TRANSFER", "VIRTUAL_ACCOUNT"].includes(paymentMethod)) {
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }
      logger.info(`Payment method for transaction ${transactionId}: ${paymentMethod}`);

      const mapToTransactionStatus = (status: string): TransactionStatus => {
        switch (status.toLowerCase()) {
          case "completed":
            return TransactionStatus.COMPLETED;
          case "pending":
            return TransactionStatus.PENDING;
          case "confirmed":
            return TransactionStatus.CONFIRMED;
          case "pending_manual":
            return TransactionStatus.PENDING_MANUAL;
          case "pending_delivery":
            return TransactionStatus.PENDING_DELIVERY;
          case "cancelled":
            return TransactionStatus.CANCELLED;
          case "failed":
            return TransactionStatus.FAILED;
          case "refund":
            return TransactionStatus.REFUND;
          default:
            return TransactionStatus.FAILED;
        }
      };

      const currentStatus: TransactionStatus = mapToTransactionStatus(payment.status);
      // Check if payment is already in a final state
      if (
        currentStatus === TransactionStatus.COMPLETED ||
        currentStatus === TransactionStatus.CONFIRMED ||
        currentStatus === TransactionStatus.REFUND
      ) {
        logger.info(`Payment already ${currentStatus.toLowerCase()}: ${transactionId}`);
        return {
          status: currentStatus,
          transactionId,
          amount: payment.amount,
          paymentMethod,
        };
      }

      const monnifyMethods: MonnifyPaymentMethod[] = ["CARD", "TRANSFER", "VIRTUAL_ACCOUNT"];
      if (monnifyMethods.includes(paymentMethod as MonnifyPaymentMethod)) {
        if (
          !payment.providerId ||
          (await this.prisma.paymentProvider.findUnique({ where: { id: payment.providerId } }))
            ?.name.toLowerCase() !== "monnify"
        ) {
          throw new Error("Invalid payment provider for Monnify verification");
        }

        const token = await this.getMonnifyAuthToken();
        const response = await axios.get<MonnifyVerificationResponse>(
          `${this.baseUrl}/api/v1/merchant/transactions/query?transactionReference=${transactionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          }
        );

        const paymentData = response.data.responseBody;
        logger.info("Monnify Verification Response:", JSON.stringify(paymentData, null, 2));

        let paymentStatus: TransactionStatus;
        switch (paymentData.paymentStatus.toLowerCase()) {
          case "paid":
            paymentStatus = TransactionStatus.COMPLETED;
            break;
          case "pending":
            paymentStatus = TransactionStatus.PENDING;
            break;
          case "expired":
            paymentStatus = TransactionStatus.CANCELLED;
            break;
          case "failed":
          default:
            paymentStatus = TransactionStatus.FAILED;
        }

        const currentAmount = payment.amount;
        const verifiedAmount = paymentData.amount;
        if (currentAmount !== verifiedAmount) {
          logger.warn(`Amount mismatch: Database=${currentAmount}, Monnify=${verifiedAmount}`);
          paymentStatus = TransactionStatus.PENDING_MANUAL; // Flag for manual review
          await this.prisma.fraudAlert.create({
            data: {
              id: uuidv4(),
              type: "AMOUNT_MISMATCH",
              entityId: payment.id,
              entityType: "Payment",
              reason: `Payment amount mismatch: Database=${currentAmount}, Monnify=${verifiedAmount}`,
              userId: payment.userId,
            },
          });
        }

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: paymentStatus,
            updatedAt: new Date(),
            monnifyRef: paymentData.paymentReference || payment.monnifyRef,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId: payment.userId,
            action: "PAYMENT_VERIFIED",
            entityType: "PAYMENT",
            entityId: payment.id,
            details: {
              transactionRef: transactionId,
              status: paymentStatus,
              amount: currentAmount,
              paymentMethod,
            },
          },
        });

        return {
          status: paymentStatus,
          transactionId,
          amount: currentAmount,
          paymentMethod,
        };
      } else {
        let paymentStatus: TransactionStatus = mapToTransactionStatus(payment.status);

        await this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId: payment.userId,
            action: "PAYMENT_VERIFIED",
            entityType: "PAYMENT",
            entityId: payment.id,
            details: {
              transactionRef: transactionId,
              status: paymentStatus,
              amount: payment.amount,
              paymentMethod,
            },
          },
        });

        return {
          status: paymentStatus,
          transactionId,
          amount: payment.amount,
          paymentMethod,
        };
      }
    } catch (error: any) {
      logger.error("Payment Verification Error:", {
        message: error.message,
        response: error?.response?.data,
        transactionId,
        stack: error.stack,
      });

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef: transactionId },
      });

      if (payment) {
        await this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId: payment.userId,
            action: "PAYMENT_VERIFICATION_FAILED",
            entityType: "PAYMENT",
            entityId: payment.id,
            details: {
              error: error.message,
              transactionRef: transactionId,
              stack: error.stack,
            },
          },
        });
      }

      throw error;
    }
  }

  async verifyWebhook(req: Request): Promise<void> {
    try {
      const webhookData = req.body as MonnifyWebhookPayload;
      const { transactionReference, paymentStatus, amount, eventType } = webhookData;
      logger.info("Processing Monnify webhook", {
        transactionRef: transactionReference || "unknown",
        webhookUrl: `${process.env.SERVER_URL}/api/payments/webhook`,
        eventType,
        amount,
        rawBody: (req as any).rawBody,
      });

      if (req.aborted) {
        logger.warn("Webhook request aborted by client", { transactionRef: transactionReference });
        throw new Error("Webhook request aborted");
      }

      // Verify Monnify webhook signature
      const monnifySignature = req.headers["monnify-signature"] as string;
      if (!monnifySignature) {
        logger.error("Missing Monnify webhook signature", {
          headers: req.headers,
          body: req.body,
        });
        throw new Error("Missing webhook signature");
      }

      const computedSignature = crypto
        .createHmac("sha512", process.env.MONNIFY_SECRET_KEY!)
        .update((req as any).rawBody)
        .digest("hex");
      if (computedSignature !== monnifySignature) {
        logger.error("Invalid Monnify webhook signature", {
          computedSignature,
          monnifySignature,
        });
        throw new Error("Invalid webhook signature");
      }

      if (!transactionReference || !paymentStatus) {
        logger.error("Missing transactionReference or paymentStatus in webhook payload", {
          data: req.body,
          eventType,
          rawBody: (req as any).rawBody,
        });
        throw new Error("Missing transactionReference or paymentStatus in webhook payload");
      }

      const redis = await getRedisClient().catch((err) => {
        logger.error("Failed to connect to Redis", { message: err.message });
        throw new Error("Redis connection failed");
      });
      const idempotencyKey = `monnifyWebhook:${transactionReference}`;
      const isProcessed = await redis.get(idempotencyKey);
      if (isProcessed) {
        logger.info(`Webhook already processed for ${transactionReference}`);
        return;
      }

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef: transactionReference },
      });
      if (!payment) {
        logger.error(`Payment not found for transactionRef: ${transactionReference}`);
        throw new Error("Payment not found for webhook");
      }

      const paymentMethod: PaymentMethod = payment.paymentMethod;
      logger.info(`Webhook payment method for ${transactionReference}: ${paymentMethod}`);

      if (payment.status === TransactionStatus.COMPLETED) {
        logger.info(`Payment already completed: ${transactionReference}`);
        await redis.setEx(idempotencyKey, 3600, "processed").catch((err) => {
          logger.error("Failed to set Redis idempotency key", { message: err.message });
        });
        return;
      }

      // Validate amount
      if (payment.amount !== amount) {
        logger.warn(`Webhook amount mismatch: Database=${payment.amount}, Webhook=${amount}`);
        await this.prisma.fraudAlert.create({
          data: {
            id: uuidv4(),
            type: "AMOUNT_MISMATCH",
            entityId: payment.id,
            entityType: "Payment",
            reason: `Webhook amount mismatch: Database=${payment.amount}, Webhook=${amount}`,
            userId: payment.userId,
          },
        });
      }

      let paymentStatusEnum: TransactionStatus;
      switch (paymentStatus.toLowerCase()) {
        case "paid":
          paymentStatusEnum = TransactionStatus.COMPLETED;
          break;
        case "pending":
          paymentStatusEnum = TransactionStatus.PENDING;
          break;
        case "expired":
          paymentStatusEnum = TransactionStatus.CANCELLED;
          break;
        case "failed":
        default:
          paymentStatusEnum = TransactionStatus.FAILED;
      }

      // Flag for manual review if amount mismatch
      if (payment.amount !== amount) {
        paymentStatusEnum = TransactionStatus.PENDING_MANUAL;
      }

      logger.info(`Webhook updating payment: ${transactionReference} with amount: ${amount}`);

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatusEnum,
          updatedAt: new Date(),
          monnifyRef: transactionReference,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment.userId,
          action: "WEBHOOK_UPDATE",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            status: paymentStatusEnum,
            webhookData,
            amount,
            paymentMethod,
          },
        },
      });

      await redis.setEx(idempotencyKey, 3600, "processed").catch((err) => {
        logger.error("Failed to set Redis idempotency key", { message: err.message });
      });
      logger.info(`Webhook processed: ${transactionReference} - Status: ${paymentStatusEnum}`);
    } catch (error: any) {
      logger.error("Webhook Processing Error", {
        message: error.message,
        webhookData: req.body,
        rawBody: (req as any).rawBody,
        stack: error.stack,
      });

      const transactionRef = (req.body as MonnifyWebhookPayload).transactionReference;
      if (transactionRef) {
        const payment = await this.prisma.payment.findFirst({ where: { transactionRef } });
        if (payment) {
          await this.prisma.auditLog.create({
            data: {
              id: uuidv4(),
              userId: payment.userId,
              action: "WEBHOOK_FAILED",
              entityType: "Payment",
              entityId: payment.id,
              details: {
                error: error.message,
                webhookData: req.body,
              },
            },
          });

          if (error.message !== "Missing webhook signature" && error.message !== "Webhook request aborted") {
            await this.scheduleWebhookRetry(transactionRef);
          }
        }
      }

      throw error;
    }
  }

  private async scheduleWebhookRetry(transactionRef: string): Promise<void> {
    try {
      const redis = await getRedisClient().catch((err) => {
        logger.error("Failed to connect to Redis for retry", { message: err.message });
        throw new Error("Redis connection failed");
      });
      const retryKey = `webhookRetry:${transactionRef}`;
      const retryCount = parseInt((await redis.get(retryKey)) || "0", 10);

      if (retryCount >= 3) {
        logger.warn(`Max retry attempts reached for ${transactionRef}`);
        return;
      }

      await redis.setEx(retryKey, 3600, (retryCount + 1).toString()).catch((err) => {
        logger.error("Failed to set Redis retry key", { message: err.message });
      });

      setTimeout(async () => {
        try {
          await this.verifyPayment(transactionRef);
          logger.info(`Webhook retry successful for ${transactionRef}`);
        } catch (retryError: any) {
          logger.error(`Webhook retry failed for ${transactionRef}`, {
            message: retryError.message,
            stack: retryError.stack,
          });
        }
      }, 1000 * 60 * (retryCount + 1)); // Delay increases with retry count (1min, 2min, 3min)
    } catch (error: any) {
      logger.error(`Failed to schedule webhook retry for ${transactionRef}`, {
        message: error.message,
        stack: error.stack,
      });
    }
  }
}

export default PaymentVerification;