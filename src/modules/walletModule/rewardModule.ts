// rewardModule.ts
import { PrismaClient, TransactionStatus, TransactionType } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import Joi from "joi";
import { logger } from "../../utils/logger";
import { addAuditLogJob } from "../../queues/auditLogQueue";
import { getRedisClient } from "../../config/redis";
import { Request } from "express";

const prisma = new PrismaClient();

// Interfaces for request bodies
interface CreateRewardRequest {
  userId: string;
  points: number;
  source: string;
  sourceId?: string;
  expiresAt?: Date;
}

interface RedeemRewardRequest {
  userId: string;
  points: number;
  transactionReference?: string;
}

interface UpdateRewardRequest {
  points?: number;
  source?: string;
  sourceId?: string;
  expiresAt?: Date;
}

interface RewardRuleRequest {
  pointsPerNaira: number;
  nairaPerPoint: number; // Added for redemption rate
  appliesTo: string;
  validFrom: Date;
  validUntil: Date;
}

// Validation schemas
const createRewardSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  points: Joi.number().integer().min(1).required(),
  source: Joi.string().required(),
  sourceId: Joi.string().optional(),
  expiresAt: Joi.date().optional(),
});

const redeemRewardSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  points: Joi.number().integer().min(1).required(),
  transactionReference: Joi.string().optional(),
});

const updateRewardSchema = Joi.object({
  points: Joi.number().integer().min(1).optional(),
  source: Joi.string().optional(),
  sourceId: Joi.string().optional().allow(null),
  expiresAt: Joi.date().optional().allow(null),
});

const rewardRuleSchema = Joi.object({
  pointsPerNaira: Joi.number().min(0).required(),
  nairaPerPoint: Joi.number().min(0).required(), // Added validation for nairaPerPoint
  appliesTo: Joi.string().required(),
  validFrom: Joi.date().required(),
  validUntil: Joi.date().min(Joi.ref("validFrom")).required(),
});

export class RewardModule {
  // Create a new reward for a user
  async createReward(req: Request<{}, {}, CreateRewardRequest>): Promise<any> {
    const requestId = req.requestId ?? uuidv4();
    const { userId, points, source, sourceId, expiresAt } = req.body;

    try {
      // Validate request
      const { error } = createRewardSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for createReward", { requestId, error: error.details });
        throw new Error(error.details.map((e) => e.message).join(", "));
      }

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        logger.warn("User not found for createReward", { requestId, userId });
        throw new Error("User not found");
      }

      // Check for duplicate request using Redis
      const redis = await getRedisClient();
      const idempotencyKey = `reward:create:${source}:${sourceId ?? uuidv4()}`;
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate reward creation request ignored", { requestId, userId, idempotencyKey });
        return { message: "Reward already created", reward: parsed };
      }

      // Create reward
      const reward = await prisma.reward.create({
        data: {
          id: uuidv4(),
          userId,
          points,
          source,
          sourceId,
          expiresAt,
          createdAt: new Date(),
        },
      });

      // Cache reward data
      await redis.set(
        idempotencyKey,
        JSON.stringify({
          id: reward.id,
          userId: reward.userId,
          points: reward.points,
          source: reward.source,
          sourceId: reward.sourceId,
          expiresAt: reward.expiresAt,
        }),
        { EX: 24 * 60 * 60 }
      );

      // Log audit
      await addAuditLogJob({
        userId,
        action: "REWARD_CREATED",
        details: { rewardId: reward.id, points, source, sourceId },
        entityType: "REWARD",
        entityId: reward.id,
      });

      logger.info("Reward created successfully", { requestId, userId, rewardId: reward.id, points });
      return {
        message: "Reward created successfully",
        reward: {
          id: reward.id,
          userId: reward.userId,
          points: reward.points,
          source: reward.source,
          sourceId: reward.sourceId,
          expiresAt: reward.expiresAt,
        },
      };
    } catch (error: any) {
      logger.error("Error creating reward", { requestId, userId, error: error.message });
      throw new Error(`Failed to create reward: ${error.message}`);
    }
  }

  // Redeem points and credit wallet (using nairaPerPoint from RewardRule)
  async redeemReward(req: Request<{}, {}, RedeemRewardRequest>): Promise<any> {
    const requestId = req.requestId ?? uuidv4();
    const { userId, points, transactionReference } = req.body;

    try {
      // Validate request
      const { error } = redeemRewardSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for redeemReward", { requestId, error: error.details });
        throw new Error(error.details.map((e) => e.message).join(", "));
      }

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        logger.warn("User not found for redeemReward", { requestId, userId });
        throw new Error("User not found");
      }

      // Check if wallet exists, create if not
      let wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            id: uuidv4(),
            userId,
            balance: 0,
          },
        });
      }

      // Check for duplicate redemption request
      const redis = await getRedisClient();
      const ref = transactionReference ?? `REWARD-REDEEM-${uuidv4()}-${Date.now()}`;
      const idempotencyKey = `reward:redeem:${ref}`;
      const existing = await redis.get(idempotencyKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        logger.info("Duplicate reward redemption request ignored", { requestId, userId, idempotencyKey });
        return { message: "Reward redemption already processed", transaction: parsed };
      }

      // Check total available points
      const totalPoints = await prisma.reward.aggregate({
        where: { userId, expiresAt: { gte: new Date() } },
        _sum: { points: true },
      });

      const availablePoints = totalPoints._sum.points || 0;
      if (availablePoints < points) {
        logger.warn("Insufficient points for redemption", { requestId, userId, points, availablePoints });
        throw new Error("Insufficient points");
      }

      // Get active reward rule for redemption rate
      const rewardRule = await prisma.rewardRule.findFirst({
        where: { isActive: true, validUntil: { gte: new Date() } },
        orderBy: { createdAt: "desc" },
      });

      const nairaPerPoint = rewardRule?.nairaPerPoint || 0.01; // Default to 0.01 (1000 points = 10 Naira)
      const amount = points * nairaPerPoint;

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deduct points by updating the oldest non-expired rewards
        let remainingPoints = points;
        const rewards = await tx.reward.findMany({
          where: { userId, expiresAt: { gte: new Date() } },
          orderBy: { createdAt: "asc" },
        });

        for (const reward of rewards) {
          if (remainingPoints <= 0) break;
          const pointsToDeduct = Math.min(remainingPoints, reward.points);
          await tx.reward.update({
            where: { id: reward.id },
            data: { points: reward.points - pointsToDeduct },
          });
          remainingPoints -= pointsToDeduct;
        }

        // Credit wallet
        const transaction = await tx.walletTransaction.create({
          data: {
            id: uuidv4(),
            userId,
            walletId: wallet.id,
            transactionType: TransactionType.DEPOSIT,
            amount,
            status: TransactionStatus.COMPLETED,
            transactionRef: ref,
            metadata: { source: "REWARD_REDEMPTION", pointsRedeemed: points, nairaPerPoint },
          },
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });

        return transaction;
      });

      // Cache transaction data
      const transactionData = {
        id: result.id,
        amount: result.amount.toNumber().toFixed(2),
        status: result.status,
        transactionRef: ref,
      };
      await redis.set(idempotencyKey, JSON.stringify(transactionData), { EX: 24 * 60 * 60 });

      // Log audit
      await addAuditLogJob({
        userId,
        action: "REWARD_REDEEMED",
        details: { points, amount, transactionId: result.id, transactionRef: ref, nairaPerPoint },
        entityType: "WALLET_TRANSACTION",
        entityId: result.id,
      });

      logger.info("Reward redeemed successfully", { requestId, userId, points, amount, nairaPerPoint });
      return {
        message: "Reward redeemed successfully",
        transaction: {
          id: result.id,
          amount: result.amount.toNumber().toFixed(2),
          status: result.status,
          transactionRef: ref,
        },
      };
    } catch (error: any) {
      logger.error("Error redeeming reward", { requestId, userId, error: error.message });
      throw new Error(`Failed to redeem reward: ${error.message}`);
    }
  }

  // Get reward balance for a user
  async getRewardBalance(userId: string): Promise<any> {
    const requestId = uuidv4();

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        logger.warn("User not found for getRewardBalance", { requestId, userId });
        throw new Error("User not found");
      }

      const totalPoints = await prisma.reward.aggregate({
        where: { userId, expiresAt: { gte: new Date() } },
        _sum: { points: true },
      });

      const balance = totalPoints._sum.points || 0;

      logger.info("Reward balance retrieved", { requestId, userId, balance });
      return { userId, balance };
    } catch (error: any) {
      logger.error("Error fetching reward balance", { requestId, userId, error: error.message });
      throw new Error(`Failed to retrieve reward balance: ${error.message}`);
    }
  }

  // Update a reward (Admin only)
  async updateReward(rewardId: string, req: Request<{}, {}, UpdateRewardRequest>): Promise<any> {
    const requestId = req.requestId ?? uuidv4();
    const { points, source, sourceId, expiresAt } = req.body;

    try {
      // Validate request
      const { error } = updateRewardSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for updateReward", { requestId, error: error.details });
        throw new Error(error.details.map((e) => e.message).join(", "));
      }

      // Check if reward exists
      const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
      if (!reward) {
        logger.warn("Reward not found for update", { requestId, rewardId });
        throw new Error("Reward not found");
      }

      // Update reward
      const updatedReward = await prisma.reward.update({
        where: { id: rewardId },
        data: {
          points: points ?? reward.points,
          source: source ?? reward.source,
          sourceId: sourceId !== undefined ? sourceId : reward.sourceId,
          expiresAt: expiresAt !== undefined ? expiresAt : reward.expiresAt,
        },
      });

      // Log audit
      await addAuditLogJob({
        userId: req.user?.id ?? "unknown",
        action: "REWARD_UPDATED",
        details: { rewardId, changes: req.body },
        entityType: "REWARD",
        entityId: rewardId,
      });

      logger.info("Reward updated successfully", { requestId, rewardId });
      return {
        message: "Reward updated successfully",
        reward: {
          id: updatedReward.id,
          userId: updatedReward.userId,
          points: updatedReward.points,
          source: updatedReward.source,
          sourceId: updatedReward.sourceId,
          expiresAt: updatedReward.expiresAt,
          updatedAt: updatedReward.updatedAt,
        },
      };
    } catch (error: any) {
      logger.error("Error updating reward", { requestId, rewardId, error: error.message });
      throw new Error(`Failed to update reward: ${error.message}`);
    }
  }

  // Delete a reward (Admin only)
  async deleteReward(rewardId: string, req: Request): Promise<any> {
    const requestId = req.requestId ?? uuidv4();

    try {
      const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
      if (!reward) {
        logger.warn("Reward not found for deletion", { requestId, rewardId });
        throw new Error("Reward not found");
      }

      await prisma.reward.delete({ where: { id: rewardId } });

      // Log audit
      await addAuditLogJob({
        userId: req.user?.id ?? "unknown",
        action: "REWARD_DELETED",
        details: { rewardId },
        entityType: "REWARD",
        entityId: rewardId,
      });

      logger.info("Reward deleted successfully", { requestId, rewardId });
      return { message: "Reward deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting reward", { requestId, rewardId, error: error.message });
      throw new Error(`Failed to delete reward: ${error.message}`);
    }
  }

  // Create or update a reward rule (Admin only)
  async manageRewardRule(req: Request<{}, {}, RewardRuleRequest>, ruleId?: string): Promise<any> {
    const requestId = req.requestId ?? uuidv4();
    const { pointsPerNaira, nairaPerPoint, appliesTo, validFrom, validUntil } = req.body;

    try {
      // Validate request
      const { error } = rewardRuleSchema.validate(req.body);
      if (error) {
        logger.warn("Validation failed for manageRewardRule", { requestId, error: error.details });
        throw new Error(error.details.map((e) => e.message).join(", "));
      }

      let rule;
      if (ruleId) {
        // Update existing rule
        rule = await prisma.rewardRule.update({
          where: { id: ruleId },
          data: {
            pointsPerNaira,
            nairaPerPoint,
            appliesTo,
            validFrom,
            validUntil,
            updatedAt: new Date(),
            updatedById: req.user?.id,
          },
        });

        await addAuditLogJob({
          userId: req.user?.id ?? "unknown",
          action: "REWARD_RULE_UPDATED",
          details: { ruleId, changes: req.body },
          entityType: "REWARD_RULE",
          entityId: ruleId,
        });
      } else {
        // Create new rule
        rule = await prisma.rewardRule.create({
          data: {
            id: uuidv4(),
            pointsPerNaira,
            nairaPerPoint,
            appliesTo,
            validFrom,
            validUntil,
            createdById: req.user?.id ?? "unknown",
            createdAt: new Date(),
          },
        });

        await addAuditLogJob({
          userId: req.user?.id ?? "unknown",
          action: "REWARD_RULE_CREATED",
          details: { ruleId: rule.id, pointsPerNaira, nairaPerPoint, appliesTo },
          entityType: "REWARD_RULE",
          entityId: rule.id,
        });
      }

      logger.info(`Reward rule ${ruleId ? "updated" : "created"} successfully`, {
        requestId,
        ruleId: rule.id,
      });
      return {
        message: `Reward rule ${ruleId ? "updated" : "created"} successfully`,
        rule: {
          id: rule.id,
          pointsPerNaira: rule.pointsPerNaira,
          nairaPerPoint: rule.nairaPerPoint,
          appliesTo: rule.appliesTo,
          validFrom: rule.validFrom,
          validUntil: rule.validUntil,
        },
      };
    } catch (error: any) {
      logger.error(`Error ${ruleId ? "updating" : "creating"} reward rule`, {
        requestId,
        error: error.message,
      });
      throw new Error(`Failed to ${ruleId ? "update" : "create"} reward rule: ${error.message}`);
    }
  }

  // Get reward rules
  async getRewardRules(): Promise<any> {
    const requestId = uuidv4();

    try {
      const rules = await prisma.rewardRule.findMany({
        where: { isActive: true, validUntil: { gte: new Date() } },
        orderBy: { createdAt: "desc" },
      });

      logger.info("Reward rules retrieved successfully", { requestId, count: rules.length });
      return {
        message: "Reward rules retrieved successfully",
        rules: rules.map((rule) => ({
          id: rule.id,
          pointsPerNaira: rule.pointsPerNaira,
          nairaPerPoint: rule.nairaPerPoint,
          appliesTo: rule.appliesTo,
          validFrom: rule.validFrom,
          validUntil: rule.validUntil,
        })),
      };
    } catch (error: any) {
      logger.error("Error fetching reward rules", { requestId, error: error.message });
      throw new Error(`Failed to retrieve reward rules: ${error.message}`);
    }
  }

  // Delete reward rule (Admin only)
  async deleteRewardRule(ruleId: string, req: Request): Promise<any> {
    const requestId = req.requestId ?? uuidv4();

    try {
      const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
      if (!rule) {
        logger.warn("Reward rule not found for deletion", { requestId, ruleId });
        throw new Error("Reward rule not found");
      }

      await prisma.rewardRule.update({
        where: { id: ruleId },
        data: { isActive: false, updatedAt: new Date(), updatedById: req.user?.id },
      });

      await addAuditLogJob({
        userId: req.user?.id ?? "unknown",
        action: "REWARD_RULE_DELETED",
        details: { ruleId },
        entityType: "REWARD_RULE",
        entityId: ruleId,
      });

      logger.info("Reward rule deleted successfully", { requestId, ruleId });
      return { message: "Reward rule deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting reward rule", { requestId, ruleId, error: error.message });
      throw new Error(`Failed to delete reward rule: ${error.message}`);
    }
  }
}

export default new RewardModule();