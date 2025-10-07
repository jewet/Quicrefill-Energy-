import { PrismaClient, Prisma, TransactionType, TransactionStatus, VoucherType } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import { ensureWalletExists } from "../../utils/walletUtils";
import { AuditLogService, AuditLogRequest } from "../../services/auditLogService";
import { FraudDetectionService } from "../../services/fraudDetectionService";
import { v4 as uuidv4 } from "uuid";
import retry from "async-retry";
import { logger } from "../../utils/logger";
import WebhookModule from "../walletModule/webhookModule";
import CacheModule from "../walletModule/cacheModule";
import { getRedisClient } from "../../config/redis";
import Joi from "joi";

// Define interfaces
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

interface WalletTransactionMetadata {
  voucherCode?: string;
  voucherDiscount?: number;
  webhookStatus?: string;
  [key: string]: any;
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

interface AuthUser {
  id: string;
  email: string;
  role: string;
  contextRole?: string;
  isAdmin: boolean;
}

declare module "express" {
  interface Request {
    user?: AuthUser;
  }
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

export class VoucherModule {
  private notificationService: NotificationService;
  private auditLogService = new AuditLogService();
  private fraudDetectionService = new FraudDetectionService();
  private webhookModule = WebhookModule;
  private cacheModule = CacheModule;

  constructor() {
    this.notificationService = {
      sendTransactionNotification: async (params) => {
        logger.info("Sending transaction notification", params);
      },
    };
  }

  // Helper method for role checking
  private checkRole(user: AuthUser, requiredRole: string): boolean {
    return user.role === requiredRole || (user.isAdmin && requiredRole !== "CUSTOMER");
  }

  private async generateVoucherCode(length: number = 10): Promise<string> {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (existing) {
      return this.generateVoucherCode(length);
    }
    return code;
  }

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
    try {
      const { discount, type, maxUses, maxUsesPerUser, validFrom, validUntil, appliesTo, createdById } = params;
      if (discount <= 0) throw new Error("Discount must be positive");
      if (!["PERCENTAGE", "FIXED"].includes(type)) throw new Error("Invalid voucher type");
      if (!["PRODUCT", "SERVICE"].includes(appliesTo)) throw new Error("Invalid appliesTo value: must be PRODUCT or SERVICE");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdById))
        throw new Error("Invalid createdById format: must be a valid UUID");

      const code = await this.generateVoucherCode();

      const voucher = await prisma.voucher.create({
        data: {
          id: uuidv4(),
          code,
          discount: new Prisma.Decimal(discount),
          type,
          maxUses,
          maxUsesPerUser,
          uses: 0,
          validFrom,
          validUntil,
          isActive: true,
          appliesTo,
          createdById,
          updatedAt: new Date(),
          updatedById: createdById,
        },
      });

      await this.cacheModule.invalidateVoucherCache(code);

      const auditLogRequest: AuditLogRequest = {
        userId: createdById,
        action: "VOUCHER_CREATED",
        details: { code, discount, type, appliesTo },
        entityType: "VOUCHER",
        entityId: voucher.id,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.notificationService.sendTransactionNotification({
        userId: createdById,
        title: "Voucher Created",
        message: `Voucher ${code} worth ${discount} created successfully.`,
        type: "VOUCHER_CREATION",
        metadata: { code, discount, appliesTo },
      });

      logger.info("Voucher created successfully", { createdById, code, discount });
      return { ...voucher, appliesTo: voucher.appliesTo as "PRODUCT" | "SERVICE", updatedById: voucher.updatedById || null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error creating voucher", { error: errorMessage, createdById: params.createdById });
      await this.auditLogService.log({
        userId: params.createdById,
        action: "VOUCHER_CREATION_FAILED",
        details: { error: errorMessage, discount: params.discount, appliesTo: params.appliesTo },
        entityType: "VOUCHER",
        entityId: null,
      });
      throw new Error(`Failed to create voucher: ${errorMessage}`);
    }
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
    try {
      const { discount, type, maxUses, maxUsesPerUser, validFrom, validUntil, appliesTo, isActive, updatedById } = params;

      if (discount !== undefined && discount <= 0) throw new Error("Discount must be positive");
      if (type !== undefined && !["PERCENTAGE", "FIXED"].includes(type)) throw new Error("Invalid voucher type");
      if (appliesTo !== undefined && !["PRODUCT", "SERVICE"].includes(appliesTo))
        throw new Error("Invalid appliesTo value: must be PRODUCT or SERVICE");
      if (maxUses !== undefined && maxUses !== null && maxUses < 0) throw new Error("maxUses must be non-negative or null");
      if (maxUsesPerUser !== undefined && maxUsesPerUser !== null && maxUsesPerUser < 0)
        throw new Error("maxUsesPerUser must be non-negative or null");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedById))
        throw new Error("Invalid updatedById format: must be a valid UUID");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        throw new Error("Invalid id format: must be a valid UUID");

      const user = await prisma.user.findUnique({ where: { id: updatedById } });
      if (!user) throw new Error(`User with ID ${updatedById} does not exist`);

      const existingVoucher = await prisma.voucher.findUnique({ where: { id } });
      if (!existingVoucher) throw new Error("Voucher not found for the provided id");

      const updateData: Prisma.VoucherUpdateInput = {
        updatedAt: new Date(),
        updatedById,
      };
      if (discount !== undefined) updateData.discount = new Prisma.Decimal(discount);
      if (type !== undefined) updateData.type = type;
      if (maxUses !== undefined) updateData.maxUses = maxUses;
      if (maxUsesPerUser !== undefined) updateData.maxUsesPerUser = maxUsesPerUser;
      if (validFrom !== undefined) updateData.validFrom = validFrom;
      if (validUntil !== undefined) updateData.validUntil = validUntil;
      if (appliesTo !== undefined) updateData.appliesTo = appliesTo;
      if (isActive !== undefined) updateData.isActive = isActive;

      const voucher = await prisma.voucher.update({
        where: { id },
        data: updateData,
      });

      await this.cacheModule.invalidateVoucherCache(voucher.code);

      const auditLogRequest: AuditLogRequest = {
        userId: updatedById,
        action: "VOUCHER_UPDATED",
        details: { voucherId: voucher.id, code: voucher.code, changes: { ...params, updatedById: undefined } },
        entityType: "VOUCHER",
        entityId: voucher.id,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.notificationService.sendTransactionNotification({
        userId: updatedById,
        title: "Voucher Updated",
        message: `Voucher ${voucher.code} updated successfully.`,
        type: "VOUCHER_UPDATE",
        metadata: { voucherId: voucher.id, code: voucher.code, changes: params },
      });

      logger.info("Voucher updated successfully", { updatedById, voucherId: voucher.id, code: voucher.code });
      return { ...voucher, appliesTo: voucher.appliesTo as "PRODUCT" | "SERVICE", updatedById: voucher.updatedById || null };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error updating voucher", { error: errorMessage, updatedById: params.updatedById, id });
      await this.auditLogService.log({
        userId: params.updatedById,
        action: "VOUCHER_UPDATE_FAILED",
        details: { error: errorMessage, id, changes: params },
        entityType: "VOUCHER",
        entityId: null,
      });
      throw new Error(`Failed to update voucher: ${errorMessage}`);
    }
  }

  async getAllVouchers(page: number = 1, pageSize: number = 10): Promise<{ vouchers: Voucher[]; total: number }> {
    try {
      if (page < 1 || pageSize < 1) throw new Error("Invalid pagination parameters");

      const skip = (page - 1) * pageSize;
      const [vouchers, total] = await Promise.all([
        prisma.voucher.findMany({
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        }),
        prisma.voucher.count(),
      ]);

      const formattedVouchers: Voucher[] = vouchers.map((v) => ({
        ...v,
        appliesTo: v.appliesTo as "PRODUCT" | "SERVICE",
        updatedById: v.updatedById || null,
      }));

      logger.info("Vouchers retrieved successfully", { page, pageSize, total });
      return { vouchers: formattedVouchers, total };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error retrieving vouchers", { error: errorMessage });
      throw new Error(`Failed to retrieve vouchers: ${errorMessage}`);
    }
  }

  async checkVoucherEligibility(
    userId: string,
    voucherCode: string,
    context: "PRODUCT" | "SERVICE"
  ): Promise<{ eligible: boolean; voucher: Voucher | null; message: string }> {
    try {
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
        throw new Error("Invalid userId format: must be a valid UUID");
      if (!voucherCode || !/^[A-Z0-9-]+$/.test(voucherCode)) throw new Error("Invalid voucher code format");
      if (!["PRODUCT", "SERVICE"].includes(context))
        throw new Error("Invalid context: Voucher cannot be applied to this transaction type");

      const rawVoucher = await prisma.voucher.findUnique({ where: { code: voucherCode } });
      if (!rawVoucher) return { eligible: false, voucher: null, message: "Voucher not found" };
      if (!rawVoucher.isActive) return { eligible: false, voucher: rawVoucher as Voucher, message: "Voucher is inactive" };
      if (rawVoucher.validUntil < new Date() || rawVoucher.validFrom > new Date())
        return { eligible: false, voucher: rawVoucher as Voucher, message: "Voucher is expired or not yet valid" };
      if (rawVoucher.maxUses !== null && rawVoucher.uses >= rawVoucher.maxUses)
        return { eligible: false, voucher: rawVoucher as Voucher, message: "Voucher has reached maximum uses" };
      if (rawVoucher.appliesTo !== context)
        return { eligible: false, voucher: rawVoucher as Voucher, message: `Voucher not applicable to ${context} transactions` };

      if (rawVoucher.maxUsesPerUser !== null) {
        const userVoucherCount = await prisma.voucherUsage.count({
          where: { voucherId: rawVoucher.id, userId },
        });
        if (userVoucherCount >= rawVoucher.maxUsesPerUser)
          return { eligible: false, voucher: rawVoucher as Voucher, message: "User has reached maximum voucher uses" };
      }

      const voucher: Voucher = {
        ...rawVoucher,
        appliesTo: rawVoucher.appliesTo as "PRODUCT" | "SERVICE",
        updatedById: rawVoucher.updatedById || null,
      };

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "VOUCHER_ELIGIBILITY_CHECKED",
        details: { voucherCode, eligible: true, context },
        entityType: "VOUCHER",
        entityId: voucher.id,
      };
      await this.auditLogService.log(auditLogRequest);

      logger.info("Voucher eligibility checked", { userId, voucherCode, eligible: true, context });
      return { eligible: true, voucher, message: "User is eligible for this voucher" };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error checking voucher eligibility", { error: errorMessage, userId, voucherCode, context });
      await this.auditLogService.log({
        userId,
        action: "VOUCHER_ELIGIBILITY_CHECK_FAILED",
        details: { error: errorMessage, voucherCode, context },
        entityType: "VOUCHER",
        entityId: null,
      });
      throw new Error(`Failed to check voucher eligibility: ${errorMessage}`);
    }
  }

  async validateVoucher(
    userId: string,
    voucherCode: string,
    context: "PRODUCT" | "SERVICE",
    amount: number
  ): Promise<{ discount: number; valid: boolean; voucher: Voucher | null }> {
    try {
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
        throw new Error("Invalid userId format: must be a valid UUID");
      if (!voucherCode || !/^[A-Z0-9-]+$/.test(voucherCode)) throw new Error("Invalid voucher code format");
      if (!["PRODUCT", "SERVICE"].includes(context))
        throw new Error("Invalid context: Voucher cannot be applied to this transaction type");
      if (amount <= 0) throw new Error("Amount must be positive");

      const rawVoucher = await prisma.voucher.findUnique({ where: { code: voucherCode } });
      if (!rawVoucher) {
        logger.warn("Voucher not found", { userId, voucherCode });
        return { discount: 0, valid: false, voucher: null };
      }

      if (
        !rawVoucher.isActive ||
        rawVoucher.validUntil < new Date() ||
        rawVoucher.validFrom > new Date() ||
        (rawVoucher.maxUses !== null && rawVoucher.uses >= rawVoucher.maxUses)
      ) {
        logger.warn("Invalid or expired voucher", { userId, voucherCode });
        return { discount: 0, valid: false, voucher: rawVoucher as Voucher };
      }

      if (rawVoucher.appliesTo !== context) {
        logger.warn("Voucher not applicable to this context", { userId, voucherCode, context, appliesTo: rawVoucher.appliesTo });
        return { discount: 0, valid: false, voucher: rawVoucher as Voucher };
      }

      if (rawVoucher.maxUsesPerUser !== null) {
        const userVoucherCount = await prisma.voucherUsage.count({
          where: { voucherId: rawVoucher.id, userId },
        });
        if (userVoucherCount >= rawVoucher.maxUsesPerUser) {
          logger.warn("User has reached maximum voucher uses", { userId, voucherCode });
          return { discount: 0, valid: false, voucher: rawVoucher as Voucher };
        }
      }

      const voucher: Voucher = {
        ...rawVoucher,
        appliesTo: rawVoucher.appliesTo as "PRODUCT" | "SERVICE",
        updatedById: rawVoucher.updatedById || null,
      };

      const discount = voucher.type === "PERCENTAGE" ? (voucher.discount.toNumber() / 100) * amount : voucher.discount.toNumber();
      const finalDiscount = Math.min(discount, amount);

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "VOUCHER_VALIDATED",
        details: { voucherCode, discount: finalDiscount, context },
        entityType: "VOUCHER",
        entityId: voucher.id,
      };
      await this.auditLogService.log(auditLogRequest);

      logger.info("Voucher validated successfully", { userId, voucherCode, discount: finalDiscount, context });
      return { discount: finalDiscount, valid: true, voucher };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error validating voucher", { error: errorMessage, userId, voucherCode, context });
      await this.auditLogService.log({
        userId,
        action: "VOUCHER_VALIDATION_FAILED",
        details: { error: errorMessage, voucherCode, context },
        entityType: "VOUCHER",
        entityId: null,
      });
      throw new Error(`Failed to validate voucher: ${errorMessage}`);
    }
  }

  async redeemVoucher(userId: string, voucherCode: string): Promise<WalletTransaction> {
    try {
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
        throw new Error("Invalid userId format: must be a valid UUID");
      if (!voucherCode || !/^[A-Z0-9-]+$/.test(voucherCode)) throw new Error("Invalid voucher code format");

      await ensureWalletExists(userId);
      const entityId = uuidv4();
      await this.fraudDetectionService.checkForSuspiciousActivity(userId, 0, "VOUCHER_REDEMPTION", "WALLET_TRANSACTION", entityId);

      const transaction = await retry(
        async () => {
          return await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) throw new Error("Wallet not found");

            const rawVoucher = await tx.voucher.findUnique({ where: { code: voucherCode } });
            if (
              !rawVoucher ||
              !rawVoucher.isActive ||
              rawVoucher.validUntil < new Date() ||
              rawVoucher.validFrom > new Date() ||
              (rawVoucher.maxUses !== null && rawVoucher.uses >= rawVoucher.maxUses)
            ) {
              throw new Error("Invalid or expired voucher");
            }

            if (rawVoucher.appliesTo !== "WALLET") throw new Error("Voucher not applicable to wallet credits");

            const voucher: Voucher = {
              ...rawVoucher,
              appliesTo: rawVoucher.appliesTo as "PRODUCT" | "SERVICE",
              updatedById: rawVoucher.updatedById || null,
            };

            const amount = voucher.discount.toNumber();

            await tx.wallet.update({
              where: { userId },
              data: { balance: { increment: amount }, updatedAt: new Date() },
            });
            await this.cacheModule.invalidateBalanceCache(userId);

            const transactionData: Prisma.WalletTransactionCreateInput = {
              id: uuidv4(),
              user: { connect: { id: userId } },
              wallet: { connect: { id: wallet.id } },
              amount: new Prisma.Decimal(amount),
              transactionType: TransactionType.DEPOSIT,
              status: TransactionStatus.COMPLETED,
              metadata: {
                voucherCode,
                voucherDiscount: amount,
                webhookStatus: "PENDING",
              } as WalletTransactionMetadata,
            };

            const createdTransaction = await tx.walletTransaction.create({ data: transactionData });

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

            await this.notificationService.sendTransactionNotification({
              userId,
              title: "Voucher Redeemed",
              message: `Voucher ${voucherCode} worth ${amount} has been credited to your wallet.`,
              type: "VOUCHER_REDEMPTION",
              metadata: { voucherCode, voucherDiscount: amount },
            });

            return createdTransaction;
          });
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn("Retrying voucher redemption transaction", { userId, attempt, error });
          },
        }
      );

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "VOUCHER_REDEMPTION_COMPLETED",
        details: { voucherCode, amount: transaction.amount.toNumber() },
        entityType: "WALLET_TRANSACTION",
        entityId: transaction.id,
      };
      await this.auditLogService.log(auditLogRequest);

      await this.webhookModule.triggerWebhook(
        userId,
        transaction,
        `VOUCHER_REDEMPTION_${transaction.status}`
      );

      logger.info("Voucher redeemed", {
        userId,
        transactionId: transaction.id,
        voucherCode,
        amount: transaction.amount.toNumber(),
      });
      return transaction;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error redeeming voucher", { error: errorMessage, userId, voucherCode });
      await this.auditLogService.log({
        userId,
        action: "VOUCHER_REDEMPTION_FAILED",
        details: { error: errorMessage, voucherCode },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      await this.webhookModule.triggerWebhook(
        userId,
        { id: uuidv4(), status: TransactionStatus.FAILED },
        "VOUCHER_REDEMPTION_FAILED"
      );
      throw new Error(`Voucher redemption failed: ${errorMessage}`);
    }
  }

  async applyVoucher(
    userId: string,
    voucherCode: string,
    entityType: "PRODUCT" | "SERVICE",
    entityId: string,
    amount: number
  ): Promise<{ discountAmount: number; newTotal: number; voucher: Voucher }> {
    try {
      if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
        throw new Error("Invalid userId format: must be a valid UUID");
      if (!voucherCode || !/^[A-Z0-9-]+$/.test(voucherCode)) throw new Error("Invalid voucher code format");
      if (!["PRODUCT", "SERVICE"].includes(entityType)) throw new Error("Invalid entityType: must be PRODUCT or SERVICE");
      if (!entityId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId))
        throw new Error("Invalid entityId format: must be a valid UUID");
      if (amount <= 0) throw new Error("Amount must be positive");

      // Validate entity exists based on entityType
      if (entityType === "PRODUCT") {
        const productOrder = await prisma.productOrder.findUnique({ where: { id: entityId } });
        if (!productOrder) throw new Error("Product order not found");
      } else {
        const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: entityId } });
        if (!serviceOrder) throw new Error("Service order not found");
      }

      const rawVoucher = await prisma.voucher.findUnique({ where: { code: voucherCode } });
      if (
        !rawVoucher ||
        !rawVoucher.isActive ||
        rawVoucher.validUntil < new Date() ||
        rawVoucher.validFrom > new Date() ||
        (rawVoucher.maxUses !== null && rawVoucher.uses >= rawVoucher.maxUses)
      ) {
        throw new Error("Invalid or expired voucher");
      }

      if (rawVoucher.appliesTo !== entityType) throw new Error(`Voucher not applicable to ${entityType} transactions`);

      if (rawVoucher.maxUsesPerUser !== null) {
        const userVoucherCount = await prisma.voucherUsage.count({
          where: { voucherId: rawVoucher.id, userId },
        });
        if (userVoucherCount >= rawVoucher.maxUsesPerUser) throw new Error("User has reached maximum voucher uses");
      }

      const voucher: Voucher = {
        ...rawVoucher,
        appliesTo: rawVoucher.appliesTo as "PRODUCT" | "SERVICE",
        updatedById: rawVoucher.updatedById || null,
      };

      const discountAmount =
        voucher.type === "PERCENTAGE" ? (voucher.discount.toNumber() / 100) * amount : voucher.discount.toNumber();
      const finalDiscount = Math.min(discountAmount, amount);
      const newTotal = amount - finalDiscount;

      const auditLogRequest: AuditLogRequest = {
        userId,
        action: "VOUCHER_APPLIED",
        details: { voucherCode, discountAmount: finalDiscount, entityType, entityId },
        entityType: entityType === "PRODUCT" ? "PRODUCT_ORDER" : "SERVICE_ORDER",
        entityId,
      };
      await this.auditLogService.log(auditLogRequest);

      logger.info("Voucher applied", { userId, voucherCode, discountAmount: finalDiscount, entityType, entityId });
      return {
        discountAmount: finalDiscount,
        newTotal,
        voucher,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error applying voucher", { error: errorMessage, userId, voucherCode, entityType, entityId });
      await this.auditLogService.log({
        userId,
        action: "VOUCHER_APPLICATION_FAILED",
        details: { error: errorMessage, voucherCode, entityType, entityId },
        entityType: entityType === "PRODUCT" ? "PRODUCT_ORDER" : "SERVICE_ORDER",
        entityId: null,
      });
      throw new Error(`Failed to apply voucher: ${errorMessage}`);
    }
  }

  async redeemVoucherController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for redeemVoucher", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Use checkRole to verify user has CUSTOMER role
      if (!this.checkRole(user, "CUSTOMER")) {
        logger.warn("Unauthorized access attempt to redeemVoucher", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "User unauthorized: Must have CUSTOMER role" });
        return;
      }

      if (!req.body) {
        logger.warn("Request body is null", { userId: user.id });
        res.status(400).json({ error: "Request body is missing" });
        return;
      }

      const { error, value } = redeemVoucherSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for redeemVoucher request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { voucherCode } = value;

      const idempotencyKey = `redeemVoucher:${voucherCode}:${user.id}`;
      const redis = await getRedisClient();
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate redeemVoucher request ignored", { userId: user.id, voucherCode });
        res.status(200).json({ message: "Voucher redemption already processed", transaction: parsed });
        return;
      }

      logger.info("Redeeming voucher", { userId: user.id, voucherCode });

      const transaction = await this.redeemVoucher(user.id, voucherCode);

      const transactionData = {
        id: transaction.id,
        userId: user.id,
        amount: transaction.amount.toNumber().toFixed(2),
        status: transaction.status,
        voucherCode,
      };
      await redis.set(idempotencyKey, JSON.stringify(transactionData), { EX: 24 * 60 * 60 });

      await this.auditLogService.log({
        userId: user.id,
        action: "VOUCHER_REDEEMED",
        details: { transactionId: transaction.id, voucherCode },
        entityType: "WALLET_TRANSACTION",
        entityId: transaction.id,
      });

      logger.info("Voucher redeemed successfully", { userId: user.id, transactionId: transaction.id });
      res.status(200).json({
        message: "Voucher redeemed successfully",
        transaction: { ...transaction, amount: transaction.amount.toNumber().toFixed(2) },
      });
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      logger.error("Error redeeming voucher", { error: errorMessage, userId: req.user?.id || "unknown" });
      await this.auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHER_REDEMPTION_FAILED",
        details: { error: errorMessage, voucherCode: req.body?.voucherCode || "unknown" },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      });
      res.status(400).json({ error: `Voucher redemption failed: ${errorMessage}` });
      next(error);
    }
  }

  async applyVoucherController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for applyVoucher", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Use checkRole to verify user has CUSTOMER role
      if (!this.checkRole(user, "CUSTOMER")) {
        logger.warn("Unauthorized access attempt to applyVoucher", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "User unauthorized: Must have CUSTOMER role" });
        return;
      }

      if (!req.body) {
        logger.warn("Request body is null", { userId: user.id });
        res.status(400).json({ error: "Request body is missing" });
        return;
      }

      const { error, value } = applyVoucherSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for applyVoucher request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { voucherCode, orderId, orderType, amount } = value;

      const idempotencyKey = `applyVoucher:${voucherCode}:${orderId}:${user.id}`;
      const redis = await getRedisClient();
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate applyVoucher request ignored", { userId: user.id, voucherCode, orderId });
        res.status(200).json({ message: "Voucher application already processed", data: parsed });
        return;
      }

      logger.info("Applying voucher to order", { userId: user.id, voucherCode, orderId, orderType });

      const entityType = orderType === "PRODUCT" ? "PRODUCT" : "SERVICE";
      const result = await this.applyVoucher(user.id, voucherCode, entityType, orderId, amount);

      const responseData = {
        discountAmount: result.discountAmount.toFixed(2),
        newTotal: result.newTotal.toFixed(2),
        voucherDetails: {
          code: result.voucher.code,
          discount: result.voucher.discount.toNumber(),
          type: result.voucher.type,
          validUntil: result.voucher.validUntil,
        },
      };

      await redis.set(idempotencyKey, JSON.stringify(responseData), { EX: 24 * 60 * 60 });

      await this.auditLogService.log({
        userId: user.id,
        action: "VOUCHER_APPLIED",
        details: { voucherCode, orderId, orderType, discountAmount: result.discountAmount },
        entityType: entityType === "PRODUCT" ? "PRODUCT_ORDER" : "SERVICE_ORDER",
        entityId: orderId,
      });

      logger.info("Voucher applied successfully", { userId: user.id, orderId, voucherCode });
      res.status(200).json({
        message: "Voucher applied successfully",
        data: responseData,
      });
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      logger.error("Error applying voucher", { error: errorMessage, userId: req.user?.id || "unknown" });
      await this.auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHER_APPLICATION_FAILED",
        details: { error: errorMessage, voucherCode: req.body?.voucherCode || "unknown", orderId: req.body?.orderId || "unknown" },
        entityType: req.body?.orderType === "PRODUCT" ? "PRODUCT_ORDER" : "SERVICE_ORDER",
        entityId: null,
      });
      res.status(400).json({ error: `Voucher application failed: ${errorMessage}` });
      next(error);
    }
  }
}

export default new VoucherModule();