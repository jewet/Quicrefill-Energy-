import { Request } from "express";
import { createHmac } from "crypto";
import { PrismaClient, Prisma, PaymentMethod } from "@prisma/client";
import Joi from "joi";
import rateLimit from "express-rate-limit";
import asyncRetry from "async-retry";
import { getRedisClient } from "../../config/redis";
import { logger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

// Initialize Prisma client
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

// Validation schemas
export const topUpSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  paymentMethod: Joi.string()
    .valid(...Object.values(PaymentMethod))
    .required()
    .messages({
      "any.only": `Payment method must be one of: ${Object.values(PaymentMethod).join(", ")}`,
      "any.required": "Payment method is required",
    }),
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
  })
    .when("paymentMethod", {
      is: PaymentMethod.CARD,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    })
    .messages({
      "any.required": "Card details are required for CARD payment method",
      "any.unknown": "Card details are not allowed for this payment method",
    }),
});

export const payWithWalletSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  orderId: Joi.string().uuid().required().messages({
    "string.uuid": "Valid orderId is required",
    "any.required": "OrderId is required",
  }),
  orderType: Joi.string().required().messages({
    "any.required": "Order type is required",
  }),
  voucherCode: Joi.string()
    .pattern(/^[A-Z0-9-]+$/)
    .optional()
    .messages({
      "string.pattern.base": "Voucher code must be alphanumeric with hyphens",
    }),
});

export const redeemVoucherSchema = Joi.object({
  voucherCode: Joi.string()
    .pattern(/^[A-Z0-9-]+$/)
    .required()
    .messages({
      "string.pattern.base": "Voucher code must be alphanumeric with hyphens",
      "any.required": "Voucher code is required",
    }),
});

export const validateMeterSchema = Joi.object({
  meterNumber: Joi.string()
    .pattern(/^\d{8,12}$/)
    .required()
    .messages({
      "string.pattern.base": "Meter number must be 8-12 digits",
      "any.required": "Meter number is required",
    }),
  providerId: Joi.number().positive().required().messages({
    "number.positive": "Provider ID must be positive",
    "any.required": "Provider ID is required",
  }),
});

export const applyVoucherSchema = Joi.object({
  voucherCode: Joi.string()
    .pattern(/^[A-Z0-9-]+$/)
    .required()
    .messages({
      "string.pattern.base": "Voucher code must be alphanumeric with hyphens",
      "any.required": "Voucher code is required",
    }),
  orderId: Joi.string().uuid().required().messages({
    "string.uuid": "Valid orderId is required",
    "any.required": "OrderId is required",
  }),
  orderType: Joi.string().required().messages({
    "any.required": "Order type is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
});

export const billPaymentSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  meterNumber: Joi.string()
    .pattern(/^\d{8,12}$/)
    .required()
    .messages({
      "string.pattern.base": "Meter number must be 8-12 digits",
      "any.required": "Meter number is required",
    }),
  providerId: Joi.number().positive().required().messages({
    "number.positive": "Provider ID must be positive",
    "any.required": "Provider ID is required",
  }),
});

export const validatePaymentSchema = Joi.object({
  transactionRef: Joi.string().required().messages({
    "any.required": "Transaction reference is required",
  }),
});

// Utility functions
export const verifyWebhookSignature = (payload: any, signature: string): boolean => {
  const secret = process.env.WEBHOOK_SECRET || "secret";
  const computedSignature = createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  return computedSignature === signature;
};

export const logWebhookAttempt = async (
  transactionId: string | null,
  eventType: string,
  webhookUrl: string,
  payload: any,
  status: string,
  response?: Prisma.InputJsonValue
): Promise<void> => {
  try {
    if (transactionId) {
      const transaction = await prisma.walletTransaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction) {
        logger.warn("Skipping webhook attempt log due to invalid transactionId", {
          transactionId,
          eventType,
          webhookUrl,
        });
        return;
      }
    }

    await prisma.webhookAttempt.create({
      data: {
        id: uuidv4(),
        walletTransactionId: transactionId,
        eventType,
        webhookUrl,
        payload,
        status,
        attempts: 1,
        lastAttemptAt: new Date(),
        response,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Prisma.WebhookAttemptUncheckedCreateInput,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to log webhook attempt", {
      error: errorMessage,
      transactionId,
      eventType,
      metadata: { webhookUrl, status },
    });
  }
};

export const checkRole = async (req: Request, allowedRoles: string[]): Promise<boolean> => {
  const user = req.user;
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
          select: {
            role: {
              select: { name: true },
            },
          },
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
    const hasRole = userRecord.role ? allowedRoles.includes(userRecord.role.name) : false;
    logger.debug("Role check completed", {
      userId: user.id,
      role: userRecord.role?.name,
      allowedRoles,
      hasRole,
    });
    return hasRole || user.isAdmin;
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