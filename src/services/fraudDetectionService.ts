import { PrismaClient } from "@prisma/client";
import winston from "winston";
import { v4 as uuidv4 } from "uuid";
import { getRedisClient } from "../config/redis"; // Use getRedisClient

const prisma = new PrismaClient();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

export interface FraudCheckRequest {
  userId: string;
  amount: number;
  type: string;
  entityType: string;
  entityId: string;
  vendorId?: string;
}

export interface FraudAlertFilter {
  userId?: string;
  vendorId?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export class FraudDetectionService {
  async checkForSuspiciousActivity(
    userId: string,
    amount: number,
    type: string,
    entityType: string,
    entityId: string,
    vendorId?: string
  ): Promise<void> {
    try {
      if (!userId || !entityType || !entityId) {
        throw new Error("User ID, entity type, and entity ID are required");
      }
      if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new Error("Invalid amount");
      }

      logger.info("Checking for suspicious activity", { userId, vendorId, amount, type, entityType, entityId });

      // Rule 1: Check for unusually high transaction amount
      const maxAmountThreshold = parseFloat(process.env.FRAUD_MAX_AMOUNT || "100000");
      if (amount > maxAmountThreshold) {
        await this.logFraudAlert(
          userId,
          vendorId,
          type,
          entityType,
          entityId,
          amount,
          `Amount exceeds threshold: ${maxAmountThreshold}`
        );
        throw new Error("Transaction amount exceeds maximum allowed");
      }

      // Rule 2: Check for frequent transactions
      const redisClient = await getRedisClient(); // Added await
      const rateLimitKey = `fraud:rate:${userId}:${type}`;
      const transactionCount = await redisClient.incr(rateLimitKey); // Added await
      await redisClient.expire(rateLimitKey, 60); // Added await

      const maxTransactionsPerMinute = parseInt(process.env.FRAUD_MAX_TRANSACTIONS || "5");
      if (transactionCount > maxTransactionsPerMinute) {
        await this.logFraudAlert(
          userId,
          vendorId,
          type,
          entityType,
          entityId,
          amount,
          `Too many transactions: ${transactionCount}`
        );
        throw new Error("Too many transactions in a short period");
      }

      // Rule 3: Check recent transaction history
      const recentTransactions = await prisma.walletTransaction.findMany({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        take: 100,
      });

      const totalAmountLast24Hours = recentTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
      const maxDailyAmount = parseFloat(process.env.FRAUD_MAX_DAILY_AMOUNT || "500000");
      if (totalAmountLast24Hours + amount > maxDailyAmount) {
        await this.logFraudAlert(
          userId,
          vendorId,
          type,
          entityType,
          entityId,
          amount,
          `Daily limit exceeded: ${totalAmountLast24Hours + amount}`
        );
        throw new Error("Daily transaction limit exceeded");
      }

      logger.info("No suspicious activity detected", { userId, vendorId, amount, type, entityType, entityId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error checking for suspicious activity", {
        error: errorMessage,
        userId,
        vendorId,
        amount,
        type,
        entityType,
        entityId,
      });
      await this.logFraudAlert(
        userId,
        vendorId,
        type,
        entityType,
        entityId,
        amount,
        `Fraud check failed: ${errorMessage}`
      );
      throw new Error("Fraud detection failed: " + errorMessage);
    }
  }

  private async logFraudAlert(
    userId: string,
    vendorId: string | undefined,
    type: string,
    entityType: string,
    entityId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    try {
      await prisma.fraudAlert.create({
        data: {
          id: uuidv4(),
          type,
          entityType,
          entityId,
          reason,
          userId,
          vendorId,
          status: "PENDING",
        },
      });

      logger.warn("Fraud alert logged", { userId, vendorId, type, entityType, entityId, amount, reason });
    } catch (error: unknown) {
      logger.error("Error logging fraud alert", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        vendorId,
        type,
        entityType,
        entityId,
        amount,
        reason,
      });
    }
  }
}

export const fraudDetectionService = new FraudDetectionService();