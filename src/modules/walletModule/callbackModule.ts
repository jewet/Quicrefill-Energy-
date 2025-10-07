import { PrismaClient, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import retry from "async-retry";
import { logger } from "../../utils/logger";
import { AuditLogService } from "../../services/auditLogService";
import WebhookModule from "./webhookModule";
import CacheModule from "./cacheModule";
import VirtualAccountModule from "./virtualAccountModule";
import { getRedisClient } from "../../config/redis";

// Define Payment interface to align with Prisma schema
interface Payment {
  id: string;
  transactionRef: string | null; // Updated to match Prisma schema
  status: string;
}

// Define WalletTransaction interface to align with other modules
interface WalletTransaction {
  id: string;
  userId: string;
  walletId: string;
  amount: Prisma.Decimal;
  transactionType: TransactionType | null;
  status: TransactionStatus;
  paymentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Prisma.JsonValue | null;
  electricityOrderId?: string | null;
  electricityProviderId?: number | null;
  payment?: Payment | null;
}

const prisma = new PrismaClient();

export class CallbackModule {
  private webhookModule = WebhookModule;
  private cacheModule = CacheModule;
  private auditLogService = new AuditLogService();
  private virtualAccountModule = VirtualAccountModule;

  /**
   * Handles Monnify webhook callbacks.
   * @param callbackData The callback data.
   * @param signature The webhook signature.
   */
  async handleMonnifyCallback(callbackData: unknown, signature: string): Promise<void> {
    try {
      await this.webhookModule.verifyWebhookSignature(callbackData, signature);
      const data = callbackData as {
        eventType: string;
        eventData: {
          transactionReference: string;
          paymentStatus: string;
          amount: number;
          customer?: { email?: string };
          paymentMethod?: string;
        };
      };
      const { eventType, eventData } = data;
      const { transactionReference, paymentStatus, amount, customer, paymentMethod } = eventData;

      const redis = await getRedisClient();
      const idempotencyKey = `webhook:${transactionReference}`;
      const processed = await redis.get(idempotencyKey);
      if (processed) {
        logger.warn("Duplicate Monnify webhook callback ignored", { transactionReference });
        return;
      }

      let transactionStatus: TransactionStatus;
      switch (paymentStatus) {
        case "PAID":
          transactionStatus = TransactionStatus.COMPLETED;
          break;
        case "PENDING":
          transactionStatus = TransactionStatus.PENDING;
          break;
        default:
          transactionStatus = TransactionStatus.FAILED;
      }

      // Handle virtual account payment
      if (eventType === "SUCCESSFUL_TRANSACTION" && paymentMethod === "ACCOUNT_TRANSFER" && customer?.email) {
        const user = await prisma.user.findFirst({
          where: { email: customer.email },
        });
        if (!user) {
          logger.error("User not found for virtual account payment", { email: customer.email, transactionReference });
          throw new Error("User not found");
        }

        await this.virtualAccountModule.validateVirtualAccountPayment(user.id, transactionReference);
        logger.info("Virtual account payment processed via webhook", { userId: user.id, transactionReference, amount });

        await redis.set(idempotencyKey, "processed", { EX: 24 * 60 * 60 });
        return;
      }

      // Handle other payment types (e.g., card, bank transfer)
      await retry(
        async () => {
          await prisma.$transaction(async (tx) => {
            const walletTx: WalletTransaction | null = await tx.walletTransaction.findFirst({
              where: { transactionRef: transactionReference },
              include: { payment: true },
            });

            if (!walletTx || !walletTx.payment) throw new Error(`No transaction found for transactionReference: ${transactionReference}`);

            const userId = walletTx.userId;
            const metadata = walletTx.metadata && typeof walletTx.metadata === "object" ? walletTx.metadata : {};

            if (transactionStatus === TransactionStatus.COMPLETED && userId) {
              const baseAmount = walletTx.amount.toNumber();
              await tx.wallet.update({
                where: { userId },
                data: { balance: { increment: baseAmount } },
              });
              await this.cacheModule.invalidateBalanceCache(userId);
            }

            const updatedMetadata = {
              ...metadata,
              webhookStatus: transactionStatus,
              paymentMethod,
            };
            await tx.walletTransaction.update({
              where: { id: walletTx.id },
              data: { status: transactionStatus, metadata: updatedMetadata },
            });

            await tx.payment.update({
              where: { id: walletTx.payment.id },
              data: { status: transactionStatus === TransactionStatus.COMPLETED ? "completed" : transactionStatus.toLowerCase() },
            });

            await redis.set(idempotencyKey, "processed", { EX: 24 * 60 * 60 });

            await this.auditLogService.log({
              userId: userId || "SYSTEM",
              action: `WEBHOOK_PROCESSED_${transactionStatus}`,
              details: { transactionReference, amount, status: transactionStatus },
              entityType: "WALLET_TRANSACTION",
              entityId: walletTx.id,
            });
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying callback transaction", { transactionReference, amount, attempt, error });
          },
        }
      );

      const userId = customer?.email ? (await prisma.user.findFirst({ where: { email: customer.email } }))?.id ?? null : null;
      await this.webhookModule.triggerWebhook(userId, { id: transactionReference, status: transactionStatus }, `WEBHOOK_${transactionStatus}`);

      logger.info("Monnify callback processed", { transactionReference, amount, status: transactionStatus });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error processing Monnify callback", { error: errorMessage, callbackData });
      const userId = (callbackData as any)?.eventData?.customer?.email
        ? (await prisma.user.findFirst({ where: { email: (callbackData as any).eventData.customer.email } }))?.id ?? "SYSTEM"
        : "SYSTEM";
      await this.auditLogService.log({
        userId,
        action: "WEBHOOK_PROCESSING_FAILED",
        details: { error: errorMessage, callbackData },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(userId, { id: (callbackData as any)?.eventData?.transactionReference || uuidv4(), status: TransactionStatus.FAILED }, "WEBHOOK_FAILED");
      throw new Error("Failed to process callback: " + errorMessage);
    }
  }
}

export default new CallbackModule();