// src/routes/identityRoute.ts
import express, { Router, RequestHandler } from 'express';
import { IdentityController } from '../../controllers/identityController';
import { validateRequest } from '../../middlewares/validateRequest';
import { reviewIdentityVerificationSchema, verificationIdParamSchema } from '../../schemas/identity.schema';
import logger from '../../config/logger';
import { ApiError } from '../../lib/utils/errors/appError';
import { ErrorCodes } from '../../errors/errorCodes';
import { authenticationMiddleware } from '../../middlewares/authentication'; // Replaced verifyJWT with authenticationMiddleware

class IdentityRoutes {
  private router: Router = express.Router();
  private controller = new IdentityController();

  constructor() {
    this.initializeRoutes();
  }

  private checkAdminPermissions: RequestHandler = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || 'unknown';
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const allowedRoles: string[] = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
      if (!allowedRoles.includes(req.user.role)) {
        throw ApiError.forbidden('Insufficient permissions', ErrorCodes.FORBIDDEN);
      }

      next();
    } catch (error) {
      logger.error(`[${requestId}] Error in checkAdminPermissions: ${error instanceof Error ? error.message : String(error)}`, {
        userId: req.user?.id,
        role: req.user?.role,
      });
      next(error);
    }
  };

  private initializeRoutes(): void {
    // Submit identity verification documents
    this.router.post(
      '/submit',
      authenticationMiddleware,
      this.controller.submitIdentityVerification.bind(this.controller) as RequestHandler
    );

    // Resubmit identity verification documents
    this.router.post(
      '/resubmit',
      authenticationMiddleware,
      this.controller.resubmitIdentityVerification.bind(this.controller) as RequestHandler
    );

    // Get identity verification status for the authenticated user
    this.router.get(
      '/status',
      authenticationMiddleware,
      this.controller.getIdentityVerificationStatus.bind(this.controller) as RequestHandler
    );

    // Check if the authenticated user's identity is verified
    this.router.get(
      '/verified',
      authenticationMiddleware,
      this.controller.checkUserIdentityVerified.bind(this.controller) as RequestHandler
    );

    // Get verification statistics (admin only)
    this.router.get(
      '/statistics',
      authenticationMiddleware,
      this.checkAdminPermissions,
      this.controller.getVerificationStatistics.bind(this.controller) as RequestHandler
    );

    // Get count of pending verifications (admin only)
    this.router.get(
      '/pending/count',
      authenticationMiddleware,
      this.checkAdminPermissions,
      this.controller.getPendingVerificationsCount.bind(this.controller) as RequestHandler
    );

    // Review an identity verification (admin only)
    this.router.put(
      '/review/:verificationId',
      authenticationMiddleware,
      this.checkAdminPermissions,
      validateRequest(reviewIdentityVerificationSchema, 'body'),
      validateRequest(verificationIdParamSchema, 'params'),
      this.controller.reviewIdentityVerification.bind(this.controller) as RequestHandler
    );

    // Get all identity verifications (admin only)
    this.router.get(
      '/',
      authenticationMiddleware,
      this.checkAdminPermissions,
      this.controller.getIdentityVerifications.bind(this.controller) as RequestHandler
    );

    // Get a specific identity verification by ID (admin only)
    this.router.get(
      '/:verificationId',
      authenticationMiddleware,
      this.checkAdminPermissions,
      validateRequest(verificationIdParamSchema, 'params'),
      this.controller.getIdentityVerificationById.bind(this.controller) as RequestHandler
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new IdentityRoutes().getRouter();