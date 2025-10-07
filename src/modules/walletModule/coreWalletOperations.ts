import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient, TransactionStatus, PaymentMethod } from "@prisma/client";
import { getRedisClient } from "../../config/redis";
import { logger } from "../../utils/logger";
import { addAuditLogJob } from "../../queues/auditLogQueue";
import { checkRole } from "./middlewareAndValidation";
import transactionCoreModule from "./transactionCoreModule";
import { WalletTransactionMetadata } from "../types/types";

// Initialize Prisma client
const prisma = new PrismaClient();

// Interface for TopUp request body
interface TopUpRequestBody {
  amount: number;
  paymentMethod: string;
  transactionReference?: string;
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
  };
}

// Interface for getTransactionHistory request body
interface TransactionHistoryRequestBody {
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  type?: "DEPOSIT" | "DEDUCTION" | "REFUND" | "WITHDRAWAL";
  startDate?: Date | string;
  endDate?: Date | string;
}

export class CoreWalletOperations {
  async topUp(req: Request<{}, {}, TopUpRequestBody>, res: Response, next: NextFunction): Promise<void> {
    const user = req.user;
    const requestId = req.requestId ?? uuidv4();

    try {
      // Authentication and authorization checks
      if (!user?.id) {
        logger.warn("No user or user ID in topUp request", { requestId, metadata: { user: user ?? "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["CUSTOMER"]))) {
        logger.warn("Unauthorized topUp attempt", { requestId, userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "User unauthorized" });
        return;
      }

      // Validate request body
      const topUpSchema = Joi.object({
        amount: Joi.number().positive().required(),
        paymentMethod: Joi.string()
          .valid("CARD", "TRANSFER", "VIRTUAL_ACCOUNT", "PAY_ON_DELIVERY")
          .required(),
        transactionReference: Joi.string().optional(),
        cardDetails: Joi.object({
          cardno: Joi.string().required(),
          cvv: Joi.string().required(),
          expirymonth: Joi.string().required(),
          expiryyear: Joi.string().required(),
          pin: Joi.string().optional(),
          suggested_auth: Joi.string().optional(),
          billingzip: Joi.string().optional(),
          billingcity: Joi.string().optional(),
          billingaddress: Joi.string().optional(),
          billingstate: Joi.string().optional(),
          billingcountry: Joi.string().optional(),
        }).optional(),
      });

      const { error, value } = topUpSchema.validate(req.body, { abortEarly: false });
      if (error) {
        logger.warn("Validation failed for topUp request", { requestId, userId: user.id, error: error.details });
        res.status(400).json({ error: error.details.map((e) => e.message).join(", ") });
        return;
      }

      const { amount, paymentMethod, transactionReference, cardDetails } = value as TopUpRequestBody;

      // Map payment method to Prisma enum
      const paymentMethodMap: Record<string, PaymentMethod> = {
        card: PaymentMethod.CARD,
        transfer: PaymentMethod.TRANSFER,
        virtual_account: PaymentMethod.VIRTUAL_ACCOUNT,
        pay_on_delivery: PaymentMethod.PAY_ON_DELIVERY,
      };
      const validPaymentMethod = paymentMethodMap[paymentMethod.toLowerCase()];
      if (!validPaymentMethod) {
        logger.warn("Invalid payment method for topUp", { requestId, userId: user.id, paymentMethod });
        res.status(400).json({ error: `Invalid payment method: ${paymentMethod}` });
        return;
      }

      // Generate transaction reference
      const ref = transactionReference ?? `TOPUP-${uuidv4()}-${Date.now()}`;
      const idempotencyKey = `topUp:${ref}`;
      const redis = await getRedisClient();

      // Check for duplicate request
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate topUp request ignored", { requestId, userId: user.id, transactionRef: ref });
        res.status(200).json({ message: "Top-up already processed", transaction: parsed });
        return;
      }

      logger.info("Initiating wallet top-up", {
        requestId,
        userId: user.id,
        amount,
        paymentMethod: validPaymentMethod,
        transactionRef: ref,
      });

      // Delegate to TransactionCoreModule.depositFunds
      const transaction = await transactionCoreModule.depositFunds(
        user.id,
        amount,
        validPaymentMethod,
        ref,
        cardDetails
      );

      // Prepare transaction data for response and cache
      const transactionData = {
        id: transaction.id,
        userId: user.id,
        amount: transaction.amount.toFixed(2),
        status: transaction.status,
        transactionRef: ref,
        paymentLink: (transaction.metadata as WalletTransactionMetadata | null)?.paymentLink,
      };

      // Cache transaction data
      await redis.set(idempotencyKey, JSON.stringify(transactionData), { EX: 24 * 60 * 60 });

      // Log audit asynchronously
      addAuditLogJob({
        userId: user.id,
        action: "TOPUP_INITIATED",
        details: { transactionId: transaction.id, amount, paymentMethod: validPaymentMethod, ref },
        entityType: "WALLET_TRANSACTION",
        entityId: transaction.id,
      }).catch((err: unknown) =>
        logger.error("Failed to queue audit log for TOPUP_INITIATED", {
          requestId,
          error: err instanceof Error ? err.message : String(err),
        })
      );

      logger.info("Wallet top-up initiated", {
        requestId,
        userId: user.id,
        transactionRef: ref,
        paymentLink: transactionData.paymentLink,
      });

      res.status(200).json({
        message: "Top-up initiated, complete payment",
        transaction: {
          id: transaction.id,
          amount: transaction.amount.toFixed(2),
          status: transaction.status,
        },
        paymentLink: transactionData.paymentLink,
        transactionRef: ref,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error processing wallet top-up", {
        requestId,
        error: err.message,
        userId: user?.id ?? "unknown",
        metadata: {
          stack: err.stack,
          amount: req.body.amount,
          paymentMethod: req.body.paymentMethod,
        },
      });

      // Queue audit log for failure
      addAuditLogJob({
        userId: user?.id ?? "unknown",
        action: "TOPUP_FAILED",
        details: {
          error: err.message,
          amount: req.body.amount,
          paymentMethod: req.body.paymentMethod,
          transactionRef: req.body.transactionReference ?? `TOPUP-${uuidv4()}-${Date.now()}`,
        },
        entityType: "WALLET_TRANSACTION",
        entityId: null,
      }).catch((err: unknown) =>
        logger.error("Failed to queue audit log for TOPUP_FAILED", {
          requestId,
          error: err instanceof Error ? err.message : String(err),
        })
      );

      const statusCode =
        err.message.includes("Invalid payment method") ||
        err.message.includes("Invalid transaction amount") ||
        err.message.includes("Validation failed") ||
        err.message.includes("Card details required")
          ? 400
          : 500;

      res.status(statusCode).json({ error: `Top-up failed: ${err.message}` });
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user?.id) {
        logger.warn("No user or user ID in request for getBalance", {
          metadata: { user: user ?? "undefined" },
        });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["CUSTOMER"]))) {
        logger.warn("Unauthorized access attempt to getBalance", {
          userId: user.id,
          metadata: { role: user.role },
        });
        res.status(403).json({ error: "User unauthorized" });
        return;
      }

      // Check if wallet exists, create if not
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        logger.info("Creating wallet for user", { userId: user.id });
        await prisma.wallet.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            balance: 0,
          },
        });
        res.status(200).json({ userId: user.id, balance: "0.00" });
        return;
      }

      // Delegate to TransactionCoreModule.getWalletBalance
      const balance = await transactionCoreModule.getWalletBalance(wallet.id);
      logger.info("Balance retrieved successfully", {
        userId: user.id,
        balance: balance.availableBalance,
      });
      res.status(200).json({ userId: user.id, balance: balance.availableBalance.toFixed(2) });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error fetching wallet balance", {
        error: err.message,
        userId: req.user?.id ?? "unknown",
        metadata: { stack: err.stack },
      });
      res.status(500).json({ error: `Failed to retrieve wallet balance: ${err.message}` });
      next(err);
    }
  }

  async getTransactionHistory(
    req: Request<{}, {}, TransactionHistoryRequestBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user;
      if (!user?.id) {
        logger.warn("No user or user ID in request for getTransactionHistory", {
          metadata: { user: user ?? "undefined" },
        });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["CUSTOMER"]))) {
        logger.warn("Unauthorized access attempt to getTransactionHistory", {
          userId: user.id,
          metadata: { userRole: user.role },
        });
        res.status(403).json({ error: "User unauthorized" });
        return;
      }

      // Ensure wallet exists
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        logger.info("Creating wallet for user", { userId: user.id });
        await prisma.wallet.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            balance: 0,
          },
        });
        res.status(200).json({
          message: "Transaction history retrieved successfully",
          data: {
            transactions: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        });
        return;
      }

      const { page = 1, limit = 10, status, type, startDate, endDate } = req.body;

      // Validate request body
      const transactionHistorySchema = Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        status: Joi.string()
          .valid(...Object.values(TransactionStatus))
          .optional(),
        type: Joi.string()
          .valid("DEPOSIT", "DEDUCTION", "REFUND", "WITHDRAWAL")
          .optional(),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
      });

      const { error, value } = transactionHistorySchema.validate(
        { page, limit, status, type, startDate, endDate },
        { stripUnknown: true }
      );

      if (error) {
        logger.warn("Validation failed for getTransactionHistory request", {
          userId: user.id,
          error: error.details,
        });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { page: validatedPage, limit: validatedLimit, status: validatedStatus, type: validatedType, startDate: validatedStartDate, endDate: validatedEndDate } = value;

      logger.info("Fetching transaction history", {
        userId: user.id,
        page: validatedPage,
        limit: validatedLimit,
        status: validatedStatus,
        type: validatedType,
        startDate: validatedStartDate,
        endDate: validatedEndDate,
      });

      // Delegate to TransactionCoreModule.getWalletTransactions
      const transactions = await transactionCoreModule.getWalletTransactions(wallet.id);

      // Apply filtering and pagination
      let filteredTransactions = transactions;
      if (validatedStatus) {
        filteredTransactions = filteredTransactions.filter((tx) => tx.status === validatedStatus);
      }
      if (validatedType) {
        filteredTransactions = filteredTransactions.filter((tx) => tx.transactionType === validatedType);
      }
      if (validatedStartDate || validatedEndDate) {
        filteredTransactions = filteredTransactions.filter((tx) => {
          const createdAt = new Date(tx.createdAt);
          if (validatedStartDate && createdAt < new Date(validatedStartDate)) return false;
          if (validatedEndDate && createdAt > new Date(validatedEndDate)) return false;
          return true;
        });
      }

      const total = filteredTransactions.length;
      const paginatedTransactions = filteredTransactions.slice(
        (validatedPage - 1) * validatedLimit,
        validatedPage * validatedLimit
      );

      // Format transactions for response
      const formattedTransactions = paginatedTransactions.map((tx) => ({
        id: tx.id,
        userId: user.id,
        walletId: wallet.id,
        amount: tx.amount.toFixed(2),
        transactionType: tx.transactionType,
        status: tx.status,
        createdAt: new Date(tx.createdAt),
        updatedAt: new Date(tx.updatedAt),
        metadata: tx.metadata,
      }));

      // Log audit using queueAuditLog
      await transactionCoreModule.queueAuditLog({
        userId: user.id,
        action: "TRANSACTION_HISTORY_RETRIEVED",
        details: { page: validatedPage, limit: validatedLimit, total, walletId: wallet.id },
        entityType: "WALLET",
        entityId: wallet.id,
      });

      logger.info("Transaction history retrieved successfully", {
        userId: user.id,
        total,
      });
      res.status(200).json({
        message: "Transaction history retrieved successfully",
        data: {
          transactions: formattedTransactions,
          pagination: {
            page: validatedPage,
            limit: validatedLimit,
            total,
            totalPages: Math.ceil(total / validatedLimit),
          },
        },
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error fetching transaction history", {
        error: err.message,
        userId: req.user?.id ?? "unknown",
        metadata: { stack: err.stack },
      });
      res.status(500).json({ error: `Failed to retrieve transaction history: ${err.message}` });
      next(err);
    }
  }
}

export default new CoreWalletOperations();