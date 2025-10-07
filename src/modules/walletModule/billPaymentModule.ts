import { PrismaClient, TransactionStatus, TransactionType, ServiceOrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { ensureWalletExists } from "../../utils/walletUtils";
import axios from "axios";
import retry from "async-retry";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";
import { AuditLogService, AuditLogRequest } from "../../services/auditLogService";
import { FraudDetectionService } from "../../services/fraudDetectionService";
import WebhookModule from "./webhookModule";
import CacheModule from "./cacheModule";
import VirtualAccountModule from "./virtualAccountModule";

// Temporary type definition for NotificationService
interface NotificationService {
  sendTransactionNotification: (params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: any;
  }) => Promise<void>;
}

// Define WebhookPayload interface to match webhookModule.ts expectations
interface WebhookPayload {
  id: string;
  event: string;
  transactionId: string;
  userId: string;
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  metadata?: Prisma.JsonValue | undefined;
  timestamp: string;
  orderId?: string | undefined;
  entityType?: "SERVICE_ORDER" | "PRODUCT_ORDER" | undefined; // Excludes WALLET_TOPUP
}

interface FlutterwaveBillPaymentResponse {
  status: string;
  message: string;
  data: { tx_ref: string; amount: number; token?: string };
}

interface MeterValidationResponse {
  status: string;
  message: string;
  data: { meterNumber: string; name: string };
}

interface FlutterwavePaymentVerificationResponse {
  status: string;
  message: string;
  data: { id: number; tx_ref: string; amount: number; status: string; payment_type: string; created_at: string };
}

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
  serviceOrderId?: string | null;
  billerCode?: string | null;
}

const prisma = new PrismaClient();

export class BillPaymentModule {
  private notificationService: NotificationService;
  private auditLogService = new AuditLogService();
  private fraudDetectionService = new FraudDetectionService();
  private webhookModule = WebhookModule;
  private cacheModule = CacheModule;
  private virtualAccountModule = VirtualAccountModule;

  constructor() {
    this.notificationService = {
      sendTransactionNotification: async (params) => {
        logger.info("Sending transaction notification", params);
      },
    };
  }

  /**
   * Validates a payment with Flutterwave.
   * @param userId The user ID.
   * @param transactionRef The transaction reference.
   * @returns The updated wallet transaction.
   */
  async validatePayment(userId: string, transactionRef: string): Promise<WalletTransaction> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");
      if (!transactionRef || typeof transactionRef !== "string") throw new Error("Valid transaction reference required");

      await ensureWalletExists(userId);

      const response = await axios.get<FlutterwavePaymentVerificationResponse>(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${transactionRef}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );

      if (response.data.status !== "success" || response.data.data.status !== "successful") {
        throw new Error(`Payment verification failed: ${response.data.message}`);
      }

      const { amount, tx_ref } = response.data.data;

      const transaction = await retry(
        async () => {
          return await prisma.$transaction(async (tx) => {
            const walletTx = await tx.walletTransaction.findFirst({
              where: { payment: { transactionRef: tx_ref }, status: TransactionStatus.PENDING, userId },
              include: { payment: true },
            });

            if (!walletTx || !walletTx.payment) throw new Error(`No pending transaction found for tx_ref: ${tx_ref}`);

            await tx.wallet.update({
              where: { userId },
              data: { balance: { increment: amount }, updatedAt: new Date() },
            });
            await this.cacheModule.invalidateBalanceCache(userId);

            const metadata =
              walletTx.metadata &&
              typeof walletTx.metadata === "object" &&
              !Array.isArray(walletTx.metadata)
                ? {
                    ...walletTx.metadata,
                    webhookStatus: "SENT",
                    serviceFee: (walletTx.metadata as Record<string, any>).serviceFee ?? 0,
                    vat: (walletTx.metadata as Record<string, any>).vat ?? 0,
                  }
                : { webhookStatus: "SENT", serviceFee: 0, vat: 0 };

            const updatedTx = await tx.walletTransaction.update({
              where: { id: walletTx.id },
              data: { status: TransactionStatus.COMPLETED, metadata, updatedAt: new Date() },
            });

            await tx.payment.update({
              where: { id: walletTx.payment.id },
              data: { status: TransactionStatus.COMPLETED, updatedAt: new Date() },
            });

            if (walletTx.serviceOrderId) {
              await tx.serviceOrder.update({
                where: { id: walletTx.serviceOrderId },
                data: { paymentStatus: TransactionStatus.COMPLETED, updatedAt: new Date() },
              });
            }

            const auditLogRequest: AuditLogRequest = {
              userId,
              action: "WALLET_CREDIT",
              entityType: walletTx.serviceOrderId ? "SERVICE_ORDER" : undefined,
              entityId: walletTx.serviceOrderId || walletTx.id,
              details: {
                amount,
                transactionRef: tx_ref,
                walletId: walletTx.walletId,
                serviceFee: metadata.serviceFee,
                vat: metadata.vat,
                serviceType: walletTx.serviceOrderId ? "ELECTRICITY_SUPPLY" : undefined,
                meterNumber: (walletTx.metadata as Record<string, any>)?.meterNumber,
                billType: (walletTx.metadata as Record<string, any>)?.billType,
              },
            };
            await this.auditLogService.log(auditLogRequest);

            await this.notificationService.sendTransactionNotification({
              userId,
              title: "Payment Validated",
              message: `Your payment of ${amount} has been validated.`,
              type: "PAYMENT_VALIDATION",
              metadata: {
                transactionRef: tx_ref,
                entityType: walletTx.serviceOrderId ? "SERVICE_ORDER" : undefined,
                serviceType: walletTx.serviceOrderId ? "ELECTRICITY_SUPPLY" : undefined,
                meterNumber: (walletTx.metadata as Record<string, any>)?.meterNumber,
                billType: (walletTx.metadata as Record<string, any>)?.billType,
                orderId: walletTx.serviceOrderId,
              },
            });

            return updatedTx;
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying payment validation", { userId, attempt, error });
          },
        }
      );

      const webhookPayload: WebhookPayload = {
        id: transaction.id,
        event: `PAYMENT_VALIDATION_${transaction.status}`,
        transactionId: transaction.id,
        userId: transaction.userId,
        amount: transaction.amount.toNumber(),
        status: transaction.status,
        createdAt: transaction.createdAt.toISOString(),
        metadata: transaction.metadata,
        timestamp: new Date().toISOString(),
        orderId: transaction.serviceOrderId ?? undefined,
        entityType: transaction.serviceOrderId ? "SERVICE_ORDER" : undefined,
      };

      await this.webhookModule.triggerWebhook(userId, webhookPayload, `PAYMENT_VALIDATION_${transaction.status}`);

      logger.info("Payment validated", { userId, amount, transactionRef: tx_ref });
      return transaction;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error validating payment", { error: errorMessage, userId, transactionRef });
      await this.auditLogService.log({
        userId,
        action: "PAYMENT_VALIDATION_FAILED",
        details: { error: errorMessage, transactionRef },
        entityType: undefined,
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(
        userId,
        { id: transactionRef, status: TransactionStatus.FAILED, entityType: undefined },
        "PAYMENT_VALIDATION_FAILED"
      );
      throw new Error("Payment validation failed: " + errorMessage);
    }
  }

  /**
   * Processes a bill payment for electricity, optionally using a virtual account.
   * @param userId The user ID.
   * @param amount The payment amount.
   * @param meterNumber The meter number.
   * @param providerId The payment provider ID.
   * @param billType The bill type (PREPAID or POSTPAID).
   * @param useVirtualAccount Whether to use a virtual account for payment.
   * @returns The transaction and bill response.
   */
async processBillPayment(
  userId: string,
  amount: number,
  meterNumber: string,
  providerId: number,
  billType: "PREPAID" | "POSTPAID",
  useVirtualAccount: boolean = false
): Promise<{ transaction: WalletTransaction; billResponse: FlutterwaveBillPaymentResponse }> {
  const entityId = uuidv4();
  try {
    if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");
    if (!amount || typeof amount !== "number" || amount <= 0) throw new Error("Bill payment amount must be positive");
    if (!meterNumber || !/^\d{8,12}$/.test(meterNumber)) throw new Error("Invalid meter number format");
    if (!providerId || typeof providerId !== "number" || providerId <= 0) throw new Error("Valid provider ID required");
    if (!["PREPAID", "POSTPAID"].includes(billType)) throw new Error("Invalid bill type. Must be PREPAID or POSTPAID");

    await ensureWalletExists(userId);
    await this.fraudDetectionService.checkForSuspiciousActivity(
      userId,
      amount,
      "BILL_PAYMENT",
      "SERVICE_ORDER",
      entityId
    );

    const provider = await prisma.paymentProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new Error("Payment provider not found");

    await this.validateMeterNumber(meterNumber, providerId);

    const { transaction, billResponse } = await retry(
      async () => {
        return await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.findUnique({ where: { userId } });
          if (!wallet) throw new Error("Wallet not found");

          const payment = await tx.payment.create({
            data: {
              id: uuidv4(),
              userId,
              providerId,
              transactionRef: `BILL-${entityId}-${Date.now()}`,
              amount,
              paymentMethod: useVirtualAccount ? PaymentMethod.VIRTUAL_ACCOUNT : PaymentMethod.WALLET,
              status: TransactionStatus.PENDING,
              createdAt: new Date(),
              updatedAt: new Date(),
              serviceType: "ELECTRICITY_SUPPLY",
              meterNumber,
            },
          });

          // Generate a unique customerReference
          const customerReference = `CUST-${entityId}-${Date.now()}`;

          // Inline serviceOrder creation with customerReference
          await tx.serviceOrder.create({
            data: {
              id: entityId,
              userId,
              paymentId: payment.id,
              paymentStatus: TransactionStatus.PENDING,
              amountDue: new Prisma.Decimal(amount),
              meterNumber,
              meterType: billType.toLowerCase(),
              billerCode: provider.flutterwave_biller_code,
              status: ServiceOrderStatus.PENDING,
              createdAt: new Date(),
              updatedAt: new Date(),
              paymentMethod: useVirtualAccount ? PaymentMethod.VIRTUAL_ACCOUNT : PaymentMethod.WALLET,
              customerReference, // Added required field
            },
          });

          let virtualAccountTransaction: WalletTransaction | null = null;
          if (useVirtualAccount) {
            virtualAccountTransaction = await this.virtualAccountModule.processVirtualAccountPayment(
              userId,
              amount,
              entityId,
              "SERVICE_ORDER",
              "ELECTRICITY_SUPPLY"
            );

            const validatedVirtualTransaction = await this.virtualAccountModule.validateVirtualAccountPayment(
              userId,
              virtualAccountTransaction.paymentId!
            );

            if (validatedVirtualTransaction.status !== TransactionStatus.COMPLETED) {
              throw new Error("Virtual account payment validation failed");
            }
          }

          const updatedWallet = await tx.wallet.findUnique({ where: { userId } });
          if (!updatedWallet || !updatedWallet.balance.greaterThanOrEqualTo(amount)) {
            throw new Error("Insufficient wallet balance");
          }

          await tx.wallet.update({
            where: { userId },
            data: { balance: { decrement: amount }, updatedAt: new Date() },
          });
          await this.cacheModule.invalidateBalanceCache(userId);

          const transactionData = {
            id: uuidv4(),
            userId,
            walletId: wallet.id,
            amount: new Prisma.Decimal(amount),
            transactionType: TransactionType.DEDUCTION,
            status: TransactionStatus.PENDING,
            serviceOrderId: entityId,
            paymentId: payment.id,
            billerCode: provider.flutterwave_biller_code,
            metadata: {
              webhookStatus: "PENDING",
              serviceType: "ELECTRICITY_SUPPLY",
              meterNumber,
              billType,
            } as Prisma.InputJsonValue,
          };

          const createdTransaction = await tx.walletTransaction.create({ data: transactionData });

          const billResponse = await axios.post<FlutterwaveBillPaymentResponse>(
            "https://api.flutterwave.com/v3/bills",
            {
              country: "NG",
              customer: meterNumber,
              amount,
              type: billType,
              reference: `BILL-${createdTransaction.id}-${Date.now()}`,
            },
            { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_TOKEN}` } }
          );

          let transactionStatus: TransactionStatus;
          let token: string | null = null;
          if (billResponse.data.status === "success") {
            transactionStatus = TransactionStatus.COMPLETED;
            token = billResponse.data.data.token || null;
          } else if (billResponse.data.status === "failed") {
            transactionStatus = TransactionStatus.FAILED;
          } else {
            transactionStatus = TransactionStatus.PENDING;
          }

          const metadata =
            createdTransaction.metadata && typeof createdTransaction.metadata === "object"
              ? {
                  ...createdTransaction.metadata,
                  billReference: billResponse.data.data.tx_ref,
                  token,
                  webhookStatus: transactionStatus === TransactionStatus.COMPLETED ? "SENT" : transactionStatus,
                  virtualAccountTransactionId: virtualAccountTransaction?.id || null,
                }
              : {
                  billReference: billResponse.data.data.tx_ref,
                  token,
                  webhookStatus: transactionStatus === TransactionStatus.COMPLETED ? "SENT" : transactionStatus,
                  virtualAccountTransactionId: virtualAccountTransaction?.id || null,
                  serviceType: "ELECTRICITY_SUPPLY",
                  meterNumber,
                  billType,
                };

          const updatedTransaction = await tx.walletTransaction.update({
            where: { id: createdTransaction.id },
            data: { status: transactionStatus, metadata },
          });

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              transactionRef: billResponse.data.data.tx_ref,
              status: transactionStatus,
              updatedAt: new Date(),
            },
          });

          await tx.serviceOrder.update({
            where: { id: entityId },
            data: {
              paymentStatus: transactionStatus,
              token,
              transactionRef: billResponse.data.data.tx_ref,
              updatedAt: new Date(),
            },
          });

          const auditLogRequest: AuditLogRequest = {
            userId,
            action: `BILL_PAYMENT_${transactionStatus}`,
            details: {
              amount,
              meterNumber,
              providerId,
              billType,
              status: transactionStatus,
              billReference: billResponse.data.data.tx_ref,
              token,
              virtualAccountTransactionId: virtualAccountTransaction?.id || null,
              entityType: "SERVICE_ORDER",
              orderId: entityId,
            },
            entityType: "SERVICE_ORDER",
            entityId,
          };
          await this.auditLogService.log(auditLogRequest);

          await this.notificationService.sendTransactionNotification({
            userId,
            title: `Bill Payment ${transactionStatus}`,
            message: `Your bill payment of ${amount} for meter ${meterNumber} is ${transactionStatus.toLowerCase()}.`,
            type: "BILL_PAYMENT",
            metadata: {
              meterNumber,
              billType,
              billReference: billResponse.data.data.tx_ref,
              token,
              entityType: "SERVICE_ORDER",
              orderId: entityId,
            },
          });

          return { transaction: updatedTransaction, billResponse: billResponse.data };
        });
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onRetry: (error, attempt) => {
          logger.warn("Retrying bill payment", { userId, attempt, error });
        },
      }
    );

    const webhookPayload: WebhookPayload = {
      id: transaction.id,
      event: `BILL_PAYMENT_${transaction.status}`,
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount.toNumber(),
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
      metadata: transaction.metadata,
      timestamp: new Date().toISOString(),
      orderId: entityId,
      entityType: "SERVICE_ORDER",
    };

    await this.webhookModule.triggerWebhook(userId, webhookPayload, `BILL_PAYMENT_${transaction.status}`);

    logger.info("Bill payment processed", { userId, meterNumber, amount, status: transaction.status });
    return { transaction, billResponse };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error processing bill payment", { error: errorMessage, userId, meterNumber });
    await this.auditLogService.log({
      userId,
      action: "BILL_PAYMENT_FAILED",
      details: { error: errorMessage, amount, meterNumber, billType, entityType: "SERVICE_ORDER", orderId: entityId },
      entityType: "SERVICE_ORDER",
      entityId,
    });
    await this.webhookModule.triggerWebhook(
      userId,
      { id: entityId, status: TransactionStatus.FAILED, entityType: "SERVICE_ORDER" },
      "BILL_PAYMENT_FAILED"
    );
    throw new Error("Bill payment failed: " + errorMessage);
  }
}

  /**
   * Validates a meter number with the provider.
   * @param meterNumber The meter number.
   * @param providerId The payment provider ID.
   * @returns The validated meter details.
   */
  async validateMeterNumber(meterNumber: string, providerId: number): Promise<{ meterNumber: string; name: string }> {
    try {
      if (!meterNumber || !/^\d{8,12}$/.test(meterNumber)) {
        throw new Error("Invalid meter number format. Must be 8-12 digits.");
      }
      if (!providerId || typeof providerId !== "number" || providerId <= 0) throw new Error("Valid provider ID required");

      const provider = await prisma.paymentProvider.findUnique({ where: { id: providerId } });
      if (!provider) throw new Error("Payment provider not found");

      const response = await axios.post<MeterValidationResponse>(
        "https://api.flutterwave.com/v3/bill-items/validate",
        {
          item_code: provider.flutterwave_biller_code,
          code: provider.flutterwave_biller_code,
          customer: meterNumber,
        },
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );

      if (response.data.status !== "success") throw new Error(`Meter validation failed: ${response.data.message}`);

      logger.info("Meter validation successful", { meterNumber, providerId });
      return { meterNumber: response.data.data.meterNumber, name: response.data.data.name };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error validating meter number", { error: errorMessage, meterNumber, providerId });
      await this.auditLogService.log({
        userId: "SYSTEM",
        action: "METER_VALIDATION_FAILED",
        details: { error: errorMessage, meterNumber, providerId },
        entityType: "METER_VALIDATION",
        entityId: null,
      });
      throw new Error("Meter validation failed: " + errorMessage);
    }
  }

  /**
   * Reconciles a transaction with Flutterwave.
   * @param transactionRef The transaction reference.
   * @returns The transaction status.
   */
  async reconcileTransaction(transactionRef: string): Promise<TransactionStatus> {
    try {
      const response = await axios.get<FlutterwavePaymentVerificationResponse>(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${transactionRef}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );

      if (response.data.status === "success" && response.data.data.status === "successful") {
        const auditLogRequest: AuditLogRequest = {
          userId: "SYSTEM",
          action: "TRANSACTION_RECONCILED",
          details: { transactionRef, status: TransactionStatus.COMPLETED },
          entityType: "SERVICE_ORDER",
          entityId: transactionRef,
        };
        await this.auditLogService.log(auditLogRequest);
        await this.webhookModule.triggerWebhook(
          null,
          { id: transactionRef, status: TransactionStatus.COMPLETED, entityType: "SERVICE_ORDER" },
          "RECONCILIATION_COMPLETED"
        );
        return TransactionStatus.COMPLETED;
      } else {
        await this.webhookModule.triggerWebhook(
          null,
          { id: transactionRef, status: TransactionStatus.FAILED, entityType: "SERVICE_ORDER" },
          "RECONCILIATION_FAILED"
        );
        return TransactionStatus.FAILED;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error reconciling transaction", { error: errorMessage, transactionRef });
      await this.auditLogService.log({
        userId: "SYSTEM",
        action: "TRANSACTION_RECONCILIATION_FAILED",
        details: { error: errorMessage, transactionRef },
        entityType: "SERVICE_ORDER",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(
        null,
        { id: transactionRef, status: TransactionStatus.FAILED, entityType: "SERVICE_ORDER" },
        "RECONCILIATION_FAILED"
      );
      return TransactionStatus.PENDING;
    }
  }
}

export default new BillPaymentModule();