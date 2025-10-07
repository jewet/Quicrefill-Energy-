import { PrismaClient, TransactionType, TransactionStatus, PaymentMethod, Prisma, VoucherType } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { getRedisClient } from "../config/redis";
import Joi from "joi";
import VoucherModule from "../modules/voucherModule/VoucherModule";
import VirtualAccountModule from "../modules/walletModule/virtualAccountModule";
import TransactionCoreModule from "../modules/walletModule/transactionCoreModule";
import CacheModule from "../modules/walletModule/cacheModule";
import BillPaymentModule from "../modules/walletModule/billPaymentModule";
import CallbackModule from "../modules/walletModule/callbackModule";
import MonnifyService from "../services/MonnifyService";

// Extend Express Request interface to include AuthUser
declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

// Define interfaces aligned with modules
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
  productOrderId?: string | null;
  electricityProviderId?: number | null;
  billerCode?: string | null;
  transactionRef?: string | null;
  vendorId?: string | null;
}

interface Voucher {
  id: string;
  code: string;
  discount: Prisma.Decimal;
  type: VoucherType;
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

interface Bank {
  code: string;
  name: string;
}

interface AuthUser {
  id: string;
  email: string;
  role: string;
  contextRole?: string;
  isAdmin: boolean;
}

// Joi Schemas
const redeemVoucherSchema = Joi.object({
  voucherCode: Joi.string().pattern(/^[A-Z0-9-]+$/).required(),
});

const applyVoucherSchema = Joi.object({
  voucherCode: Joi.string().pattern(/^[A-Z0-9-]+$/).required(),
  orderId: Joi.string().uuid().required(),
  orderType: Joi.string().valid("PRODUCT", "SERVICE").required(),
  amount: Joi.number().positive().required(),
});

const prisma = new PrismaClient();

export class WalletService {
  private cacheModule = CacheModule;
  private transactionCoreModule = TransactionCoreModule;
  private billPaymentModule = BillPaymentModule;
  private callbackModule = CallbackModule;
  private virtualAccountModule = VirtualAccountModule;
  private voucherModule = VoucherModule;
  private monnifyService = MonnifyService;

  constructor() {}

  // CacheModule Methods
  async invalidateBalanceCache(userId: string): Promise<number> {
    return this.cacheModule.invalidateBalanceCache(userId);
  }

  async invalidateVoucherCache(voucherCode: string): Promise<number> {
    return this.cacheModule.invalidateVoucherCache(voucherCode);
  }

  async getBalance(userId: string): Promise<number> {
    return this.cacheModule.getBalance(userId);
  }

  async getCachedTransactions(userId: string, limit: number, offset: number): Promise<any[]> {
    return this.cacheModule.getCachedTransactions(userId, limit, offset);
  }

  async cacheTransactions(userId: string, transactions: any[], limit: number, offset: number): Promise<void> {
    return this.cacheModule.cacheTransactions(userId, transactions, limit, offset);
  }

  async getCacheMetrics(): Promise<any> {
    return this.cacheModule.getMetrics();
  }

  // TransactionCoreModule Methods
  async depositFunds(
    userId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    transactionRef?: string
  ): Promise<WalletTransaction> {
    return this.transactionCoreModule.depositFunds(userId, amount, paymentMethod, transactionRef);
  }

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
    return this.transactionCoreModule.payWithWallet(userId, amount, orderId, serviceType, productType, serviceCharge, vatRate, petroleumTax, voucherCode);
  }

  async refundFunds(
    userId: string,
    amount: number,
    orderId: string,
    serviceType: string | null,
    productType: string | null,
    isPartial: boolean = false
  ): Promise<WalletTransaction> {
    return this.transactionCoreModule.refundFunds(userId, amount, orderId, serviceType, productType, isPartial);
  }

  async withdrawFunds(
    userId: string,
    amount: number,
    bankAccountNumber: string,
    bankCode: string
  ): Promise<WalletTransaction> {
    return this.transactionCoreModule.withdrawFunds(userId, amount, bankAccountNumber, bankCode);
  }

  async setWithdrawalLimits(
    adminId: string,
    targetUserId: string,
    dailyLimit: number,
    singleLimit: number
  ): Promise<void> {
    return this.transactionCoreModule.setWithdrawalLimits(adminId, targetUserId, dailyLimit, singleLimit);
  }

  // VoucherModule Methods
  async createVoucher(params: {
    discount: number;
    type: VoucherType;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    validFrom: Date;
    validUntil: Date;
    appliesTo: "PRODUCT" | "SERVICE";
    createdById: string;
  }): Promise<Voucher> {
    return this.voucherModule.createVoucher(params);
  }

  async updateVoucher(
    id: string,
    params: {
      discount?: number;
      type?: VoucherType;
      maxUses?: number | null;
      maxUsesPerUser?: number | null;
      validFrom?: Date;
      validUntil?: Date;
      isActive?: boolean;
      appliesTo?: "PRODUCT" | "SERVICE";
      updatedById: string;
    }
  ): Promise<Voucher> {
    return this.voucherModule.updateVoucher(id, params);
  }

  async getAllVouchers(page: number = 1, pageSize: number = 10): Promise<{ vouchers: Voucher[]; total: number }> {
    return this.voucherModule.getAllVouchers(page, pageSize);
  }

  async checkVoucherEligibility(
    userId: string,
    voucherCode: string,
    context: "PRODUCT" | "SERVICE"
  ): Promise<{ eligible: boolean; voucher: Voucher | null; message: string }> {
    return this.voucherModule.checkVoucherEligibility(userId, voucherCode, context);
  }

  async validateVoucher(
    userId: string,
    voucherCode: string,
    context: "PRODUCT" | "SERVICE",
    amount: number
  ): Promise<{ discount: number; valid: boolean; voucher: Voucher | null }> {
    return this.voucherModule.validateVoucher(userId, voucherCode, context, amount);
  }

  async redeemVoucher(userId: string, voucherCode: string): Promise<WalletTransaction> {
    return this.voucherModule.redeemVoucher(userId, voucherCode);
  }

  async applyVoucher(
    userId: string,
    voucherCode: string,
    entityType: "PRODUCT" | "SERVICE",
    entityId: string,
    amount: number
  ): Promise<{ discountAmount: number; newTotal: number; voucher: Voucher }> {
    return this.voucherModule.applyVoucher(userId, voucherCode, entityType, entityId, amount);
  }

  async redeemVoucherController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error } = redeemVoucherSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }
      const user = req.user as AuthUser;
      if (!user) {
        res.status(401).json({ error: "Unauthorized: No user found" });
        return;
      }
      await this.voucherModule.redeemVoucherController(req, res, next);
    } catch (error) {
      logger.error("Error in redeemVoucherController", { error });
      next(error);
    }
  }

  async applyVoucherController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error } = applyVoucherSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0].message });
        return;
      }
      const user = req.user as AuthUser;
      if (!user) {
        res.status(401).json({ error: "Unauthorized: No user found" });
        return;
      }
      await this.voucherModule.applyVoucherController(req, res, next);
    } catch (error) {
      logger.error("Error in applyVoucherController", { error });
      next(error);
    }
  }

  // VirtualAccountModule Methods
  async createCustomerVirtualAccount(userId: string, email: string, bvn: string): Promise<VirtualAccount> {
    return this.virtualAccountModule.createCustomerVirtualAccount(userId, email, bvn);
  }

  async createVendorVirtualAccounts(
    userId: string,
    email: string,
    bvn: string,
    preferredBankCode?: string
  ): Promise<VirtualAccount[]> {
    return this.virtualAccountModule.createVendorVirtualAccounts(userId, email, bvn, preferredBankCode);
  }

  async createAgentVirtualAccount(vendorId: string, agentId: string): Promise<VirtualAccount> {
    return this.virtualAccountModule.createAgentVirtualAccount(vendorId, agentId);
  }

  async processVirtualAccountPayment(
    userId: string,
    amount: number,
    orderId: string,
    entityType: "SERVICE_ORDER" | "PRODUCT_ORDER" | "WALLET_TOPUP",
    type: string
  ): Promise<WalletTransaction> {
    return this.virtualAccountModule.processVirtualAccountPayment(userId, amount, orderId, entityType, type);
  }

  async validateVirtualAccountPayment(userId: string, transactionRef: string): Promise<WalletTransaction> {
    return this.virtualAccountModule.validateVirtualAccountPayment(userId, transactionRef);
  }

  async getVirtualAccount(userId: string): Promise<VirtualAccount | null> {
    return this.virtualAccountModule.getVirtualAccount(userId);
  }

  async deactivateVirtualAccount(userId: string, virtualAccountId: string): Promise<void> {
    return this.virtualAccountModule.deactivateVirtualAccount(userId, virtualAccountId);
  }

  async linkDeliveryAgent(vendorId: string, agentId: string): Promise<void> {
    return this.virtualAccountModule.linkDeliveryAgent(vendorId, agentId);
  }

  async unlinkDeliveryAgent(vendorId: string, agentId: string): Promise<void> {
    return this.virtualAccountModule.unlinkDeliveryAgent(vendorId, agentId);
  }

  async getVirtualAccountMetrics(): Promise<any> {
    return this.virtualAccountModule.getMetrics();
  }

  // BillPaymentModule Methods
  async validatePayment(userId: string, transactionRef: string): Promise<WalletTransaction> {
    return this.billPaymentModule.validatePayment(userId, transactionRef);
  }

  async processBillPayment(
    userId: string,
    amount: number,
    meterNumber: string,
    providerId: number,
    billType: "PREPAID" | "POSTPAID",
    useVirtualAccount: boolean = false
  ): Promise<{ transaction: WalletTransaction; billResponse: any }> {
    return this.billPaymentModule.processBillPayment(userId, amount, meterNumber, providerId, billType, useVirtualAccount);
  }

  async validateMeterNumber(meterNumber: string, providerId: number): Promise<{ meterNumber: string; name: string }> {
    return this.billPaymentModule.validateMeterNumber(meterNumber, providerId);
  }

  async reconcileTransaction(transactionRef: string): Promise<TransactionStatus> {
    return this.billPaymentModule.reconcileTransaction(transactionRef);
  }

  // CallbackModule Methods
  async handleMonnifyCallback(callbackData: unknown, signature: string): Promise<void> {
    return this.callbackModule.handleMonnifyCallback(callbackData, signature);
  }

  // Original WalletService Methods
  async createWallet(userId: string): Promise<void> {
    try {
      const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
      if (existingWallet) {
        logger.info("Wallet already exists", { userId });
        return;
      }

      await prisma.wallet.create({
        data: {
          id: userId,
          userId,
          balance: new Prisma.Decimal(0),
          updatedAt: new Date(),
        },
      });
      logger.info("Wallet created successfully", { userId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating wallet", { userId, error: errorMessage });
      throw new Error(`Failed to create wallet: ${errorMessage}`);
    }
  }

  async getTransactions(userId: string, limit = 50, offset = 0): Promise<WalletTransaction[]> {
    try {
      const transactions = await this.cacheModule.getCachedTransactions(userId, limit, offset);
      if (transactions.length > 0) return transactions;

      const dbTransactions = await prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      await this.cacheModule.cacheTransactions(userId, dbTransactions, limit, offset);

      logger.info("Transactions retrieved from database", { userId, transactionCount: dbTransactions.length });
      return dbTransactions as WalletTransaction[];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error fetching wallet transactions", { error: errorMessage, userId });
      throw new Error("Failed to retrieve wallet transactions: " + errorMessage);
    }
  }

  async getMetrics(): Promise<any> {
    return {
      cacheMetrics: await this.cacheModule.getMetrics(),
      virtualAccountMetrics: await this.virtualAccountModule.getMetrics(),
    };
  }

  public async getBanks(): Promise<Bank[]> {
    const cacheKey = "monnify_banks";
    const redisClient = await getRedisClient();
    try {
      const cachedBanks = await redisClient.get(cacheKey);
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
      await redisClient.setEx(cacheKey, 86400, JSON.stringify(banks));
      return banks;
    } catch (error) {
      logger.error("Error fetching banks", { error });
      throw new Error(`Failed to fetch banks: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getBanksController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as AuthUser;
      if (!user) {
        res.status(401).json({ error: "Unauthorized: No user found" });
        return;
      }
      const banks = await this.getBanks();
      res.status(200).json(banks);
    } catch (error) {
      logger.error("Error in getBanksController", { error });
      next(error);
    }
  }
}

export default new WalletService();