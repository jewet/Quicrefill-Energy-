// src/controllers/identityController.ts
import { Request, Response, NextFunction } from 'express';
import { IdentityService, SubmitIdentityVerificationRequest, ReviewIdentityVerificationRequest } from '../services/identityService';
import { successResponse } from '../config/responseFormatter';
import { ApiError } from '../errors/ApiError';
import { IdentityVerificationType, DocumentStatus } from '@prisma/client';
import logger from '../config/logger';
import { RequestUser } from '../lib/types/auth';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCodes } from '../errors/errorCodes';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export class IdentityController {
  private identityService: IdentityService;

  constructor(identityService?: IdentityService) {
    this.identityService = identityService || new IdentityService();
  }

  async handleIdentitySubmissionFromGateway(data: {
    id: string;
    userId: string;
    documentId: string;
    frontImageUrl: string;
    selfieImageUrl: string;
    backImageUrl?: string;
    documentType: IdentityVerificationType;
    documentNumber: string;
    country: string;
    status: DocumentStatus;
    submittedAt: string;
  }): Promise<{
    id: string;
    status: DocumentStatus;
    documentType: IdentityVerificationType;
    documentNumber: string;
    country: string;
    frontImageUrl: string;
    backImageUrl?: string;
    selfieImageUrl: string;
    submittedAt: Date;
  }> {
    const requestId = uuidv4();
    logger.info(`[${requestId}] Entering handleIdentitySubmissionFromGateway, Data: ${JSON.stringify(data)}`);

    try {
      const verificationRequest: SubmitIdentityVerificationRequest = {
        userId: data.userId,
        documentType: data.documentType,
        country: data.country,
        frontImagePath: data.frontImageUrl,
        selfieImagePath: data.selfieImageUrl,
        backImagePath: data.backImageUrl,
        documentNumber: data.documentNumber,
        deviceInfo: JSON.stringify({
          timestamp: new Date().toISOString(),
        }),
      };

      const verification = await this.identityService.submitIdentityVerification(verificationRequest, '');

      return {
        id: verification.id,
        status: verification.status,
        documentType: verification.documentType,
        documentNumber: data.documentNumber,
        country: verification.country,
        frontImageUrl: data.frontImageUrl,
        backImageUrl: data.backImageUrl,
        selfieImageUrl: data.selfieImageUrl,
        submittedAt: verification.submittedAt,
      };
    } catch (error) {
      logger.error(`[${requestId}] Error handling identity submission from gateway: ${error instanceof Error ? error.message : String(error)}`, {
        userId: data.userId,
      });
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, String(error || 'Unknown error'), ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async submitIdentityVerification(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const { data } = req.body;
      if (!data || typeof data !== 'object') {
        throw ApiError.badRequest('Request body must contain a data object', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      const { frontImageUrl, selfieImageUrl, backImageUrl, documentType, country, documentNumber } = data;

      logger.info(`[${requestId}] Identity verification submission request`, {
        userId: req.user.id,
        hasUrls: {
          frontImageUrl: !!frontImageUrl,
          selfieImageUrl: !!selfieImageUrl,
          backImageUrl: !!backImageUrl,
        },
        documentType,
        country,
        documentNumber,
      });

      if (!frontImageUrl) {
        throw ApiError.badRequest('Front image URL is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      if (!selfieImageUrl) {
        throw ApiError.badRequest('Selfie image URL is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      if (!documentType || !Object.values(IdentityVerificationType).includes(documentType)) {
        throw ApiError.badRequest('Valid document type is required', ErrorCodes.INVALID_REQUEST);
      }

      if (!country || typeof country !== 'string') {
        throw ApiError.badRequest('Country is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      if (!documentNumber || typeof documentNumber !== 'string') {
        throw ApiError.badRequest('Document number is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw ApiError.unauthorized('Authorization token is required', ErrorCodes.MISSING_TOKEN);
      }

      const verificationRequest: SubmitIdentityVerificationRequest = {
        userId: req.user.id,
        documentType: documentType as IdentityVerificationType,
        country,
        frontImagePath: frontImageUrl,
        selfieImagePath: selfieImageUrl,
        backImagePath: backImageUrl,
        documentNumber,
        deviceInfo: JSON.stringify({
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.connection.remoteAddress || 'Unknown',
          timestamp: new Date().toISOString(),
        }),
      };

      const verification = await this.identityService.submitIdentityVerification(
        verificationRequest,
        token,
        req
      );

      return successResponse(
        res,
        {
          id: verification.id,
          status: verification.status,
          documentType: verification.documentType,
          documentNumber,
          country: verification.country,
          frontImageUrl,
          backImageUrl,
          selfieImageUrl,
          submittedAt: verification.submittedAt,
          message: 'Identity verification submitted successfully. You will be notified once the review is complete.',
        },
        'Identity verification submitted successfully',
        201
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in submitIdentityVerification: ${error instanceof Error ? error.message : String(error)}`, {
        userId: req.user?.id,
        documentType: req.body?.data?.documentType,
      });
      next(error);
    }
  }

  async getIdentityVerificationStatus(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const status = await this.identityService.getIdentityVerificationStatus(req.user.id);

      return successResponse(
        res,
        status,
        'Identity verification status retrieved successfully'
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in getIdentityVerificationStatus: ${error instanceof Error ? error.message : String(error)}`, {
        userId: req.user?.id,
      });
      next(error);
    }
  }

  async resubmitIdentityVerification(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const { data } = req.body;
      if (!data || typeof data !== 'object') {
        throw ApiError.badRequest('Request body must contain a data object', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      const { frontImageUrl, selfieImageUrl, backImageUrl, documentType, country, documentNumber } = data;

      if (!frontImageUrl || !selfieImageUrl) {
        throw ApiError.badRequest('Front image URL and selfie URL are required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      if (!documentType || !Object.values(IdentityVerificationType).includes(documentType)) {
        throw ApiError.badRequest('Valid document type is required', ErrorCodes.INVALID_REQUEST);
      }

      if (!country || typeof country !== 'string') {
        throw ApiError.badRequest('Country is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      if (!documentNumber || typeof documentNumber !== 'string') {
        throw ApiError.badRequest('Document number is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw ApiError.unauthorized('Authorization token is required', ErrorCodes.MISSING_TOKEN);
      }

      const resubmissionRequest: Omit<SubmitIdentityVerificationRequest, 'userId'> = {
        documentType: documentType as IdentityVerificationType,
        country,
        frontImagePath: frontImageUrl,
        selfieImagePath: selfieImageUrl,
        backImagePath: backImageUrl,
        documentNumber,
        deviceInfo: JSON.stringify({
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.connection.remoteAddress || 'Unknown',
          timestamp: new Date().toISOString(),
          resubmission: true,
        }),
      };

      const verification = await this.identityService.resubmitIdentityVerification(
        req.user.id,
        resubmissionRequest,
        token,
        req
      );

      return successResponse(
        res,
        {
          id: verification.id,
          status: verification.status,
          documentType: verification.documentType,
          documentNumber,
          country: verification.country,
          frontImageUrl,
          backImageUrl,
          selfieImageUrl,
          submittedAt: verification.submittedAt,
          message: 'Identity verification resubmitted successfully. You will be notified once the review is complete.',
        },
        'Identity verification resubmitted successfully',
        201
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in resubmitIdentityVerification: ${error instanceof Error ? error.message : String(error)}`, {
        userId: req.user?.id,
        documentType: req.body?.data?.documentType,
      });
      next(error);
    }
  }

async reviewIdentityVerification(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
    }

    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER' && req.user.role !== 'SUPERVISOR') {
      throw ApiError.forbidden('Insufficient permissions to review verification', ErrorCodes.FORBIDDEN);
    }

    const { verificationId } = req.params;
    const { status, rejectionReason, notifyUser = true } = req.body;

    if (!verificationId) {
      throw ApiError.badRequest('Verification ID is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    if (!status || !Object.values(DocumentStatus).includes(status)) {
      throw ApiError.badRequest('Valid status is required', ErrorCodes.INVALID_REQUEST);
    }

    if (status === DocumentStatus.NOT_VERIFIED && !rejectionReason) {
      throw ApiError.badRequest('Rejection reason is required when rejecting verification', ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const reviewRequest: ReviewIdentityVerificationRequest = {
      verificationId,
      reviewerId: req.user.id,
      status: status as 'VERIFIED' | 'NOT_VERIFIED' | 'UNDER_REVIEW',
      rejectionReason,
      notifyUser,
    };

    logger.info(`[${requestId}] Processing review for verificationId: ${verificationId}, Request: ${JSON.stringify(reviewRequest)}`);

    const updatedVerification = await this.identityService.reviewIdentityVerification(
      reviewRequest,
      req
    );

    logger.info(`[${requestId}] Identity verification reviewed successfully for verificationId: ${verificationId}`);

    return successResponse(
      res,
      {
        id: updatedVerification.id,
        status: updatedVerification.status,
        documentType: updatedVerification.documentType,
        country: updatedVerification.country,
        frontImageUrl: updatedVerification.frontImageUrl,
        backImageUrl: updatedVerification.backImageUrl,
        selfieImageUrl: updatedVerification.selfieImageUrl,
        submittedAt: updatedVerification.submittedAt,
        processedAt: updatedVerification.processedAt,
        reviewedAt: updatedVerification.reviewedAt,
        reviewedById: updatedVerification.reviewedById,
        rejectionReason: updatedVerification.rejectionReason,
      },
      'Identity verification reviewed successfully'
    );
  } catch (error) {
    logger.error(`[${requestId}] Error in reviewIdentityVerification: ${error instanceof Error ? error.message : String(error)}`, {
      stack: error instanceof Error ? error.stack : undefined,
      reviewerId: req.user?.id,
      verificationId: req.params?.verificationId,
      body: req.body,
    });
    next(error);
  }
}

  async getIdentityVerifications(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const allowedRoles: string[] = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
      if (!allowedRoles.includes(req.user.role)) {
        throw ApiError.forbidden('Insufficient permissions to view all verifications', ErrorCodes.FORBIDDEN);
      }

      const {
        page = 1,
        limit = 10,
        sortBy = 'submittedAt',
        sortOrder = 'desc',
        status,
        documentType,
        country,
        reviewedById,
        submittedAfter,
        submittedBefore,
      } = req.query;

      const filters = {
        ...(status && { status: status as DocumentStatus }),
        ...(documentType && { documentType: documentType as IdentityVerificationType }),
        ...(country && { country: country as string }),
        ...(reviewedById && { reviewedById: reviewedById as string }),
        ...(submittedAfter && { submittedAfter: new Date(submittedAfter as string) }),
        ...(submittedBefore && { submittedBefore: new Date(submittedBefore as string) }),
      };

      const pagination = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await this.identityService.getIdentityVerifications(filters, pagination);

      return successResponse(
        res,
        result,
        'Identity verifications retrieved successfully'
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in getIdentityVerifications: ${error instanceof Error ? error.message : String(error)}`, {
        adminId: req.user?.id,
        query: req.query,
      });
      next(error);
    }
  }

  async getIdentityVerificationById(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const allowedRoles: string[] = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
      if (!allowedRoles.includes(req.user.role)) {
        throw ApiError.forbidden('Insufficient permissions to view verification details', ErrorCodes.FORBIDDEN);
      }

      const { verificationId } = req.params;

      if (!verificationId) {
        throw ApiError.badRequest('Verification ID is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      const verification = await this.identityService.getVerificationById(verificationId);

      return successResponse(
        res,
        {
          id: verification.id,
          status: verification.status,
          documentType: verification.documentType,
          documentNumber: verification.documentNumber,
          country: verification.country,
          frontImageUrl: verification.frontImageUrl,
          backImageUrl: verification.backImageUrl,
          selfieImageUrl: verification.selfieImageUrl,
          submittedAt: verification.submittedAt,
          processedAt: verification.processedAt,
          reviewedAt: verification.reviewedAt,
          reviewedById: verification.reviewedById,
          rejectionReason: verification.rejectionReason,
        },
        'Identity verification retrieved successfully'
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in getIdentityVerificationById: ${error instanceof Error ? error.message : String(error)}`, {
        adminId: req.user?.id,
        verificationId: req.params?.verificationId,
      });
      next(error);
    }
  }

  async getVerificationStatistics(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const allowedRoles: string[] = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
      if (!allowedRoles.includes(req.user.role)) {
        throw ApiError.forbidden('Insufficient permissions to view statistics', ErrorCodes.FORBIDDEN);
      }

      const stats = await this.identityService.getVerificationStatistics();

      return successResponse(
        res,
        stats,
        'Verification statistics retrieved successfully'
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in getVerificationStatistics: ${error instanceof Error ? error.message : String(error)}`, {
        adminId: req.user?.id,
      });
      next(error);
    }
  }

  async getPendingVerificationsCount(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const allowedRoles: string[] = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
      if (!allowedRoles.includes(req.user.role)) {
        throw ApiError.forbidden('Insufficient permissions to view pending count', ErrorCodes.FORBIDDEN);
      }

      const count = await this.identityService.getPendingVerificationsCount();

      return successResponse(
        res,
        { pendingCount: count },
        'Pending verifications count retrieved successfully'
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in getPendingVerificationsCount: ${error instanceof Error ? error.message : String(error)}`, {
        adminId: req.user?.id,
      });
      next(error);
    }
  }

  async checkUserIdentityVerified(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required', ErrorCodes.UNAUTHORIZED);
      }

      const isVerified = await this.identityService.isUserIdentityVerified(req.user.id);

      return successResponse(
        res,
        { isVerified },
        'Identity verification status checked successfully'
      );
    } catch (error) {
      logger.error(`[${requestId}] Error in checkUserIdentityVerified: ${error instanceof Error ? error.message : String(error)}`, {
        userId: req.user?.id,
      });
      next(error);
    }
  }
}

export default IdentityController;