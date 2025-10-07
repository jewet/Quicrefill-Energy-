import { PrismaClient, PaymentMethod, TransactionType, TransactionStatus, Prisma } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";
import { AuditLogService, AuditLogRequest } from "../../services/auditLogService";
import { FraudDetectionService } from "../../services/fraudDetectionService";
import { ensureWalletExists } from "../../utils/walletUtils";
import WebhookModule from "./webhookModule";
import MonnifyService, { MonnifyVirtualAccountResponse } from "../../services/MonnifyService";

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

// Define interfaces for paymentDetails
interface PaymentDetails {
  virtualAccountId: string;
  accountNumber: string;
  bankName: string;
  orderId?: string; // Explicitly define orderId as optional
}

// Define WalletTransaction interface aligned with Prisma schema
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
  orderId?: string | null; // Aligned with Prisma schema
  electricityProviderId?: number | null;
  billerCode?: string | null;
  transactionRef?: string | null;
  vendorId?: string | null;
}

// Define VirtualAccount interface aligned with Prisma schema
interface VirtualAccount {
  id: string;
  userId: string;
  walletId: string;
  accountNumber: string;
  bankName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  monnifyRef: string;
  isVendorMain: boolean;
  vendorId?: string | null;
  metadata?: Prisma.JsonValue | null;
}

// Define NotificationService interface
interface NotificationService {
  sendTransactionNotification: (params: {
    userId: string;
    title: string;
    message: string;
    type: string;
    metadata?: any;
  }) => Promise<void>;
}

// Define Bank interface
interface Bank {
  code: string;
  name: string;
}

const prisma = new PrismaClient();
const cacheModule: CacheModule = require("./cacheModule").default;

export class VirtualAccountModule {
  private notificationService: NotificationService;
  private auditLogService = new AuditLogService();
  private fraudDetectionService = new FraudDetectionService();
  private webhookModule = WebhookModule;
  private cacheModule = cacheModule;
  private monnifyService = MonnifyService;

  constructor() {
    this.notificationService = {
      sendTransactionNotification: async (params) => {
        logger.info("Sending transaction notification", params);
      },
    };
  }

  /**
   * Fetches valid product types from the database.
   * @returns Array of valid product type names.
   */
  private async getValidProductTypes(): Promise<string[]> {
    const productTypes = await prisma.productType.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return productTypes.map((pt) => pt.name);
  }

  /**
   * Fetches valid service types from the database.
   * @returns Array of valid service type names.
   */
  private async getValidServiceTypes(): Promise<string[]> {
    const serviceTypes = await prisma.serviceType.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return serviceTypes.map((st) => st.name);
  }

  /**
   * Fetches banks from Monnify API and caches the result.
   * @returns Array of banks with code and name.
   */
  private async getBanks(): Promise<Bank[]> {
    const cacheKey = "monnify_banks";
    const cachedBanks = await this.cacheModule.get(cacheKey);
    if (cachedBanks) {
      return JSON.parse(cachedBanks) as Bank[];
    }

    const response = await this.monnifyService.getBanks();
    if (!response.responseBody || !Array.isArray(response.responseBody)) {
      throw new Error("Failed to fetch banks from Monnify");
    }

    const banks = response.responseBody.map((bank: any) => ({
      code: bank.code,
      name: bank.name,
    }));
    await this.cacheModule.set(cacheKey, JSON.stringify(banks), { ttl: 86400 }); // Cache for 24 hours
    return banks;
  }

  /**
   * Gets bank code from bank name using Monnify API.
   * @param bankName The name of the bank.
   * @returns The bank code.
   */
  private async getBankCode(bankName: string): Promise<string> {
    const banks = await this.getBanks();
    const bank = banks.find((b) => b.name.toLowerCase() === bankName.toLowerCase());
    if (!bank) {
      throw new Error(`Bank not found: ${bankName}`);
    }
    return bank.code;
  }

  /**
   * Creates a single virtual account for a customer (Moniepoint default).
   * @param userId The customer's user ID.
   * @param email The customer's email.
   * @param bvn The customer's BVN.
   * @returns The created virtual account.
   */
  async createCustomerVirtualAccount(userId: string, email: string, bvn: string): Promise<VirtualAccount> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email is required");
      if (!bvn || !/^\d{11}$/.test(bvn)) throw new Error("Valid BVN is required");

      // Verify user is not a vendor or delivery agent
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new Error("User not found");
      if (user.isVendor || user.isDeliveryAgent) throw new Error("User must be a customer, not a vendor or delivery agent");

      // Verify BVN
      const isBvnValid = await this.monnifyService.verifyBVN(bvn);
      if (!isBvnValid) throw new Error("BVN verification failed");

      await ensureWalletExists(userId);

      // Check for existing active account
      const existingAccount = await prisma.virtualAccount.findFirst({
        where: { userId, status: { in: ["ACTIVE", "PENDING"] } },
      });
      if (existingAccount) {
        logger.info("Customer already has an active virtual account", { userId });
        return existingAccount as VirtualAccount;
      }

      // Create Moniepoint account (default for customers)
      const moniepointResponse = await this.monnifyService.createVirtualAccount(
        user.firstName + " " + user.lastName,
        email,
        bvn,
        false // Not a vendor main account
      );

      const virtualAccount = await prisma.virtualAccount.create({
        data: {
          id: uuidv4(),
          userId,
          walletId: (await prisma.wallet.findUnique({ where: { userId } }))!.id,
          accountNumber: moniepointResponse.responseBody.accountNumber,
          bankName: moniepointResponse.responseBody.bankName,
          status: "ACTIVE",
          monnifyRef: moniepointResponse.responseBody.accountReference,
          isVendorMain: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Update BVN verification status
      await prisma.bVNVerification.create({
        data: {
          id: uuidv4(),
          userId,
          bvn,
          bankName: moniepointResponse.responseBody.bankName,
          accountNumber: moniepointResponse.responseBody.accountNumber,
          status: "VERIFIED",
          transactionRef: moniepointResponse.responseBody.accountReference,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "CUSTOMER_VIRTUAL_ACCOUNT_CREATED",
        details: {
          accountNumber: virtualAccount.accountNumber,
          bankName: virtualAccount.bankName,
          monnifyRef: virtualAccount.monnifyRef,
        },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: virtualAccount.id,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.notificationService.sendTransactionNotification({
        userId,
        title: "Virtual Account Created",
        message: `Your virtual account has been created successfully. Account Number: ${virtualAccount.accountNumber}, Bank: ${virtualAccount.bankName}`,
        type: "VIRTUAL_ACCOUNT_CREATION",
      });

      logger.info("Customer virtual account created successfully", { userId, accountNumber: virtualAccount.accountNumber });
      return virtualAccount as VirtualAccount;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating customer virtual account", { userId, error: errorMessage });
      await this.auditLogService.log({
        userId,
        action: "CUSTOMER_VIRTUAL_ACCOUNT_CREATION_FAILED",
        details: { error: errorMessage },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: null,
      });
      throw new Error(`Customer virtual account creation failed: ${errorMessage}`);
    }
  }

  /**
   * Creates virtual accounts for a vendor after BVN verification.
   * @param userId The vendor's user ID.
   * @param email The vendor's email.
   * @param bvn The vendor's BVN.
   * @param preferredBankCode Optional preferred bank code (Moniepoint is default).
   * @returns The created virtual accounts.
   */
  async createVendorVirtualAccounts(
    userId: string,
    email: string,
    bvn: string,
    preferredBankCode?: string
  ): Promise<VirtualAccount[]> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email is required");
      if (!bvn || !/^\d{11}$/.test(bvn)) throw new Error("Valid BVN is required");

      // Verify user is a vendor
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user || !user.isVendor) throw new Error("User must be a vendor to create virtual accounts");

      // Verify BVN
      const isBvnValid = await this.monnifyService.verifyBVN(bvn);
      if (!isBvnValid) throw new Error("BVN verification failed");

      await ensureWalletExists(userId);

      // Check for existing active accounts
      const existingAccounts = await prisma.virtualAccount.findMany({
        where: { userId, status: { in: ["ACTIVE", "PENDING"] }, isVendorMain: true },
      });
      if (existingAccounts.length >= 2) {
        logger.info("Vendor already has two virtual accounts", { userId });
        return existingAccounts as VirtualAccount[];
      }

      // Create Moniepoint account (default)
      const moniepointResponse = await this.monnifyService.createVirtualAccount(
        user.firstName + " " + user.lastName,
        email,
        bvn,
        true
      );

      // Create preferred bank account (if provided)
      let preferredBankResponse: MonnifyVirtualAccountResponse | null = null;
      let preferredAccount: VirtualAccount | null = null;
      if (preferredBankCode) {
        preferredBankResponse = await this.monnifyService.createVirtualAccount(
          user.firstName + " " + user.lastName,
          email,
          bvn,
          true,
          preferredBankCode
        );
      }

      const accounts: VirtualAccount[] = [];
      const moniepointAccount = await prisma.virtualAccount.create({
        data: {
          id: uuidv4(),
          userId,
          walletId: (await prisma.wallet.findUnique({ where: { userId } }))!.id,
          accountNumber: moniepointResponse.responseBody.accountNumber,
          bankName: moniepointResponse.responseBody.bankName,
          status: "ACTIVE",
          monnifyRef: moniepointResponse.responseBody.accountReference,
          isVendorMain: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      accounts.push(moniepointAccount as VirtualAccount);

      if (preferredBankResponse) {
        preferredAccount = await prisma.virtualAccount.create({
          data: {
            id: uuidv4(),
            userId,
            walletId: (await prisma.wallet.findUnique({ where: { userId } }))!.id,
            accountNumber: preferredBankResponse.responseBody.accountNumber,
            bankName: preferredBankResponse.responseBody.bankName,
            status: "ACTIVE",
            monnifyRef: preferredBankResponse.responseBody.accountReference,
            isVendorMain: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        accounts.push(preferredAccount as VirtualAccount);
      }

      // Update BVN verification status
      await prisma.bVNVerification.create({
        data: {
          id: uuidv4(),
          userId,
          bvn,
          bankName: moniepointResponse.responseBody.bankName,
          accountNumber: moniepointResponse.responseBody.accountNumber,
          status: "VERIFIED",
          transactionRef: moniepointResponse.responseBody.accountReference,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "VENDOR_VIRTUAL_ACCOUNTS_CREATED",
        details: {
          accounts: accounts.map((acc) => ({
            accountNumber: acc.accountNumber,
            bankName: acc.bankName,
            monnifyRef: acc.monnifyRef,
          })),
        },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: accounts[0].id,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.notificationService.sendTransactionNotification({
        userId,
        title: "Virtual Accounts Created",
        message: `Your virtual accounts have been created successfully. Moniepoint Account: ${moniepointAccount.accountNumber}, Bank: ${moniepointAccount.bankName}${
          preferredAccount ? `, Preferred Account: ${preferredAccount.accountNumber}, Bank: ${preferredAccount.bankName}` : ""
        }`,
        type: "VIRTUAL_ACCOUNT_CREATION",
      });

      logger.info("Vendor virtual accounts created successfully", { userId, accounts });
      return accounts;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating vendor virtual accounts", { userId, error: errorMessage });
      await this.auditLogService.log({
        userId,
        action: "VENDOR_VIRTUAL_ACCOUNTS_CREATION_FAILED",
        details: { error: errorMessage },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: null,
      });
      throw new Error(`Vendor virtual account creation failed: ${errorMessage}`);
    }
  }

  /**
   * Creates a virtual account for a delivery agent under a vendor.
   * @param vendorId The vendor's user ID.
   * @param agentId The delivery agent's user ID.
   * @returns The created virtual account.
   */
  async createAgentVirtualAccount(vendorId: string, agentId: string): Promise<VirtualAccount> {
    try {
      if (!vendorId || !agentId || typeof vendorId !== "string" || typeof agentId !== "string") {
        throw new Error("Invalid vendor or agent ID format");
      }

      // Verify vendor and agent
      const vendor = await prisma.user.findUnique({
        where: { id: vendorId },
      });
      const agent = await prisma.user.findUnique({
        where: { id: agentId },
      });
      if (!vendor || !vendor.isVendor) throw new Error("Vendor not found or not a vendor");
      if (!agent || !agent.isDeliveryAgent) throw new Error("Agent not found or not a delivery agent");

      // Check for existing agent account
      const existingAccount = await prisma.virtualAccount.findFirst({
        where: { userId: agentId, vendorId, status: "ACTIVE", isVendorMain: false },
      });
      if (existingAccount) {
        logger.info("Agent virtual account already exists", { vendorId, agentId });
        return existingAccount as VirtualAccount;
      }

      // Use vendor's BVN and details for account creation
      const bvnVerification = await prisma.bVNVerification.findFirst({
        where: { userId: vendorId, status: "VERIFIED" },
      });
      if (!bvnVerification) throw new Error("Vendor BVN not verified");

      const vendorProfile = await prisma.profile.findUnique({ where: { id: vendorId } });
      if (!vendorProfile) throw new Error("Vendor profile not found");

      const response = await this.monnifyService.createVirtualAccount(
        `${vendor.firstName} ${vendor.lastName} - Agent`,
        vendor.email,
        bvnVerification.bvn,
        false
      );

      const virtualAccount = await prisma.virtualAccount.create({
        data: {
          id: uuidv4(),
          userId: agentId,
          walletId: (await prisma.wallet.findUnique({ where: { userId: agentId } }))!.id,
          vendorId,
          accountNumber: response.responseBody.accountNumber,
          bankName: response.responseBody.bankName,
          status: "ACTIVE",
          monnifyRef: response.responseBody.accountReference,
          isVendorMain: false,
          metadata: { type: "agent_sub" } as Prisma.InputJsonValue,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Link to VendorWalletConfig
      await prisma.vendorWalletConfig.create({
        data: {
          id: uuidv4(),
          vendorId: vendorProfile.id,
          deliveryAgentId: virtualAccount.walletId,
          withdrawalEnabled: false,
          depositEnabled: true,
          virtualAccount1Id: virtualAccount.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const auditLogRequest: AuditLogRequest = {
        userId: vendorId,
        action: "AGENT_VIRTUAL_ACCOUNT_CREATED",
        details: {
          agentId,
          accountNumber: virtualAccount.accountNumber,
          bankName: virtualAccount.bankName,
          monnifyRef: virtualAccount.monnifyRef,
        },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: virtualAccount.id,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.notificationService.sendTransactionNotification({
        userId: agentId,
        title: "Agent Virtual Account Created",
        message: `Your virtual account has been created under vendor ${vendor.firstName} ${vendor.lastName}. Account Number: ${virtualAccount.accountNumber}, Bank: ${virtualAccount.bankName}`,
        type: "VIRTUAL_ACCOUNT_CREATION",
        metadata: { vendorId },
      });

      logger.info("Agent virtual account created successfully", { vendorId, agentId, accountNumber: virtualAccount.accountNumber });
      return virtualAccount as VirtualAccount;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating agent virtual account", { vendorId, agentId, error: errorMessage });
      await this.auditLogService.log({
        userId: vendorId,
        action: "AGENT_VIRTUAL_ACCOUNT_CREATION_FAILED",
        details: { error: errorMessage, agentId },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: null,
      });
      throw new Error(`Agent virtual account creation failed: ${errorMessage}`);
    }
  }


  /**
   * Processes a payment using a virtual account for either a ServiceOrder, ProductOrder, or Wallet Top-Up.
   * @param userId The user ID (customer or agent).
   * @param amount The payment amount.
   * @param orderId The order ID (ServiceOrder, ProductOrder, or transactionRef for WALLET_TOPUP).
   * @param entityType The type of transaction ("SERVICE_ORDER", "PRODUCT_ORDER", or "WALLET_TOPUP").
   * @param type The productType, serviceType, or "TOPUP" for wallet top-ups.
   * @returns The created wallet transaction.
   */
  async processVirtualAccountPayment(
    userId: string,
    amount: number,
    orderId: string,
    entityType: "SERVICE_ORDER" | "PRODUCT_ORDER" | "WALLET_TOPUP",
    type: string
  ): Promise<WalletTransaction> {
    try {
      // Input validation
      if (!userId || typeof userId !== "string") {
        throw new Error("Invalid user ID format");
      }
      if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new Error("Payment amount must be positive");
      }
      if (!orderId || typeof orderId !== "string") {
        throw new Error("Valid orderId is required");
      }
      if (!["SERVICE_ORDER", "PRODUCT_ORDER", "WALLET_TOPUP"].includes(entityType)) {
        throw new Error("Invalid entityType: must be SERVICE_ORDER, PRODUCT_ORDER, or WALLET_TOPUP");
      }

      // Validate user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new Error("User not found");
      }

      // Validate type based on entityType
      let validTypes: string[] = [];
      if (entityType === "SERVICE_ORDER") {
        validTypes = await this.getValidServiceTypes();
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid serviceType: must be one of ${validTypes.join(", ")}`);
        }
      } else if (entityType === "PRODUCT_ORDER") {
        validTypes = await this.getValidProductTypes();
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid productType: must be one of ${validTypes.join(", ")}`);
        }
      } else if (entityType === "WALLET_TOPUP") {
        if (type !== "TOPUP") {
          throw new Error("Type must be 'TOPUP' for WALLET_TOPUP entityType");
        }
      }

      // Validate order exists for SERVICE_ORDER or PRODUCT_ORDER
      if (entityType === "SERVICE_ORDER") {
        const serviceOrder = await prisma.serviceOrder.findUnique({
          where: { id: orderId },
        });
        if (!serviceOrder) {
          throw new Error("ServiceOrder not found");
        }
        if (serviceOrder.paymentStatus !== TransactionStatus.PENDING) {
          throw new Error("ServiceOrder already has a non-pending payment status");
        }
      } else if (entityType === "PRODUCT_ORDER") {
        const productOrder = await prisma.productOrder.findUnique({
          where: { id: orderId },
        });
        if (!productOrder) {
          throw new Error("ProductOrder not found");
        }
        if (productOrder.paymentStatus !== TransactionStatus.PENDING) {
          throw new Error("ProductOrder already has a non-pending payment status");
        }
      }

      // Ensure wallet exists
      await ensureWalletExists(userId);

      // Check for suspicious activity
      await this.fraudDetectionService.checkForSuspiciousActivity(
        userId,
        amount,
        "VIRTUAL_ACCOUNT_PAYMENT",
        entityType,
        orderId
      );

      // Retrieve active virtual account
      const virtualAccount = await prisma.virtualAccount.findFirst({
        where: { userId, status: "ACTIVE" },
      });
      if (!virtualAccount) {
        throw new Error("No active virtual account found for user");
      }

      // Generate unique transaction reference
      const transactionRef = `VA-PAY-${uuidv4()}-${Date.now()}`;

      // Execute transaction
      const transaction = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new Error("Wallet not found");
        }

        // Create payment record
        const paymentData: Prisma.PaymentCreateInput = {
          id: uuidv4(),
          user: { connect: { id: userId } },
          transactionRef,
          monnifyRef: transactionRef,
          amount,
          requestedAmount: amount,
          status: TransactionStatus.PENDING,
          paymentMethod: PaymentMethod.VIRTUAL_ACCOUNT,
          paymentDetails: {
            virtualAccountId: virtualAccount.id,
            accountNumber: virtualAccount.accountNumber,
            bankName: virtualAccount.bankName,
            orderId,
          } as Prisma.InputJsonValue,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(entityType === "SERVICE_ORDER" ? { serviceType: type } : entityType === "PRODUCT_ORDER" ? { productType: type } : { productType: "wallet_topup" }),
        };

        const payment = await tx.payment.create({ data: paymentData });

        // Create wallet transaction
        const transactionData: Prisma.WalletTransactionCreateInput = {
          id: uuidv4(),
          user: { connect: { id: userId } },
          wallet: { connect: { id: wallet.id } },
          amount: new Prisma.Decimal(amount),
          transactionType: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
          payment: { connect: { id: payment.id } },
          metadata: {
            [entityType === "SERVICE_ORDER" ? "serviceType" : entityType === "PRODUCT_ORDER" ? "productType" : "isWalletTopUp"]: entityType === "WALLET_TOPUP" ? true : type,
            virtualAccountId: virtualAccount.id,
            webhookStatus: "PENDING",
            entityType,
            orderId,
          } as Prisma.InputJsonValue,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(entityType === "SERVICE_ORDER"
            ? { serviceOrderId: orderId }
            : entityType === "PRODUCT_ORDER"
            ? { productOrderId: orderId }
            : {}),
        };

        const createdTransaction = await tx.walletTransaction.create({
          data: transactionData,
        });

        // Update order payment status for SERVICE_ORDER or PRODUCT_ORDER
        if (entityType === "SERVICE_ORDER") {
          await tx.serviceOrder.update({
            where: { id: orderId },
            data: { paymentStatus: TransactionStatus.PENDING, updatedAt: new Date() },
          });
        } else if (entityType === "PRODUCT_ORDER") {
          await tx.productOrder.update({
            where: { id: orderId },
            data: { paymentStatus: TransactionStatus.PENDING, updatedAt: new Date() },
          });
        }

        // Log audit
        const auditLogRequest: AuditLogRequest = {
          userId,
          action: "VIRTUAL_ACCOUNT_PAYMENT_INITIATED",
          details: {
            amount,
            orderId,
            [entityType === "SERVICE_ORDER" ? "serviceType" : entityType === "PRODUCT_ORDER" ? "productType" : "isWalletTopUp"]: entityType === "WALLET_TOPUP" ? true : type,
            transactionRef,
            entityType,
            virtualAccountId: virtualAccount.id,
          },
          entityType: "WALLET_TRANSACTION",
          entityId: createdTransaction.id,
        };
        await this.auditLogService.log(auditLogRequest);

        return createdTransaction;
      });

      // Send notification
      await this.notificationService.sendTransactionNotification({
        userId,
        title: "Virtual Account Payment Initiated",
        message: `A payment of ${amount} has been initiated for ${entityType
          .toLowerCase()
          .replace("_", " ")} ${orderId} using your virtual account (${virtualAccount.accountNumber}).`,
        type: "VIRTUAL_ACCOUNT_PAYMENT",
        metadata: { orderId, entityType },
      });

      // Trigger webhook
      await this.webhookModule.triggerWebhook(
        userId,
        {
          id: transaction.id,
          amount: transaction.amount.toNumber(),
          status: transaction.status,
          createdAt: transaction.createdAt.toISOString(),
          metadata: transaction.metadata,
          userId: transaction.userId,
          orderId,
          entityType,
        },
        "VIRTUAL_ACCOUNT_PAYMENT_PENDING"
      );

      // Invalidate cache
      await this.cacheModule.invalidateBalanceCache(userId);

      logger.info("Virtual account payment initiated", {
        userId,
        transactionId: transaction.id,
        amount,
        orderId,
        entityType,
      });

      return transaction as WalletTransaction;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error processing virtual account payment", {
        userId,
        orderId,
        entityType,
        error: errorMessage,
      });

      // Log audit for failure
      await this.auditLogService.log({
        userId,
        action: "VIRTUAL_ACCOUNT_PAYMENT_FAILED",
        details: { error: errorMessage, amount, orderId, entityType },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });

      // Trigger webhook for failure
      await this.webhookModule.triggerWebhook(
        userId,
        { id: orderId, status: TransactionStatus.FAILED, entityType },
        "VIRTUAL_ACCOUNT_PAYMENT_FAILED"
      );

      throw new Error(`Virtual account payment failed: ${errorMessage}`);
    }
  }

  
  /**
   * Validates a virtual account payment with Monnify.
   * @param userId The user ID.
   * @param transactionRef The transaction reference.
   * @returns The updated wallet transaction.
   */
  async validateVirtualAccountPayment(userId: string, transactionRef: string): Promise<WalletTransaction> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");
      if (!transactionRef || typeof transactionRef !== "string") throw new Error("Valid transaction reference required");

      await ensureWalletExists(userId);

      const response = await this.monnifyService.validateVirtualAccountPayment(transactionRef);
      if (response.responseCode !== "0" || response.responseBody.status !== "SUCCESS") {
        throw new Error(`Virtual account payment verification failed: ${response.responseMessage}`);
      }

      const { amount, transactionReference } = response.responseBody;

      const transaction = await prisma.$transaction(async (tx) => {
        const walletTx = await tx.walletTransaction.findFirst({
          where: { payment: { monnifyRef: transactionReference }, status: TransactionStatus.PENDING, user: { id: userId } },
          include: { payment: true },
        });

        if (!walletTx || !walletTx.payment) throw new Error(`No pending transaction found for transactionRef: ${transactionReference}`);

        await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: amount }, updatedAt: new Date() },
        });
        await this.cacheModule.invalidateBalanceCache(userId);

        const paymentDetails = walletTx.payment.paymentDetails as PaymentDetails | null;
        const virtualAccountId = paymentDetails?.virtualAccountId;
        const entityType = walletTx.serviceOrderId ? "SERVICE_ORDER" : walletTx.productOrderId ? "PRODUCT_ORDER" : "WALLET_TOPUP";

        const metadata: Record<string, any> =
          walletTx.metadata && typeof walletTx.metadata === "object" && !Array.isArray(walletTx.metadata)
            ? {
                ...walletTx.metadata,
                webhookStatus: "SENT",
                virtualAccountId,
              }
            : { webhookStatus: "SENT", virtualAccountId };

        const updatedTx = await tx.walletTransaction.update({
          where: { id: walletTx.id },
          data: { status: TransactionStatus.COMPLETED, metadata, updatedAt: new Date() },
        });

        await tx.payment.update({
          where: { id: walletTx.payment.id },
          data: { status: TransactionStatus.COMPLETED, updatedAt: new Date() },
        });

        // Update order status for SERVICE_ORDER or PRODUCT_ORDER
        if (entityType === "SERVICE_ORDER" && walletTx.serviceOrderId) {
          await tx.serviceOrder.update({
            where: { id: walletTx.serviceOrderId },
            data: { paymentStatus: TransactionStatus.COMPLETED, updatedAt: new Date() },
          });
        } else if (entityType === "PRODUCT_ORDER" && walletTx.productOrderId) {
          await tx.productOrder.update({
            where: { id: walletTx.productOrderId },
            data: { paymentStatus: TransactionStatus.COMPLETED, updatedAt: new Date() },
          });
        }

        const auditLogRequest: AuditLogRequest = {
          userId,
          action: "VIRTUAL_ACCOUNT_PAYMENT_COMPLETED",
          details: {
            amount,
            transactionRef: transactionReference,
            walletId: walletTx.walletId,
            virtualAccountId,
            entityType,
            orderId: walletTx.serviceOrderId || walletTx.productOrderId || transactionReference,
          },
          entityType: "WALLET_TRANSACTION",
          entityId: walletTx.id,
        };
        await this.auditLogService.log(auditLogRequest);

        await this.notificationService.sendTransactionNotification({
          userId,
          title: "Virtual Account Payment Completed",
          message: `Your payment of ${amount} via virtual account has been validated.`,
          type: "VIRTUAL_ACCOUNT_PAYMENT_VALIDATION",
        });

        return updatedTx;
      });

      await this.webhookModule.triggerWebhook(
        userId,
        {
          id: transaction.id,
          amount: transaction.amount.toNumber(),
          status: transaction.status,
          createdAt: transaction.createdAt.toISOString(),
          metadata: transaction.metadata,
          userId: transaction.userId,
          orderId: transaction.serviceOrderId || transaction.productOrderId || transactionRef,
          entityType: transaction.serviceOrderId ? "SERVICE_ORDER" : transaction.productOrderId ? "PRODUCT_ORDER" : "WALLET_TOPUP",
        },
        `VIRTUAL_ACCOUNT_PAYMENT_${transaction.status}`
      );

      logger.info("Virtual account payment validated", { userId, amount, transactionRef: transactionReference });
      return transaction as WalletTransaction;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error validating virtual account payment", { userId, transactionRef, error: errorMessage });
      await this.auditLogService.log({
        userId,
        action: "VIRTUAL_ACCOUNT_PAYMENT_VALIDATION_FAILED",
        details: { error: errorMessage, transactionRef },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(
        userId,
        { id: transactionRef, status: TransactionStatus.FAILED, entityType: "WALLET_TOPUP" },
        "VIRTUAL_ACCOUNT_PAYMENT_VALIDATION_FAILED"
      );
      throw new Error(`Virtual account payment validation failed: ${errorMessage}`);
    }
  }


  /**
   * Retrieves virtual account details for a user.
   * @param userId The user ID.
   * @returns The virtual account details or null if not found.
   */
  async getVirtualAccount(userId: string): Promise<VirtualAccount | null> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");

      const virtualAccount = await prisma.virtualAccount.findFirst({
        where: { userId, status: "ACTIVE" },
      });

      if (!virtualAccount) {
        logger.info("No active virtual account found", { userId });
        return null;
      }

      logger.info("Virtual account retrieved", { userId, accountId: virtualAccount.id });
      return virtualAccount as VirtualAccount;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error retrieving virtual account", { userId, error: errorMessage });
      await this.auditLogService.log({
        userId,
        action: "VIRTUAL_ACCOUNT_RETRIEVAL_FAILED",
        details: { error: errorMessage },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: null,
      });
      throw new Error(`Failed to retrieve virtual account: ${errorMessage}`);
    }
  }

  /**
   * Deactivates a virtual account and transfers balance to vendor's main account if applicable.
   * @param userId The user ID (agent or vendor).
   * @param virtualAccountId The virtual account ID.
   */
  async deactivateVirtualAccount(userId: string, virtualAccountId: string): Promise<void> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");
      if (!virtualAccountId || typeof virtualAccountId !== "string") throw new Error("Valid virtual account ID required");

      const virtualAccount = await prisma.virtualAccount.findFirst({
        where: { id: virtualAccountId, userId, status: "ACTIVE" },
      });
      if (!virtualAccount) throw new Error("Active virtual account not found");

      if (!virtualAccount.isVendorMain && virtualAccount.vendorId) {
        // Transfer balance to vendor's main account
        const vendorMainAccount = await prisma.virtualAccount.findFirst({
          where: { userId: virtualAccount.vendorId, isVendorMain: true, status: "ACTIVE" },
        });
        if (vendorMainAccount) {
          const wallet = await prisma.wallet.findUnique({ where: { id: virtualAccount.walletId } });
          if (wallet && wallet.balance.greaterThan(0)) {
            await this.monnifyService.initiateTransfer(
              wallet.balance.toNumber(),
              vendorMainAccount.accountNumber,
              await this.getBankCode(vendorMainAccount.bankName),
              `Transfer from agent account ${virtualAccount.accountNumber} to vendor main account`,
              `TRANSFER-${uuidv4()}-${Date.now()}`
            );
          }
        }
      }

      await prisma.virtualAccount.update({
        where: { id: virtualAccountId },
        data: { status: "DEACTIVATED", updatedAt: new Date() },
      });

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "VIRTUAL_ACCOUNT_DEACTIVATED",
        details: { virtualAccountId, accountNumber: virtualAccount.accountNumber },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: virtualAccountId,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.notificationService.sendTransactionNotification({
        userId,
        title: "Virtual Account Deactivated",
        message: `Your virtual account (${virtualAccount.accountNumber}) has been deactivated.`,
        type: "VIRTUAL_ACCOUNT_DEACTIVATION",
      });

      logger.info("Virtual account deactivated", { userId, virtualAccountId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error deactivating virtual account", { userId, virtualAccountId, error: errorMessage });
      await this.auditLogService.log({
        userId,
        action: "VIRTUAL_ACCOUNT_DEACTIVATION_FAILED",
        details: { error: errorMessage, virtualAccountId },
        entityType: "VIRTUAL_ACCOUNT",
        entityId: null,
      });
      throw new Error(`Virtual account deactivation failed: ${errorMessage}`);
    }
  }

  /**
   * Links a delivery agent to a vendor.
   * @param vendorId The vendor's user ID.
   * @param agentId The delivery agent's user ID.
   */
  async linkDeliveryAgent(vendorId: string, agentId: string): Promise<void> {
    try {
      const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
      const agent = await prisma.user.findUnique({ where: { id: agentId } });
      if (!vendor || !vendor.isVendor) throw new Error("Vendor not found or not a vendor");
      if (!agent || !agent.isDeliveryAgent) throw new Error("Agent not found or not a delivery agent");

      // Create virtual account for agent
      await this.createAgentVirtualAccount(vendorId, agentId);

      await this.notificationService.sendTransactionNotification({
        userId: vendorId,
        title: "Delivery Agent Linked",
        message: `Delivery agent ${agent.firstName} ${agent.lastName} has been linked to your account.`,
        type: "VENDOR_LINKING",
      });

      logger.info("Delivery agent linked", { vendorId, agentId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error linking delivery agent", { vendorId, agentId, error: errorMessage });
      await this.auditLogService.log({
        userId: vendorId,
        action: "DELIVERY_AGENT_LINKING_FAILED",
        details: { error: errorMessage, agentId },
        entityType: "USER",
        entityId: null,
      });
      throw new Error(`Delivery agent linking failed: ${errorMessage}`);
    }
  }

  /**
   * Unlinks a delivery agent from a vendor and deactivates their virtual account.
   * @param vendorId The vendor's user ID.
   * @param agentId The delivery agent's user ID.
   */
  async unlinkDeliveryAgent(vendorId: string, agentId: string): Promise<void> {
    try {
      const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
      const agent = await prisma.user.findUnique({ where: { id: agentId } });
      if (!vendor || !vendor.isVendor) throw new Error("Vendor not found or not a vendor");
      if (!agent || !agent.isDeliveryAgent) throw new Error("Agent not found or not a delivery agent");

      const agentAccount = await prisma.virtualAccount.findFirst({
        where: { userId: agentId, vendorId, status: "ACTIVE", isVendorMain: false },
      });
      if (agentAccount) {
        await this.deactivateVirtualAccount(agentId, agentAccount.id);
      }

      await this.notificationService.sendTransactionNotification({
        userId: vendorId,
        title: "Delivery Agent Unlinked",
        message: `Delivery agent ${agent.firstName} ${agent.lastName} has been unlinked from your account.`,
        type: "VENDOR_LINKING",
      });

      logger.info("Delivery agent unlinked", { vendorId, agentId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error unlinking delivery agent", { vendorId, agentId, error: errorMessage });
      await this.auditLogService.log({
        userId: vendorId,
        action: "DELIVERY_AGENT_UNLINKING_FAILED",
        details: { error: errorMessage, agentId },
        entityType: "USER",
        entityId: null,
      });
      throw new Error(`Delivery agent unlinking failed: ${errorMessage}`);
    }
  }

  /**
   * Retrieves metrics for virtual account operations.
   * @returns Metrics related to virtual account activities.
   */
  async getMetrics(): Promise<any> {
    try {
      const activeAccounts = await prisma.virtualAccount.count({
        where: { status: "ACTIVE" },
      });

      const pendingPayments = await prisma.walletTransaction.count({
        where: {
          payment: { paymentMethod: PaymentMethod.VIRTUAL_ACCOUNT },
          status: TransactionStatus.PENDING,
        },
      });

      const completedPayments = await prisma.walletTransaction.count({
        where: {
          payment: { paymentMethod: PaymentMethod.VIRTUAL_ACCOUNT },
          status: TransactionStatus.COMPLETED,
        },
      });

      const failedPayments = await prisma.walletTransaction.count({
        where: {
          payment: { paymentMethod: PaymentMethod.VIRTUAL_ACCOUNT },
          status: TransactionStatus.FAILED,
        },
      });

      const totalPaymentAmount = await prisma.walletTransaction.aggregate({
        where: {
          payment: { paymentMethod: PaymentMethod.VIRTUAL_ACCOUNT },
          status: TransactionStatus.COMPLETED,
        },
        _sum: {
          amount: true,
        },
      });

      const metrics = {
        activeVirtualAccounts: activeAccounts,
        pendingVirtualAccountPayments: pendingPayments,
        completedVirtualAccountPayments: completedPayments,
        failedVirtualAccountPayments: failedPayments,
        totalVirtualAccountPaymentAmount: totalPaymentAmount._sum.amount?.toNumber() || 0,
        timestamp: new Date().toISOString(),
      };

      logger.info("Virtual account metrics retrieved", { metrics });
      return metrics;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error retrieving virtual account metrics", { error: errorMessage });
      throw new Error(`Failed to retrieve virtual account metrics: ${errorMessage}`);
    }
  }
}

export default new VirtualAccountModule();