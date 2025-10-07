import { Request, Response, NextFunction } from "express";
import walletService from "../services/walletService";
import { auditLogService } from "../services/auditLogService";
import { logger } from "../utils/logger";
import Joi from "joi";
import { getRedisClient } from "../config/redis";

// Joi Schemas aligned with WalletService
const createVoucherSchema = Joi.object({
  body: Joi.object({
    discount: Joi.number().positive().required().messages({ "number.positive": "Discount must be positive" }),
    type: Joi.string().valid("PERCENTAGE", "FIXED").required(),
    maxUses: Joi.number().integer().positive().allow(null).optional(),
    maxUsesPerUser: Joi.number().integer().positive().allow(null).optional(),
    validFrom: Joi.date().iso().required(),
    validUntil: Joi.date().iso().required(),
    appliesTo: Joi.string().valid("PRODUCT", "SERVICE").required(),
    createdById: Joi.string().uuid().required().messages({ "string.uuid": "Invalid createdById format" }),
  }),
});

const updateVoucherSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().uuid().required().messages({ "string.uuid": "Invalid id format" }),
  }),
  body: Joi.object({
    discount: Joi.number().positive().optional().messages({ "number.positive": "Discount must be positive" }),
    type: Joi.string().valid("PERCENTAGE", "FIXED").optional(),
    maxUses: Joi.number().integer().min(0).allow(null).optional(),
    maxUsesPerUser: Joi.number().integer().min(0).allow(null).optional(),
    validFrom: Joi.date().iso().optional(),
    validUntil: Joi.date().iso().optional(),
    isActive: Joi.boolean().optional(),
    appliesTo: Joi.string().valid("PRODUCT", "SERVICE").optional(),
    updatedById: Joi.string().uuid().required().messages({ "string.uuid": "Invalid updatedById format" }),
  }),
});

const getAllVouchersSchema = Joi.object({
  query: Joi.object({
    page: Joi.string().pattern(/^\d+$/).default("1"),
    pageSize: Joi.string().pattern(/^\d+$/).default("10"),
  }),
});

const validateVoucherSchema = Joi.object({
  body: Joi.object({
    userId: Joi.string().uuid().required().messages({ "string.uuid": "Invalid user ID format" }),
    voucherCode: Joi.string().pattern(/^[A-Z0-9-]+$/).required().messages({ "string.pattern.base": "Invalid voucher code format" }),
    context: Joi.string().valid("PRODUCT", "SERVICE").required(),
    amount: Joi.number().positive().required().messages({ "number.positive": "Amount must be positive" }),
  }),
});

const checkVoucherEligibilitySchema = Joi.object({
  query: Joi.object({
    userId: Joi.string().uuid().required().messages({ "string.uuid": "Invalid user ID format" }),
    voucherCode: Joi.string().pattern(/^[A-Z0-9-]+$/).required().messages({ "string.pattern.base": "Invalid voucher code format" }),
    context: Joi.string().valid("PRODUCT", "SERVICE").required(),
  }),
});

async function checkRole(req: Request, allowedRoles: string[]): Promise<boolean> {
  const user = req.user;
  if (!user || !user.role) {
    return false;
  }
  return allowedRoles.includes(user.role);
}

export class WalletController {
  async validateVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for validateVoucher", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["CUSTOMER", "ADMIN", "MANAGER", "DELIVERY_REP"]))) {
        logger.warn("Unauthorized access attempt to validateVoucher", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "User unauthorized" });
        return;
      }

      const { error, value } = validateVoucherSchema.validate({ body: req.body });
      if (error) {
        logger.warn("Validation failed for validateVoucher request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { userId, voucherCode, context, amount } = value.body;

      if (user.role === "CUSTOMER" && user.id !== userId) {
        logger.warn("Customer attempted to validate voucher for another user", { userId: user.id, requestedUserId: userId });
        res.status(403).json({ error: "Customers can only validate vouchers for themselves" });
        return;
      }

      const idempotencyKey = `validateVoucher:${voucherCode}:${userId}`;
      const redis = await getRedisClient();
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate validateVoucher request ignored", { userId, voucherCode });
        res.status(200).json({
          message: "Voucher validation already processed",
          data: parsed,
        });
        return;
      }

      logger.info("Validating voucher", { userId, voucherCode, context });

      const resultData = await walletService.validateVoucher(userId, voucherCode, context, amount);

      const responseData = {
        discount: resultData.discount.toFixed(2),
        valid: resultData.valid,
        voucher: resultData.voucher
          ? {
              code: resultData.voucher.code,
              discount: resultData.voucher.discount.toNumber(),
              type: resultData.voucher.type,
              validUntil: resultData.voucher.validUntil,
              appliesTo: resultData.voucher.appliesTo,
            }
          : null,
      };

      await redis.set(idempotencyKey, JSON.stringify(responseData), { EX: 24 * 60 * 60 });

      await auditLogService.log({
        userId: user.id,
        action: "VOUCHER_VALIDATED",
        details: { voucherCode, discount: resultData.discount },
        entityType: "VOUCHER",
        entityId: resultData.voucher ? resultData.voucher.id.toString() : null,
      });

      logger.info("Voucher validated successfully", { userId, voucherCode });
      res.status(200).json({
        message: "Voucher validated successfully",
        data: responseData,
      });
    } catch (error: any) {
      logger.error("Error validating voucher", { error: error.message, userId: req.user?.id || "unknown" });
      await auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHER_VALIDATION_FAILED",
        details: { error: error.message, voucherCode: req.body.voucherCode },
      });
      res.status(400).json({ error: `Failed to validate voucher: ${error.message}` });
      next(error);
    }
  }

  async createVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for createVoucher", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["ADMIN"]))) {
        logger.warn("Unauthorized access attempt to createVoucher", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "Only admins can create vouchers" });
        return;
      }

      const { error, value } = createVoucherSchema.validate({ body: req.body });
      if (error) {
        logger.warn("Validation failed for createVoucher request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { discount, type, maxUses, maxUsesPerUser, validFrom, validUntil, appliesTo, createdById } = value.body;

      if (user.id !== createdById) {
        logger.warn("CreatedById does not match authenticated user", { userId: user.id, createdById });
        res.status(403).json({ error: "CreatedById must match authenticated user" });
        return;
      }

      const idempotencyKey = `createVoucher:${createdById}:${discount}:${validUntil}`;
      const redis = await getRedisClient();
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate createVoucher request ignored", { createdById, discount });
        res.status(200).json({
          message: "Voucher creation already processed",
          data: parsed,
        });
        return;
      }

      logger.info("Creating voucher", { createdById, discount, appliesTo });

      const voucher = await walletService.createVoucher({
        discount,
        type,
        maxUses,
        maxUsesPerUser,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        appliesTo,
        createdById,
      });

      const responseData = {
        id: voucher.id,
        code: voucher.code,
        discount: voucher.discount.toNumber(),
        type: voucher.type,
        maxUses: voucher.maxUses,
        maxUsesPerUser: voucher.maxUsesPerUser,
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        appliesTo: voucher.appliesTo,
        isActive: voucher.isActive,
        createdById: voucher.createdById,
        updatedAt: voucher.updatedAt,
        updatedById: voucher.updatedById,
        uses: voucher.uses,
      };

      await redis.set(idempotencyKey, JSON.stringify(responseData), { EX: 24 * 60 * 60 });

      await auditLogService.log({
        userId: createdById,
        action: "VOUCHER_CREATED",
        details: { code: voucher.code, discount, type, appliesTo },
        entityType: "VOUCHER",
        entityId: voucher.id.toString(),
      });

      logger.info("Voucher created successfully", { createdById, code: voucher.code });
      res.status(201).json({
        message: "Voucher created successfully",
        data: responseData,
      });
    } catch (error: any) {
      logger.error("Error creating voucher", { error: error.message, userId: req.user?.id || "unknown" });
      await auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHER_CREATION_FAILED",
        details: { error: error.message, discount: req.body.discount },
      });
      res.status(400).json({ error: `Failed to create voucher: ${error.message}` });
      next(error);
    }
  }

  async updateVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for updateVoucher", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["ADMIN"]))) {
        logger.warn("Unauthorized access attempt to updateVoucher", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "Only admins can update vouchers" });
        return;
      }

      const { error, value } = updateVoucherSchema.validate({ params: req.params, body: req.body });
      if (error) {
        logger.warn("Validation failed for updateVoucher request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { id } = value.params;
      const { discount, type, maxUses, maxUsesPerUser, validFrom, validUntil, isActive, appliesTo, updatedById } = value.body;

      if (user.id !== updatedById) {
        logger.warn("UpdatedById does not match authenticated user", { userId: user.id, updatedById });
        res.status(403).json({ error: "UpdatedById must match authenticated user" });
        return;
      }

      const idempotencyKey = `updateVoucher:${id}:${updatedById}:${Date.now()}`;
      const redis = await getRedisClient();
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate updateVoucher request ignored", { updatedById, id });
        res.status(200).json({
          message: "Voucher update already processed",
          data: parsed,
        });
        return;
      }

      logger.info("Updating voucher", { updatedById, id });

      const updatedVoucher = await walletService.updateVoucher(id, {
        discount,
        type,
        maxUses,
        maxUsesPerUser,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        isActive,
        appliesTo,
        updatedById,
      });

      const responseData = {
        id: updatedVoucher.id,
        code: updatedVoucher.code,
        discount: updatedVoucher.discount.toNumber(),
        type: updatedVoucher.type,
        maxUses: updatedVoucher.maxUses,
        maxUsesPerUser: updatedVoucher.maxUsesPerUser,
        validFrom: updatedVoucher.validFrom,
        validUntil: updatedVoucher.validUntil,
        isActive: updatedVoucher.isActive,
        appliesTo: updatedVoucher.appliesTo,
      };

      await redis.set(idempotencyKey, JSON.stringify(responseData), { EX: 24 * 60 * 60 });

      await auditLogService.log({
        userId: updatedById,
        action: "VOUCHER_UPDATED",
        details: { voucherId: updatedVoucher.id, code: updatedVoucher.code, updatedFields: { ...value.body, updatedById: undefined } },
        entityType: "VOUCHER",
        entityId: updatedVoucher.id.toString(),
      });

      logger.info("Voucher updated successfully", { updatedById, code: updatedVoucher.code });
      res.status(200).json({
        message: "Voucher updated successfully",
        data: responseData,
      });
    } catch (error: any) {
      logger.error("Error updating voucher", { error: error.message, userId: req.user?.id || "unknown" });
      await auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHER_UPDATE_FAILED",
        details: { error: error.message, id: req.params.id },
      });
      res.status(400).json({ error: `Failed to update voucher: ${error.message}` });
      next(error);
    }
  }

  async getAllVouchers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for getAllVouchers", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["ADMIN", "MANAGER"]))) {
        logger.warn("Unauthorized access attempt to getAllVouchers", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "Only admins and managers can view all vouchers" });
        return;
      }

      const { error, value } = getAllVouchersSchema.validate({ query: req.query });
      if (error) {
        logger.warn("Validation failed for getAllVouchers request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { page, pageSize } = value.query;

      logger.info("Retrieving all vouchers", { userId: user.id, page, pageSize });

      const { vouchers, total } = await walletService.getAllVouchers(Number(page), Number(pageSize));

      const responseData = {
        vouchers: vouchers.map((v) => ({
          id: v.id,
          code: v.code,
          discount: v.discount.toNumber(),
          type: v.type,
          maxUses: v.maxUses,
          maxUsesPerUser: v.maxUsesPerUser,
          uses: v.uses,
          validFrom: v.validFrom,
          validUntil: v.validUntil,
          isActive: v.isActive,
          appliesTo: v.appliesTo,
        })),
        total,
        page,
        pageSize,
      };

      await auditLogService.log({
        userId: user.id,
        action: "VOUCHERS_RETRIEVED",
        details: { page, pageSize, total },
        entityType: "VOUCHER",
        entityId: null,
      });

      logger.info("Vouchers retrieved successfully", { userId: user.id, total });
      res.status(200).json({
        message: "Vouchers retrieved successfully",
        data: responseData,
      });
    } catch (error: any) {
      logger.error("Error retrieving vouchers", { error: error.message, userId: req.user?.id || "unknown" });
      await auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHERS_RETRIEVAL_FAILED",
        details: { error: error.message, page: req.query.page, pageSize: req.query.pageSize },
      });
      res.status(400).json({ error: `Failed to retrieve vouchers: ${error.message}` });
      next(error);
    }
  }

  async checkVoucherEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user || !user.id) {
        logger.warn("No user or user ID in request for checkVoucherEligibility", { metadata: { user: user || "undefined" } });
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!(await checkRole(req, ["CUSTOMER", "ADMIN", "MANAGER"]))) {
        logger.warn("Unauthorized access attempt to checkVoucherEligibility", { userId: user.id, metadata: { role: user.role } });
        res.status(403).json({ error: "User unauthorized" });
        return;
      }

      const { error, value } = checkVoucherEligibilitySchema.validate({ query: req.query });
      if (error) {
        logger.warn("Validation failed for checkVoucherEligibility request", { userId: user.id, error: error.details });
        res.status(400).json({ error: error.details[0].message });
        return;
      }

      const { userId, voucherCode, context } = value.query;

      if (user.role === "CUSTOMER" && user.id !== userId) {
        logger.warn("Customer attempted to check voucher eligibility for another user", { userId: user.id, requestedUserId: userId });
        res.status(403).json({ error: "Customers can only check eligibility for themselves" });
        return;
      }

      const idempotencyKey = `checkVoucherEligibility:${voucherCode}:${userId}`;
      const redis = await getRedisClient();
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate checkVoucherEligibility request ignored", { userId, voucherCode });
        res.status(200).json({
          message: "Voucher eligibility check already processed",
          data: parsed,
        });
        return;
      }

      logger.info("Checking voucher eligibility", { userId, voucherCode, context });

      const resultData = await walletService.checkVoucherEligibility(userId, voucherCode, context);

      const responseData = {
        eligible: resultData.eligible,
        voucher: resultData.voucher
          ? {
              id: resultData.voucher.id,
              code: resultData.voucher.code,
              discount: resultData.voucher.discount.toNumber(),
              type: resultData.voucher.type,
              validUntil: resultData.voucher.validUntil.toISOString(),
              appliesTo: resultData.voucher.appliesTo,
              isActive: resultData.voucher.isActive,
              validFrom: resultData.voucher.validFrom.toISOString(),
            }
          : null,
        message: resultData.message,
      };

      await redis.set(idempotencyKey, JSON.stringify(responseData), { EX: 24 * 60 * 60 });

      await auditLogService.log({
        userId: user.id,
        action: "VOUCHER_ELIGIBILITY_CHECKED",
        details: { voucherCode, eligible: resultData.eligible },
        entityType: "VOUCHER",
        entityId: resultData.voucher ? resultData.voucher.id.toString() : null,
      });

      logger.info("Voucher eligibility checked successfully", { userId, voucherCode });
      res.status(200).json({
        message: "Voucher eligibility checked successfully",
        data: responseData,
      });
    } catch (error: any) {
      logger.error("Error checking voucher eligibility", { error: error.message, userId: req.user?.id || "unknown" });
      await auditLogService.log({
        userId: req.user?.id || "unknown",
        action: "VOUCHER_ELIGIBILITY_CHECK_FAILED",
        details: { error: error.message, voucherCode: req.query.voucherCode },
      });
      res.status(400).json({ error: `Failed to check voucher eligibility: ${error.message}` });
      next(error);
    }
  }

  async redeemVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await walletService.redeemVoucherController(req, res, next);
    } catch (error: any) {
      logger.error("Error in redeemVoucher", { error: error.message, userId: req.user?.id || "unknown" });
      next(error);
    }
  }

  async applyVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await walletService.applyVoucherController(req, res, next);
    } catch (error: any) {
      logger.error("Error in applyVoucher", { error: error.message, userId: req.user?.id || "unknown" });
      next(error);
    }
  }
}

export default new WalletController();