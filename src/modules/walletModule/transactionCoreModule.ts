import { PrismaClient, PaymentMethod, TransactionType, TransactionStatus, Prisma } from "@prisma/client";
import { ensureWalletExists } from "../../utils/walletUtils";
import { AuditLogService, AuditLogRequest } from "../../services/auditLogService";
import { FraudDetectionService } from "../../services/fraudDetectionService";
import { v4 as uuidv4 } from "uuid";
import retry from "async-retry";
import { logger } from "../../utils/logger";
import WebhookModule from "./webhookModule";
import VoucherModule from "../voucherModule/VoucherModule";
import MonnifyPaymentInitiation from "../PaymentModule/MonnifyPaymentInitiation";
import axios from "axios";
import { WalletTransactionMetadata, WalletTransaction } from "../types/types";

// Define CacheModule interface
interface CacheModule {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { ttl: number }) => Promise<void>;
  invalidateBalanceCache: (userId: string) => Promise<number>;
  invalidateVoucherCache: (voucherCode: string) => Promise<number>;
  getBalance: (userId: string) => Promise<number>;
  getCachedTransactions: (userId: string, limit: number, offset: number) => Promise<any[]>;
  cacheTransactions: (userId: string, transactions: any[], limit: number, offset: number) => Promise<void>;
  getMetrics: () => Promise<any>;
}

interface Voucher {
  id: string;
  code: string;
  discount: Prisma.Decimal;
  type: "PERCENTAGE" | "FIXED";
  maxUses: number | null;
  maxUsesPerUser: number | null;
  uses: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  appliesTo: "PRODUCT" | "SERVICE";
  createdById: string;
  updatedAt: Date;
  updatedById: string | null;
}

interface NotificationService {
  sendTransactionNotification: (params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: any;
  }) => Promise<void>;
}

interface Bank {
  code: string;
  name: string;
}

export class TransactionCoreModule {
  private prisma: PrismaClient = new PrismaClient();
  private notificationService: NotificationService;
  private auditLogService = new AuditLogService();
  private fraudDetectionService = new FraudDetectionService();
  private webhookModule = WebhookModule;
  private voucherModule = VoucherModule;
  private monnifyPaymentInitiation = new MonnifyPaymentInitiation();
  private cacheModule: CacheModule;
  private baseUrl: string = process.env.MONNIFY_BASE_URL || "https://api.monnify.com";

  constructor() {
    this.notificationService = {
      sendTransactionNotification: async (params) => {
        logger.info("Sending transaction notification", params);
      },
    };
    this.cacheModule = require("./cacheModule").default;
  }

  // Utility to convert Prisma.JsonValue to WalletTransactionMetadata | null
  private convertToWalletTransactionMetadata(json: Prisma.JsonValue | undefined | null): WalletTransactionMetadata | null {
    if (!json) return null;
    if (typeof json !== "object" || Array.isArray(json)) return null;

    const metadata = json as WalletTransactionMetadata;

    return {
      isWalletTopUp: metadata.isWalletTopUp ?? undefined,
      paymentLink: metadata.paymentLink ?? null,
      serviceType: metadata.serviceType ?? null,
      productType: metadata.productType ?? null,
      webhookStatus: metadata.webhookStatus ?? "PENDING",
      serviceFee: metadata.serviceFee ?? undefined,
      vat: metadata.vat ?? undefined,
      petroleumTax: metadata.petroleumTax ?? undefined,
      voucherCode: metadata.voucherCode ?? undefined,
      voucherDiscount: metadata.voucherDiscount ?? undefined,
      isPartial: metadata.isPartial ?? undefined,
      originalTransactionId: metadata.originalTransactionId ?? undefined,
      purpose: metadata.purpose ?? undefined,
      virtualAccountId: metadata.virtualAccountId ?? undefined,
      vendorId: metadata.vendorId ?? undefined,
      adminMerchantAccount: metadata.adminMerchantAccount ?? undefined,
      refundReference: metadata.refundReference ?? undefined,
      monnifyRef: metadata.monnifyRef ?? undefined,
      ...metadata,
    };
  }

  // Authenticate with Monnify to get access token
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
      if (!response.data.requestSuccessful || !response.data.responseBody.accessToken) {
        throw new Error("Failed to authenticate with Monnify");
      }
      return response.data.responseBody.accessToken;
    } catch (error: any) {
      logger.error("Failed to get Monnify auth token", { message: error.message });
      throw new Error(`Unable to authenticate with Monnify: ${error.message}`);
    }
  }

  // Fetch valid service types from database
  private async getValidServiceTypes(): Promise<string[]> {
    const serviceTypes = await this.prisma.serviceType.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return serviceTypes.map((st) => st.name);
  }

  // Fetch valid product types from database
  private async getValidProductTypes(): Promise<string[]> {
    const productTypes = await this.prisma.productType.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return productTypes.map((pt) => pt.name);
  }

  // Queue audit log for transaction events
  async queueAuditLog(params: {
    userId: string;
    action: string;
    details: Record<string, any>;
    entityType: string;
    entityId: string | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: params.userId,
          action: params.action,
          details: params.details as Prisma.InputJsonValue,
          entityType: params.entityType,
          entityId: params.entityId,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Failed to queue audit log", { error, params });
      throw new Error(`Failed to queue audit log: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Fetch list of banks from Monnify
  private async getBanks(): Promise<Bank[]> {
    const cacheKey = "monnify_banks";
    try {
      const cachedBanks = await this.cacheModule.get(cacheKey);
      if (cachedBanks) {
        return JSON.parse(cachedBanks) as Bank[];
      }

      const token = await this.getMonnifyAuthToken();
      const response = await axios.get(`${this.baseUrl}/api/v1/banks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data.requestSuccessful || !Array.isArray(response.data.responseBody)) {
        throw new Error("Failed to fetch banks from Monnify");
      }

      const banks = response.data.responseBody.map((bank: any) => ({
        code: bank.code,
        name: bank.name,
      }));
      await this.cacheModule.set(cacheKey, JSON.stringify(banks), { ttl: 86400 });
      return banks;
    } catch (error) {
      logger.error("Error fetching banks", { error });
      throw new Error(`Failed to fetch banks: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Get bank code by name
  private async getBankCode(bankName: string): Promise<string> {
    try {
      const banks = await this.getBanks();
      const bank = banks.find((b) => b.name.toLowerCase() === bankName.toLowerCase());
      if (!bank) {
        throw new Error(`Bank not found: ${bankName}`);
      }
      return bank.code;
    } catch (error) {
      logger.error("Error getting bank code", { bankName, error });
      throw error;
    }
  }

  // Get bank name by code
  private async getBankName(bankCode: string): Promise<string> {
    try {
      const banks = await this.getBanks();
      const bank = banks.find((b) => b.code === bankCode);
      if (!bank) {
        throw new Error(`Bank not found for code: ${bankCode}`);
      }
      return bank.name;
    } catch (error) {
      logger.error("Error getting bank name", { bankCode, error });
      throw error;
    }
  }

  // Fetch wallet balance from Monnify
  async getWalletBalance(walletReference: string): Promise<{ availableBalance: number; ledgerBalance: number }> {
    try {
      const token = await this.getMonnifyAuthToken();
      const response = await axios.get(`${this.baseUrl}/api/v1/disbursements/wallet/balance`, {
        params: { accountNumber: walletReference },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Failed to fetch wallet balance: ${response.data.responseMessage}`);
      }

      return {
        availableBalance: parseFloat(response.data.responseBody.availableBalance),
        ledgerBalance: parseFloat(response.data.responseBody.ledgerBalance),
      };
    } catch (error) {
      logger.error("Error fetching wallet balance from Monnify", { walletReference, error });
      throw new Error(`Failed to fetch wallet balance: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Fetch wallet transactions from Monnify
  async getWalletTransactions(accountNumber: string): Promise<WalletTransaction[]> {
    try {
      const token = await this.getMonnifyAuthToken();
      const response = await axios.get(`${this.baseUrl}/api/v1/disbursements/wallet/transactions`, {
        params: { accountNumber },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Failed to fetch wallet transactions: ${response.data.responseMessage}`);
      }

      const monnifyTransactions = response.data.responseBody.content || [];

      const transactions: WalletTransaction[] = monnifyTransactions.map((tx: any) => {
        const metadata: WalletTransactionMetadata = {
          webhookStatus: tx.webhookStatus || "PENDING",
          monnifyRef: tx.transactionReference || null,
          paymentLink: tx.paymentLink || null,
          serviceType: tx.serviceType || null,
          productType: tx.productType || null,
          ...tx.metadata,
        };

        return {
          id: tx.transactionReference || uuidv4(),
          userId: tx.customerId || "",
          walletId: accountNumber,
          amount: new Prisma.Decimal(tx.amount || 0),
          transactionType: tx.transactionType as TransactionType | null,
          status: tx.status as TransactionStatus || TransactionStatus.PENDING,
          paymentId: tx.paymentId || null,
          createdAt: new Date(tx.createdAt || Date.now()),
          updatedAt: new Date(tx.updatedAt || Date.now()),
          metadata,
          serviceOrderId: tx.serviceOrderId || null,
          electricityProviderId: tx.electricityProviderId || null,
        };
      });

      return transactions;
    } catch (error) {
      logger.error("Error fetching wallet transactions from Monnify", { accountNumber, error });
      throw new Error(`Failed to fetch wallet transactions: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Deposit funds into wallet
  async depositFunds(
    userId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    transactionRef?: string,
    cardDetails?: {
      cardno: string;
      cvv: string;
      expirymonth: string;
      expiryyear: string;
      pin?: string;
      suggested_auth?: string;
      billingzip?: string;
      billingcity?: string;
      billingaddress?: string;
      billingstate?: string;
      billingcountry?: string;
    }
  ): Promise<WalletTransaction> {
    const ref = transactionRef ?? `DEPOSIT-${uuidv4()}-${Date.now()}`;

    if (typeof amount !== "number" || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }

    logger.info("Initiating wallet deposit", {
      userId,
      amount,
      paymentMethod,
      transactionRef: ref,
    });

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");

      const wallet = await this.prisma.wallet.findFirst({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      // Ensure wallet exists and check for suspicious activity
      await ensureWalletExists(userId);
      await this.fraudDetectionService.checkForSuspiciousActivity(
        userId,
        amount,
        "DEPOSIT",
        "WALLET_TRANSACTION",
        ref
      );

      // Initiate payment via Monnify
      const paymentResult = await this.monnifyPaymentInitiation.processPayment(
        userId,
        amount,
        paymentMethod,
        "wallet_topup",
        undefined,
        ref,
        undefined,
        cardDetails,
        true
      );

      const transaction = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            id: uuidv4(),
            userId,
            transactionRef: ref,
            monnifyRef: paymentResult.paymentDetails?.paymentReference,
            amount: paymentResult.paymentDetails?.totalAmount ?? amount,
            requestedAmount: amount,
            status: TransactionStatus.PENDING,
            paymentMethod,
            paymentDetails: paymentResult.paymentDetails as Prisma.InputJsonValue,
          },
        });

        // Prepare transaction metadata
        const metadata: WalletTransactionMetadata = {
          isWalletTopUp: true,
          paymentLink: paymentResult.redirectUrl,
          webhookStatus: "PENDING",
          serviceFee: paymentResult.paymentDetails?.serviceFee ?? 0,
          vat: paymentResult.paymentDetails?.vat ?? 0,
        };

        // Create wallet transaction
        const transactionData: Prisma.WalletTransactionCreateInput = {
          id: uuidv4(),
          user: { connect: { id: userId } },
          wallet: { connect: { id: wallet.id } },
          amount: new Prisma.Decimal(paymentResult.paymentDetails?.totalAmount ?? amount),
          transactionType: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
          payment: { connect: { id: payment.id } },
          metadata: metadata as Prisma.InputJsonValue,
        };

        const transaction = await tx.walletTransaction.create({ data: transactionData });

        // Log audit
        await tx.auditLog.create({
          data: {
            id: uuidv4(),
            userId,
            action: "DEPOSIT_INITIATED",
            entityType: "WALLET_TRANSACTION",
            entityId: transaction.id,
            details: {
              amount,
              transactionRef: ref,
              walletId: wallet.id,
              paymentMethod,
              status: TransactionStatus.PENDING,
            } as Prisma.InputJsonValue,
          },
        });

        return transaction;
      });

      // Trigger webhook
      await this.webhookModule.triggerWebhook(
        userId,
        {
          id: transaction.id,
          amount: transaction.amount.toNumber(),
          status: transaction.status,
          createdAt: transaction.createdAt.toISOString(),
          metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
          userId: transaction.userId,
          orderId: ref,
          entityType: "WALLET_TOPUP",
        },
        "DEPOSIT_PENDING"
      );

      logger.info("Wallet deposit initiated successfully", {
        userId,
        transactionId: transaction.id,
        amount,
        paymentMethod,
        transactionRef: ref,
      });

      return {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error processing wallet deposit", { userId, transactionRef: ref, error: errorMessage });
      await this.queueAuditLog({
        userId,
        action: "DEPOSIT_FAILED",
        details: { transactionRef: ref, amount, paymentMethod, error: errorMessage },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      throw new Error(`Deposit failed: ${errorMessage}`);
    }
  }

  // Process payment from wallet
  async payWithWallet(
    userId: string,
    amount: number,
    orderId: string,
    serviceType: string | null,
    productType: string | null,
    serviceCharge: number,
    vatRate: number,
    petroleumTax: number,
    voucherCode?: string
  ): Promise<WalletTransaction> {
    try {
      // Validate inputs
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format: must be a valid UUID");
      }
      if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new Error("Payment amount must be positive");
      }
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        throw new Error("Invalid orderId format: must be a valid UUID");
      }
      if (serviceType && productType) {
        throw new Error("Cannot specify both serviceType and productType");
      }
      if (!serviceType && !productType) {
        throw new Error("Either serviceType or productType is required");
      }

      // Validate serviceType or productType
      if (serviceType) {
        const validServiceTypes = await this.getValidServiceTypes();
        if (!validServiceTypes.includes(serviceType)) {
          throw new Error(`Invalid serviceType: must be one of ${validServiceTypes.join(", ")}`);
        }
      }
      if (productType) {
        const validProductTypes = await this.getValidProductTypes();
        if (!validProductTypes.includes(productType)) {
          throw new Error(`Invalid productType: must be one of ${validProductTypes.join(", ")}`);
        }
      }

      // Ensure wallet exists and check for suspicious activity
      await ensureWalletExists(userId);
      await this.fraudDetectionService.checkForSuspiciousActivity(
        userId,
        amount,
        "PAYMENT",
        serviceType ? "SERVICE_ORDER" : "PRODUCT_ORDER",
        orderId
      );

      // Fetch order details
      const serviceOrder = serviceType
        ? await this.prisma.serviceOrder.findUnique({
            where: { id: orderId },
            include: { vendor: true, admin: true },
          })
        : null;

      const productOrder = productType
        ? await this.prisma.productOrder.findUnique({
            where: { id: orderId },
            include: { vendor: true },
          })
        : null;

      if (!serviceOrder && !productOrder) {
        throw new Error("Order not found");
      }

      // Determine vendor or admin recipient
      let vendorId: string | null = null;
      let isAdminOrder = false;
      if (serviceOrder) {
        if (serviceOrder.adminId) {
          isAdminOrder = true;
        } else if (serviceOrder.vendorId) {
          const vendorProfile = await this.prisma.profile.findUnique({ where: { id: serviceOrder.vendorId } });
          vendorId = vendorProfile?.userId || null;
        }
      } else if (productOrder && productOrder.vendorId) {
        const vendorProfile = await this.prisma.profile.findUnique({ where: { id: productOrder.vendorId } });
        vendorId = vendorProfile?.userId || null;
      }

      // Apply voucher if provided
      let voucherDiscount = 0;
      let voucher: Voucher | undefined;
      if (voucherCode) {
        const appliesTo = serviceType ? "SERVICE" : "PRODUCT";
        const result = await this.voucherModule.applyVoucher(userId, voucherCode, appliesTo, orderId, amount);
        voucherDiscount = result.discountAmount;
        voucher = result.voucher;
      }

      // Calculate total amount
      const vat = amount * vatRate;
      const tax = amount * petroleumTax;
      const totalAmount = amount + serviceCharge + vat + tax - voucherDiscount;

      if (totalAmount < 0) {
        throw new Error("Total amount cannot be negative after applying voucher");
      }

      const transaction = await retry(
        async () => {
          return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet || wallet.balance.toNumber() < totalAmount) {
              throw new Error("Insufficient wallet balance");
            }

            // Deduct from wallet
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { decrement: totalAmount }, updatedAt: new Date() },
            });
            await this.cacheModule.invalidateBalanceCache(userId);

            // Create transaction record
            const metadata: WalletTransactionMetadata = {
              voucherCode,
              voucherDiscount,
              serviceCharge,
              vat,
              petroleumTax: tax,
              webhookStatus: "PENDING",
              vendorId,
              isAdminOrder,
              serviceType,
              productType,
            };

            const transactionData: Prisma.WalletTransactionCreateInput = {
              id: uuidv4(),
              user: { connect: { id: userId } },
              wallet: { connect: { id: wallet.id } },
              amount: new Prisma.Decimal(totalAmount),
              transactionType: TransactionType.DEDUCTION,
              status: TransactionStatus.PENDING,
              serviceOrder: serviceType ? { connect: { id: orderId } } : undefined,
              productOrder: productType ? { connect: { id: orderId } } : undefined,
              metadata: metadata as Prisma.InputJsonValue,
            };

            const createdTransaction = await tx.walletTransaction.create({ data: transactionData });

            // Transfer to vendor or admin via Monnify
            const recipientId = isAdminOrder ? (serviceOrder?.adminId ?? null) : vendorId;
            if (recipientId) {
              const recipientAccount = await tx.virtualAccount.findFirst({
                where: { userId: recipientId, isVendorMain: true, status: "ACTIVE" },
              });
              if (!recipientAccount) {
                throw new Error("Recipient virtual account not found");
              }

              const token = await this.getMonnifyAuthToken();
              const transferResponse = await axios.post(
                `${this.baseUrl}/api/v2/disbursements/single`,
                {
                  amount,
                  reference: `TRANSFER-MAIN-${uuidv4()}-${Date.now()}`,
                  narration: `Payment for order ${orderId} - Main amount`,
                  destinationBankCode: await this.getBankCode(recipientAccount.bankName),
                  destinationAccountNumber: recipientAccount.accountNumber,
                  currency: "NGN",
                  sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT_NUMBER,
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (!transferResponse.data.requestSuccessful || transferResponse.data.responseCode !== "0") {
                throw new Error(`Failed to initiate transfer: ${transferResponse.data.responseMessage}`);
              }
            }

            // Transfer fees to admin account
            const adminAccount = await tx.quicrifillWallet.findFirst();
            if (adminAccount && (serviceCharge > 0 || vat > 0 || tax > 0)) {
              const adminFees = serviceCharge + vat + tax;
              const token = await this.getMonnifyAuthToken();
              const transferResponse = await axios.post(
                `${this.baseUrl}/api/v2/disbursements/single`,
                {
                  amount: adminFees,
                  reference: `TRANSFER-FEES-${uuidv4()}-${Date.now()}`,
                  narration: `Fees for order ${orderId} (Service: ${serviceCharge}, VAT: ${vat}, Tax: ${tax})`,
                  destinationBankCode: await this.getBankCode(adminAccount.bankName),
                  destinationAccountNumber: adminAccount.accountNumber,
                  currency: "NGN",
                  sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT_NUMBER,
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (!transferResponse.data.requestSuccessful || transferResponse.data.responseCode !== "0") {
                throw new Error(`Failed to initiate admin fees transfer: ${transferResponse.data.responseMessage}`);
              }
            }

            // Update transaction status
            await tx.walletTransaction.update({
              where: { id: createdTransaction.id },
              data: { status: TransactionStatus.COMPLETED, updatedAt: new Date() },
            });

            // Update voucher usage
            if (voucher && voucherCode) {
              await tx.voucher.update({
                where: { id: voucher.id },
                data: { uses: { increment: 1 } },
              });
              await tx.voucherUsage.create({
                data: {
                  voucherId: voucher.id,
                  userId,
                  usedAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            // Send notification
            await this.notificationService.sendTransactionNotification({
              userId,
              title: "Payment Successful",
              message: `Your wallet was debited ${totalAmount.toFixed(2)} for order ${orderId}.`,
              type: "PAYMENT",
              metadata: { serviceType, productType, voucherCode, voucherDiscount, serviceCharge, vat, petroleumTax: tax },
            });

            // Log audit
            const auditLogRequest: AuditLogRequest = {
              userId,
              action: "PAYMENT_COMPLETED",
              details: {
                amount: totalAmount,
                orderId,
                serviceType,
                productType,
                voucherCode,
                voucherDiscount,
                serviceCharge,
                vat,
                petroleumTax: tax,
                recipientId,
              },
              entityType: "WALLET_TRANSACTION",
              entityId: createdTransaction.id,
            };
            await this.auditLogService.log(auditLogRequest);

            return createdTransaction;
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying payment transaction", { userId, attempt, error });
          },
        }
      );

      // Trigger webhook
      await this.webhookModule.triggerWebhook(userId, {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      }, `PAYMENT_${transaction.status}`);

      logger.info("Payment processed", { userId, transactionId: transaction.id, totalAmount });
      return {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error processing wallet payment", { error: errorMessage, userId, orderId, serviceType, productType });
      await this.queueAuditLog({
        userId,
        action: "PAYMENT_FAILED",
        details: { error: errorMessage, amount, orderId, serviceType, productType, voucherCode },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(userId, { id: orderId, status: TransactionStatus.FAILED }, "PAYMENT_FAILED");
      throw new Error(`Wallet payment failed: ${errorMessage}`);
    }
  }

  // Process refund to wallet or external account
  async refundFunds(
    userId: string,
    amount: number,
    orderId: string,
    serviceType: string | null,
    productType: string | null,
    isPartial: boolean = false,
    destinationAccountNumber?: string,
    destinationBankCode?: string
  ): Promise<WalletTransaction> {
    try {
      // Validate inputs
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format: must be a valid UUID");
      }
      if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new Error("Refund amount must be positive");
      }
      if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        throw new Error("Invalid orderId format: must be a valid UUID");
      }
      if (serviceType && productType) {
        throw new Error("Cannot specify both serviceType and productType");
      }
      if (!serviceType && !productType) {
        throw new Error("Either serviceType or productType is required");
      }

      // Validate serviceType or productType
      if (serviceType) {
        const validServiceTypes = await this.getValidServiceTypes();
        if (!validServiceTypes.includes(serviceType)) {
          throw new Error(`Invalid serviceType: must be one of ${validServiceTypes.join(", ")}`);
        }
      }
      if (productType) {
        const validProductTypes = await this.getValidProductTypes();
        if (!validProductTypes.includes(productType)) {
          throw new Error(`Invalid productType: must be one of ${validProductTypes.join(", ")}`);
        }
      }

      // Ensure wallet exists and check for suspicious activity
      await ensureWalletExists(userId);
      await this.fraudDetectionService.checkForSuspiciousActivity(
        userId,
        amount,
        "REFUND",
        serviceType ? "SERVICE_ORDER" : "PRODUCT_ORDER",
        orderId
      );

      const transaction = await retry(
        async () => {
          return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Verify original transaction
            const originalTransactionRaw = await tx.walletTransaction.findFirst({
              where: {
                serviceOrderId: serviceType ? orderId : undefined,
                productOrderId: productType ? orderId : undefined,
                transactionType: TransactionType.DEDUCTION,
                status: TransactionStatus.COMPLETED,
              },
            });

            if (!originalTransactionRaw) {
              throw new Error("No valid transaction found for refund");
            }

            const originalTransaction: WalletTransaction = {
              ...originalTransactionRaw,
              metadata: this.convertToWalletTransactionMetadata(originalTransactionRaw.metadata),
            };

            if (!isPartial && originalTransaction.amount.toNumber() < amount) {
              throw new Error("Refund amount exceeds original transaction amount");
            }

            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
              throw new Error("Wallet not found");
            }

            // Initiate refund via Monnify if destination account is provided
            let refundReference: string | undefined;
            if (destinationAccountNumber && destinationBankCode) {
              const token = await this.getMonnifyAuthToken();
              const refundResponse = await axios.post(
                `${this.baseUrl}/api/v1/refunds/initiate-refund`,
                {
                  transactionReference: originalTransaction.id,
                  refundReference: `REFUND-${uuidv4()}-${Date.now()}`,
                  refundAmount: amount,
                  refundReason: `Refund for order ${orderId}`,
                  customerNote: `Refund for ${isPartial ? "partial" : "full"} order ${orderId}`,
                  destinationAccountNumber,
                  destinationAccountBankCode: destinationBankCode,
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );

              if (!refundResponse.data.requestSuccessful || refundResponse.data.responseCode !== "0") {
                throw new Error(`Failed to initiate refund: ${refundResponse.data.responseMessage}`);
              }
              refundReference = refundResponse.data.responseBody.refundReference;
            } else {
              // Refund to wallet
              await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount }, updatedAt: new Date() },
              });
              await this.cacheModule.invalidateBalanceCache(userId);
            }

            // Create refund transaction
            const metadata: WalletTransactionMetadata = {
              isPartial,
              originalTransactionId: originalTransaction.id,
              webhookStatus: "PENDING",
              serviceType,
              productType,
              refundReference,
            };

            const transactionData: Prisma.WalletTransactionCreateInput = {
              id: uuidv4(),
              user: { connect: { id: userId } },
              wallet: { connect: { id: wallet.id } },
              amount: new Prisma.Decimal(amount),
              transactionType: TransactionType.REFUND,
              status: TransactionStatus.COMPLETED,
              serviceOrder: serviceType ? { connect: { id: orderId } } : undefined,
              productOrder: productType ? { connect: { id: orderId } } : undefined,
              metadata: metadata as Prisma.InputJsonValue,
            };

            const createdTransaction = await tx.walletTransaction.create({ data: transactionData });

            // Send notification
            await this.notificationService.sendTransactionNotification({
              userId,
              title: `${isPartial ? "Partial " : ""}Refund Processed`,
              message: `A ${isPartial ? "partial " : ""}refund of ${amount.toFixed(2)} has been credited to your wallet for order ${orderId}.`,
              type: "REFUND",
              metadata: { serviceType, productType, isPartial, orderId, refundReference },
            });

            // Log audit
            const auditLogRequest: AuditLogRequest = {
              userId,
              action: "REFUND_COMPLETED",
              details: {
                amount,
                orderId,
                serviceType,
                productType,
                isPartial,
                refundReference,
              },
              entityType: "WALLET_TRANSACTION",
              entityId: createdTransaction.id,
            };
            await this.auditLogService.log(auditLogRequest);

            return createdTransaction;
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying refund transaction", { userId, attempt, error });
          },
        }
      );

      // Trigger webhook
      await this.webhookModule.triggerWebhook(userId, {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      }, `REFUND_${transaction.status}`);

      logger.info("Refund processed", { userId, transactionId: transaction.id, amount, orderId });
      return {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error processing refund", { error: errorMessage, userId, orderId, serviceType, productType });
      await this.queueAuditLog({
        userId,
        action: "REFUND_FAILED",
        details: { error: errorMessage, amount, orderId, serviceType, productType },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(userId, { id: orderId, status: TransactionStatus.FAILED }, "REFUND_FAILED");
      throw new Error(`Refund failed: ${errorMessage}`);
    }
  }

  // Process withdrawal to external bank account
  async withdrawFunds(
    userId: string,
    amount: number,
    bankAccountNumber: string,
    bankCode: string
  ): Promise<WalletTransaction> {
    try {
      // Validate inputs
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Invalid userId format: must be a valid UUID");
      }
      if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new Error("Transfer amount must be positive");
      }
      if (!bankAccountNumber || !/^\d{10}$/.test(bankAccountNumber)) {
        throw new Error("Invalid bank account number");
      }
      if (!bankCode) {
        throw new Error("Valid bank code required");
      }

      // Validate bank code
      const banks = await this.getBanks();
      if (!banks.some((b) => b.code === bankCode)) {
        throw new Error(`Invalid bank code: ${bankCode}`);
      }

      // Verify user and permissions
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error("User not found");
      }
      if (!user.isVendor && !user.isAdmin && !user.isDeliveryAgent) {
        throw new Error("Only vendors, admins, or permitted delivery agents can withdraw funds");
      }

      // Ensure wallet exists and check for suspicious activity
      await ensureWalletExists(userId);
      const entityId = uuidv4();
      await this.fraudDetectionService.checkForSuspiciousActivity(
        userId,
        amount,
        "WITHDRAWAL",
        "WALLET_TRANSACTION",
        entityId
      );

      // Check delivery agent withdrawal permissions
      if (user.isDeliveryAgent) {
        const config = await this.prisma.vendorWalletConfig.findFirst({
          where: { deliveryAgentId: (await this.prisma.wallet.findUnique({ where: { userId } }))!.id },
        });
        if (!config?.withdrawalEnabled) {
          throw new Error("Withdrawal not permitted for this delivery agent");
        }
      }

      // Check withdrawal limits
      const walletSettings = await this.prisma.walletSettings.findUnique({ where: { userId } });
      if (walletSettings?.withdrawalLimitSingle && amount > walletSettings.withdrawalLimitSingle.toNumber()) {
        throw new Error("Withdrawal amount exceeds single transaction limit");
      }
      if (walletSettings?.withdrawalLimitDaily) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const withdrawalsToday = await this.prisma.walletTransaction.aggregate({
          where: {
            userId,
            transactionType: TransactionType.WITHDRAWAL,
            createdAt: { gte: today },
          },
          _sum: { amount: true },
        });
        const totalWithdrawnToday = withdrawalsToday._sum.amount?.toNumber() || 0;
        if (totalWithdrawnToday + amount > walletSettings.withdrawalLimitDaily.toNumber()) {
          throw new Error("Withdrawal amount exceeds daily limit");
        }
      }

      const transaction = await retry(
        async () => {
          return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet || wallet.balance.toNumber() < amount) {
              throw new Error("Insufficient wallet balance");
            }

            // Deduct from wallet
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { decrement: amount }, updatedAt: new Date() },
            });
            await this.cacheModule.invalidateBalanceCache(userId);

            // Initiate withdrawal via Monnify
            const transactionRef = `WITHDRAWAL-${uuidv4()}-${Date.now()}`;
            const token = await this.getMonnifyAuthToken();
            const transferResponse = await axios.post(
              `${this.baseUrl}/api/v2/disbursements/single`,
              {
                amount,
                reference: transactionRef,
                narration: `Withdrawal from wallet for user ${userId}`,
                destinationBankCode: bankCode,
                destinationAccountNumber: bankAccountNumber,
                currency: "NGN",
                sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT_NUMBER,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!transferResponse.data.requestSuccessful || transferResponse.data.responseCode !== "0") {
              throw new Error(`Failed to initiate withdrawal: ${transferResponse.data.responseMessage}`);
            }

            // Create transaction record
            const metadata: WalletTransactionMetadata = {
              purpose: "Withdrawal to external bank account",
              webhookStatus: "PENDING",
              bankAccountNumber,
              bankCode,
              monnifyRef: transactionRef,
            };

            const transactionData: Prisma.WalletTransactionCreateInput = {
              id: uuidv4(),
              user: { connect: { id: userId } },
              wallet: { connect: { id: wallet.id } },
              amount: new Prisma.Decimal(amount),
              transactionType: TransactionType.WITHDRAWAL,
              status: transferResponse.data.responseBody.status === "SUCCESS" ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
              metadata: metadata as Prisma.InputJsonValue,
            };

            const createdTransaction = await tx.walletTransaction.create({ data: transactionData });

            // Create withdrawal record
            await tx.withdrawal.create({
              data: {
                id: uuidv4(),
                userId,
                walletId: wallet.id,
                amount: new Prisma.Decimal(amount),
                bankName: await this.getBankName(bankCode),
                accountNumber: bankAccountNumber,
                status: transferResponse.data.responseBody.status === "SUCCESS" ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
                transactionRef,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // Send notification
            await this.notificationService.sendTransactionNotification({
              userId,
              title: "Withdrawal Initiated",
              message: `A withdrawal of ${amount.toFixed(2)} to account ${bankAccountNumber} has been initiated.`,
              type: "WITHDRAWAL",
              metadata: { bankAccountNumber, bankCode, transactionRef },
            });

            // Log audit
            const auditLogRequest: AuditLogRequest = {
              userId,
              action: "WITHDRAWAL_INITIATED",
              details: { amount, bankAccountNumber, bankCode, transactionRef },
              entityType: "WALLET_TRANSACTION",
              entityId: createdTransaction.id,
            };
            await this.auditLogService.log(auditLogRequest);

            return createdTransaction;
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying withdrawal transaction", { userId, attempt, error });
          },
        }
      );

      // Trigger webhook
      await this.webhookModule.triggerWebhook(userId, {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      }, `WITHDRAWAL_${transaction.status}`);

      logger.info("Withdrawal processed", { userId, transactionId: transaction.id, amount });
      return {
        ...transaction,
        metadata: this.convertToWalletTransactionMetadata(transaction.metadata),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error processing withdrawal", { error: errorMessage, userId, bankAccountNumber });
      await this.queueAuditLog({
        userId,
        action: "WITHDRAWAL_FAILED",
        details: { error: errorMessage, amount, bankAccountNumber, bankCode },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(userId, { id: uuidv4(), status: TransactionStatus.FAILED }, "WITHDRAWAL_FAILED");
      throw new Error(`Withdrawal failed: ${errorMessage}`);
    }
  }

  // Set withdrawal limits for a user
  async setWithdrawalLimits(
    adminId: string,
    targetUserId: string,
    dailyLimit: number,
    singleLimit: number
  ): Promise<void> {
    try {
      // Validate inputs
      if (!adminId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) {
        throw new Error("Invalid adminId format: must be a valid UUID");
      }
      if (!targetUserId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
        throw new Error("Invalid targetUserId format: must be a valid UUID");
      }
      if (typeof dailyLimit !== "number" || dailyLimit < 0) {
        throw new Error("Daily limit must be a non-negative number");
      }
      if (typeof singleLimit !== "number" || singleLimit < 0) {
        throw new Error("Single transaction limit must be a non-negative number");
      }

      // Verify admin permissions
      const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
      if (!admin || !admin.isAdmin) {
        throw new Error("Only admins can set withdrawal limits");
      }

      // Verify target user
      const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser || (!targetUser.isVendor && !targetUser.isDeliveryAgent)) {
        throw new Error("Target user must be a vendor or delivery agent");
      }

      // Ensure wallet exists
      const wallet = await this.prisma.wallet.findUnique({ where: { userId: targetUserId } });
      if (!wallet) {
        throw new Error("Wallet not found for target user");
      }

      // Update or create wallet settings
      await this.prisma.walletSettings.upsert({
        where: { userId: targetUserId },
        update: {
          withdrawalLimitDaily: new Prisma.Decimal(dailyLimit),
          withdrawalLimitSingle: new Prisma.Decimal(singleLimit),
          updatedAt: new Date(),
        },
        create: {
          id: uuidv4(),
          userId: targetUserId,
          walletId: wallet.id,
          withdrawalLimitDaily: new Prisma.Decimal(dailyLimit),
          withdrawalLimitSingle: new Prisma.Decimal(singleLimit),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Send notification
      await this.notificationService.sendTransactionNotification({
        userId: targetUserId,
        title: "Withdrawal Limits Updated",
        message: `Your withdrawal limits have been updated. Daily: ${dailyLimit}, Single: ${singleLimit}.`,
        type: "WITHDRAWAL_LIMIT_UPDATE",
        metadata: { dailyLimit, singleLimit, adminId },
      });

      // Log audit
      const auditLogRequest: AuditLogRequest = {
        userId: adminId,
        action: "WITHDRAWAL_LIMITS_SET",
        details: { targetUserId, dailyLimit, singleLimit },
        entityType: "WALLET_SETTINGS",
        entityId: targetUserId,
      };
      await this.auditLogService.log(auditLogRequest);

      logger.info("Withdrawal limits set", { adminId, targetUserId, dailyLimit, singleLimit });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error setting withdrawal limits", { error: errorMessage, adminId, targetUserId });
      await this.queueAuditLog({
        userId: adminId,
        action: "WITHDRAWAL_LIMITS_SET_FAILED",
        details: { error: errorMessage, targetUserId, dailyLimit, singleLimit },
        entityType: "WALLET_SETTINGS",
        entityId: null,
      });
      throw new Error(`Failed to set withdrawal limits: ${errorMessage}`);
    }
  }
}

export default new TransactionCoreModule();