import { Request } from "express";
import { createHmac } from "crypto";
import { PrismaClient, PaymentMethod } from "@prisma/client";
import { getRedisClient } from "../../config/redis";
import { logger } from "../../utils/logger";
import asyncRetry from "async-retry";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import { z } from "zod";

const prisma = new PrismaClient();

// Rate limiters
export const topUpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || "anonymous",
  message: "Too many top-up requests. Please try again later.",
});

export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.user?.id || "anonymous",
  message: "Too many payment requests. Please try again later.",
});

export const voucherRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || "anonymous",
  message: "Too many voucher requests. Please try again later.",
});

export const billPaymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || "anonymous",
  message: "Too many bill payment requests. Please try again later.",
});

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip || "unknown",
  message: "Too many webhook requests. Please try again later.",
});

// Zod validation schemas
export const topUpSchema = z
  .object({
    amount: z.number().positive("Amount must be positive"),
    paymentMethod: z.enum(Object.values(PaymentMethod) as [string, ...string[]], {
      errorMap: () => ({
        message: `Payment method must be one of: ${Object.values(PaymentMethod).join(", ")}`,
      }),
    }),
    transactionReference: z.string().optional(),
    cardDetails: z
      .object({
        cardno: z.string().optional(),
        cvv: z.string().optional(),
        expirymonth: z.string().optional(),
        expiryyear: z.string().optional(),
        pin: z.string().optional(),
        suggested_auth: z.string().optional(),
        billingzip: z.string().optional(),
        billingcity: z.string().optional(),
        billingaddress: z.string().optional(),
        billingstate: z.string().optional(),
        billingcountry: z.string().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (["CARD", "FLUTTERWAVE"].includes(data.paymentMethod)) {
        return true;
      }
      return !data.cardDetails;
    },
    {
      message: '"cardDetails" is not allowed for this payment method',
      path: ["cardDetails"],
    }
  );

export const payWithWalletSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  orderId: z.string().uuid("Valid orderId is required"),
  orderType: z.enum(["diesel", "petrol", "gas", "electricity"], {
    errorMap: () => ({
      message: "Order type must be one of: diesel, petrol, gas, electricity",
    }),
  }),
  voucherCode: z
    .string()
    .regex(/^[A-Z0-9-]+$/, "Voucher code must be alphanumeric with hyphens")
    .optional(),
});

export const redeemVoucherSchema = z.object({
  voucherCode: z
    .string()
    .regex(/^[A-Z0-9-]+$/, "Voucher code must be alphanumeric with hyphens")
    .nonempty("Voucher code is required"),
});

export const validateMeterSchema = z.object({
  meterNumber: z
    .string()
    .regex(/^\d{8,12}$/, "Meter number must be 8-12 digits")
    .nonempty("Meter number is required"),
  providerId: z.number().positive("Provider ID must be positive"),
});

export const applyVoucherSchema = z.object({
  voucherCode: z
    .string()
    .regex(/^[A-Z0-9-]+$/, "Voucher code must be alphanumeric with hyphens")
    .nonempty("Voucher code is required"),
  orderId: z.string().uuid("Valid orderId is required"),
  orderType: z.enum(["diesel", "petrol", "gas", "electricity"], {
    errorMap: () => ({
      message: "Order type must be one of: diesel, petrol, gas, electricity",
    }),
  }),
  amount: z.number().positive("Amount must be positive"),
});

export const billPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  meterNumber: z
    .string()
    .regex(/^\d{8,12}$/, "Meter number must be 8-12 digits")
    .nonempty("Meter number is required"),
  providerId: z.number().positive("Provider ID must be positive"),
});

export const validatePaymentSchema = z.object({
  transactionRef: z.string().nonempty("Transaction reference is required"),
});

export const createVirtualAccountSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const processVirtualAccountPaymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  orderId: z.string().uuid("Invalid order ID format"),
  orderType: z.enum(["diesel", "petrol", "gas", "electricity"], {
    errorMap: () => ({
      message: "Valid orderType is required (diesel, petrol, gas, electricity)",
    }),
  }),
});

// Utility functions
export const verifyWebhookSignature = (payload: any, signature: string): boolean => {
  const secret = process.env.MONNIFY_CLIENT_SECRET || "secret";
  const computedSignature = createHmac("sha512", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  return computedSignature === signature;
};

export const logWebhookAttempt = async (
  walletTransactionId: string | null,
  eventType: string,
  webhookUrl: string,
  payload: any,
  status: string,
  response?: any
): Promise<void> => {
  try {
    if (walletTransactionId) {
      const transaction = await prisma.walletTransaction.findUnique({
        where: { id: walletTransactionId },
      });
      if (!transaction) {
        logger.warn("Skipping webhook attempt log due to invalid walletTransactionId", {
          walletTransactionId,
          eventType,
          webhookUrl,
        });
        return;
      }
    }

    await prisma.webhookAttempt.create({
      data: {
        id: uuidv4(),
        walletTransactionId,
        eventType,
        webhookUrl,
        payload,
        status,
        attempts: 1,
        lastAttemptAt: new Date(),
        response,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to log webhook attempt", {
      error: errorMessage,
      walletTransactionId,
      eventType,
      metadata: { webhookUrl, status },
    });
  }
};

export const checkRole = async (req: Request, allowedRoles: string[]): Promise<boolean> => {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user?.id) {
    logger.warn("No user or user ID in request for role check", {
      metadata: { user: user ?? "undefined" },
    });
    return false;
  }
  try {
    const userRecord = await asyncRetry(
      async () => {
        const record = await prisma.user.findUnique({
          where: { id: user.id },
          include: { role: true }, // Include Role relation
        });
        if (!record) {
          throw new Error(`User not found: ${user.id}`);
        }
        return record;
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onRetry: (err: Error) => {
          logger.warn("Retrying user role fetch", {
            error: err.message,
            userId: user.id,
          });
        },
      }
    );
    if (!userRecord.role) {
      logger.warn("User has no role assigned", { userId: user.id });
      return false;
    }
    const hasRole = allowedRoles.includes(userRecord.role.name);
    logger.debug("Role check completed", {
      userId: user.id,
      role: userRecord.role.name,
      allowedRoles,
      hasRole,
    });
    return hasRole;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error checking user role", {
      error: errorMessage,
      userId: user.id,
      metadata: { allowedRoles },
    });
    return false;
  }
};

export const invalidateBalanceCache = async (userId: string): Promise<void> => {
  try {
    const redis = await getRedisClient();
    const cacheKey = `balance:${userId}`;
    await redis.del(cacheKey);
    logger.info("Balance cache invalidated", { userId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to invalidate balance cache", {
      userId,
      error: errorMessage,
    });
  }
};