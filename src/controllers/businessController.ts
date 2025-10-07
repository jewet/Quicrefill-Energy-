import { Request, Response, NextFunction } from 'express';
import { BusinessService } from '../services/businessService';
import { successResponse } from '../config/responseFormatter';
import { ApiError } from '../lib/utils/errors/appError';
import logger from '../config/logger';
import { RequestUser } from '../lib/types/auth';
import { VerificationStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

const businessService = new BusinessService();

export class BusinessController {
  async handleBusinessSubmissionFromGateway(data: {
    userId: string;
    documentId: string;
    cacDocumentUrl: string;
    proofOfAddressUrl: string;
    tinDocumentUrl?: string;
    businessName: string;
    rcNumber: string;
    businessAddress: string;
    tinNumber?: string;
  }): Promise<{
    id: string;
    status: VerificationStatus;
    businessName: string;
    rcNumber: string;
    businessAddress: string;
    tinNumber?: string;
    cacDocumentUrl: string;
    proofOfAddressUrl: string;
    tinDocumentUrl?: string;
    submittedAt: Date;
  }> {
    const requestId = require('uuid').v4();
    try {
      logger.info(`[${requestId}] Handling business submission from API Gateway`, {
        userId: data.userId,
        documentId: data.documentId,
        businessName: data.businessName,
      });

      if (!data.userId || !data.documentId || !data.cacDocumentUrl || !data.proofOfAddressUrl || !data.businessName || !data.rcNumber || !data.businessAddress) {
        logger.error(`[${requestId}] Missing required fields`, { data });
        throw ApiError.badRequest('Missing required fields: userId, documentId, cacDocumentUrl, proofOfAddressUrl, businessName, rcNumber, businessAddress');
      }

      const businessData = {
        businessName: data.businessName,
        rcNumber: data.rcNumber,
        businessAddress: data.businessAddress,
        tinNumber: data.tinNumber,
        token: '',
      };

      const verification = await businessService.submitBusinessVerification(
        data.userId,
        businessData,
        data.cacDocumentUrl,
        data.proofOfAddressUrl,
        data.tinDocumentUrl
      );

      if (!Object.values(VerificationStatus).includes(verification.status)) {
        logger.error(`[${requestId}] Invalid verification status: ${verification.status}`);
        throw ApiError.badRequest(`Invalid verification status: ${verification.status}`);
      }

      return {
        id: verification.id,
        status: verification.status,
        businessName: verification.businessName,
        rcNumber: verification.rcNumber,
        businessAddress: data.businessAddress,
        tinNumber: data.tinNumber,
        cacDocumentUrl: data.cacDocumentUrl,
        proofOfAddressUrl: data.proofOfAddressUrl,
        tinDocumentUrl: data.tinDocumentUrl,
        submittedAt: verification.submittedAt,
      };
    } catch (error) {
      logger.error(`[${requestId}] Error handling business submission from gateway`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId,
      });
      throw error;
    }
  }

  async submitBusinessVerification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const cacDocument = files['cacDocument']?.[0];
      const tinDocument = files['tinDocument']?.[0];
      const proofOfAddress = files['proofOfAddress']?.[0];

      if (!cacDocument) {
        throw ApiError.badRequest('CAC registration document is required');
      }
      if (!proofOfAddress) {
        throw ApiError.badRequest('Proof of address document is required');
      }

      const token = req.headers.authorization?.split(' ')[1] || '';

      const businessData = {
        businessName: req.body.businessName,
        rcNumber: req.body.rcNumber,
        businessAddress: req.body.businessAddress,
        tinNumber: req.body.tinNumber,
        token,
      };

      const verification = await businessService.submitBusinessVerification(
        req.user.id,
        businessData,
        cacDocument.path,
        proofOfAddress.path,
        tinDocument?.path
      );

      return successResponse(
        res,
        verification,
        'Business verification submitted successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async checkBusinessVerificationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const status = await businessService.checkBusinessVerificationStatus(req.user.id);

      return successResponse(
        res,
        status,
        'Business verification status retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}