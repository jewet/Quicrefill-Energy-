import { Router, Request, Response, NextFunction } from 'express';
import { DocumentTypeController } from '../controllers/DocumentTypeController';
import { authorize } from '../middlewares/permissions';
import { authenticationMiddleware } from '../middlewares/authentication';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../config/logger';
import { randomUUID } from 'crypto';
import { ApiError } from '../lib/utils/errors/appError';
import { ErrorCodes } from '../errors/errorCodes';

// Align RequestUser with AuthUser from authenticationMiddleware
interface RequestUser {
  id: string;
  email: string;
  role: string;
  isAdmin: boolean;
}

interface CustomRequest extends Request {
  user?: RequestUser;
}

const documentTypeController = new DocumentTypeController();
const documentTypeRoute = Router();

// Route to get business document types (CAC only)
documentTypeRoute.get(
  '/document-types/business',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  asyncHandler(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    try {
      if (!req.user) {
        logger.error(`[${requestId}] User not authenticated`, {
          headers: req.headers,
        });
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      await documentTypeController.getBusinessDocumentTypes(req, res, next);
    } catch (error) {
      logger.error(`[${requestId}] Error in getBusinessDocumentTypes`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
        headers: req.headers,
      });
      next(error);
    }
  })
);

// Route to get vehicle document types (all except CAC)
documentTypeRoute.get(
  '/document-types/vehicle',
  authenticationMiddleware,
  authorize(['VENDOR', 'ADMIN']),
  asyncHandler(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    try {
      if (!req.user) {
        logger.error(`[${requestId}] User not authenticated`, {
          headers: req.headers,
        });
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      await documentTypeController.getVehicleDocumentTypes(req, res, next);
    } catch (error) {
      logger.error(`[${requestId}] Error in getVehicleDocumentTypes`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: req.user?.id,
        headers: req.headers,
      });
      next(error);
    }
  })
);

export default documentTypeRoute;