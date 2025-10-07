// src/cacheModule.ts
import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "../../config/redis";
import CircuitBreaker from "opossum";
import retry from "async-retry";
import { logger } from "../../utils/logger";

const metrics = {
  webhookSuccess: 0,
  webhookFailures: 0,
  redisFailures: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

const circuitBreakerOptions = {
  timeout: 1000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};
const redisCircuitBreaker = new CircuitBreaker(
  async (fn: () => Promise<any>) => fn(),
  circuitBreakerOptions
);

const prisma = new PrismaClient();

export class CacheModule {
  async invalidateBalanceCache(userId: string): Promise<number> {
    try {
      const redis = await getRedisClient();
      const cacheKeys = [
        `wallet_balance:${userId}`,
        `wallet:balance:${userId}`,
      ];

      const deleted = await redisCircuitBreaker.fire(async () => {
        return await retry(
          async () => {
            const result = await redis.del(cacheKeys);
            metrics.cacheMisses++;
            logger.info("Cache invalidation successful", { userId, cacheKeys, deleted });
            return result;
          },
          {
            retries: 2,
            factor: 2,
            minTimeout: 500,
            maxTimeout: 2000,
            onRetry: (error, attempt) => {
              logger.warn("Retrying cache invalidation", { userId, attempt, error });
            },
          }
        );
      });

      return deleted;
    } catch (error) {
      metrics.redisFailures++;
      logger.error("Redis cache invalidation failed, falling back to database", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async invalidateVoucherCache(voucherCode: string): Promise<number> {
    try {
      const redis = await getRedisClient();
      const cacheKey = `voucher:${voucherCode}`;

      const deleted = await redisCircuitBreaker.fire(async () => {
        return await retry(
          async () => {
            const result = await redis.del(cacheKey);
            metrics.cacheMisses++;
            logger.info("Voucher cache invalidation successful", { voucherCode, cacheKey, deleted });
            return result;
          },
          {
            retries: 2,
            factor: 2,
            minTimeout: 500,
            maxTimeout: 2000,
            onRetry: (error, attempt) => {
              logger.warn("Retrying voucher cache invalidation", { voucherCode, attempt, error });
            },
          }
        );
      });

      return deleted;
    } catch (error) {
      metrics.redisFailures++;
      logger.error("Redis voucher cache invalidation failed", {
        voucherCode,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async getBalance(userId: string): Promise<number> {
    try {
      if (!userId || typeof userId !== "string") throw new Error("Invalid user ID format");

      const cacheKey = `wallet_balance:${userId}`;
      const redis = await getRedisClient();
      let cachedBalance: string | null = null;

      try {
        cachedBalance = await redisCircuitBreaker.fire(async () => {
          const result = await redis.get(cacheKey);
          if (result) metrics.cacheHits++;
          else metrics.cacheMisses++;
          return result;
        });
      } catch (redisError) {
        metrics.redisFailures++;
        logger.warn("Redis connection error during balance retrieval, falling back to database", {
          userId,
          error: redisError instanceof Error ? redisError.message : String(redisError),
        });
      }

      if (cachedBalance) {
        logger.info("Balance retrieved from cache", { userId, balance: cachedBalance });
        return parseFloat(cachedBalance);
      }

      logger.info("Cache miss, fetching balance from database", { userId });

      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error("Wallet not found");

      const balance = wallet.balance.toNumber();
      try {
        await redisCircuitBreaker.fire(async () => {
          await redis.del(cacheKey);
          await redis.set(cacheKey, balance.toString(), { EX: 3600 });
          logger.info("Balance cached successfully after explicit deletion", { userId, balance });
        });
      } catch (redisError) {
        metrics.redisFailures++;
        logger.warn("Failed to cache balance, continuing with database value", {
          userId,
          error: redisError instanceof Error ? redisError.message : String(redisError),
        });
      }

      logger.info("Balance retrieved from database", { userId, balance });
      return balance;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Error fetching wallet balance", { error: errorMessage, userId });
      throw new Error("Failed to retrieve wallet balance: " + errorMessage);
    }
  }

  async getCachedTransactions(userId: string, limit: number, offset: number): Promise<any[]> {
    try {
      const cacheKey = `wallet_transactions:${userId}:${limit}:${offset}`;
      const redis = await getRedisClient();
      let cachedTransactions: string | null = null;

      try {
        cachedTransactions = await redisCircuitBreaker.fire(async () => {
          const result = await redis.get(cacheKey);
          if (result) metrics.cacheHits++;
          else metrics.cacheMisses++;
          return result;
        });
      } catch (redisError) {
        metrics.redisFailures++;
        logger.warn("Redis error during transaction retrieval, falling back to database", { userId, error: redisError });
      }

      if (cachedTransactions) {
        logger.info("Transactions retrieved from cache", { userId });
        return JSON.parse(cachedTransactions);
      }

      return [];
    } catch (error) {
      metrics.redisFailures++;
      logger.error("Error retrieving cached transactions", { userId, error });
      return [];
    }
  }

  async cacheTransactions(userId: string, transactions: any[], limit: number, offset: number): Promise<void> {
    try {
      const cacheKey = `wallet_transactions:${userId}:${limit}:${offset}`;
      const redis = await getRedisClient();
      await redisCircuitBreaker.fire(async () => {
        await redis.set(cacheKey, JSON.stringify(transactions), { EX: 600 });
      });
    } catch (redisError) {
      metrics.redisFailures++;
      logger.warn("Failed to cache transactions, continuing with database data", { userId, error: redisError });
    }
  }

  async getMetrics(): Promise<any> {
    return metrics;
  }
}

export default new CacheModule();