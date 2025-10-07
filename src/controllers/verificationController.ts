import { Request, Response, NextFunction } from 'express';
import { VerificationService } from '../services/verificationService';
import { successResponse } from '../config/responseFormatter';
import logger from '../config/logger';
import { ApiError } from '../lib/utils/errors/appError';
import { VerificationStatus } from '@prisma/client';

const verificationService = new VerificationService();

// Middleware for role checks
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    logger.error('Unauthorized access: Admins only');
    return next(ApiError.unauthorized('Authentication required'));
  }
  next();
}

export function requireAdminOrDeliveryRep(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'DELIVERY_REP')) {
    logger.error('Unauthorized access: Admin or Delivery Rep only');
    return next(ApiError.unauthorized('Authentication required'));
  }
  next();
}

// Middleware for status validation
export function validateVerificationStatus(req: Request, res: Response, next: NextFunction) {
  if (!req.body.status || !Object.values(VerificationStatus).includes(req.body.status)) {
    logger.error(`Invalid status: ${req.body.status}`);
    return next(ApiError.badRequest(`Status must be one of: ${Object.values(VerificationStatus).join(', ')}`));
  }
  next();
}

export class VerificationController {
  /**
   * Get all pending verifications
   */
  async getPendingVerifications(req: Request, res: Response, next: NextFunction) {
    try {
      const verifications = await verificationService.getPendingVerifications();
      return successResponse(
        res,
        verifications,
        'Pending verifications retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get verification by ID
   */
  async getVerificationById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) {
        throw ApiError.badRequest('Verification ID is required');
      }
      const verification = await verificationService.getVerificationById(id);
      return successResponse(
        res,
        verification,
        'Verification retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process verification (approve or reject)
   */
  async processVerification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        logger.error('User not found in request');
        throw ApiError.unauthorized('Authentication required');
      }
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!id) {
        throw ApiError.badRequest('Verification ID is required');
      }

      const verification = await verificationService.processVerification(
        id,
        status,
        req.user.id,
        notes,
        req
      );
      return successResponse(
        res,
        verification,
        `Verification ${status.toLowerCase()} successfully`
      );
    } catch (error) {
      next(error);
    }
  }
}