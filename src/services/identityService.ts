// src/services/identityService.ts
import {
  IdentityRepository,
  CreateIdentityVerificationData,
  IdentityVerificationFilters,
  PaginationOptions,
} from '../repositories/identityRepository';
import { dispatchNotification, NotificationPayload } from './notificationServices';
import { KnownEventTypes } from '../utils/EventTypeDictionary';
import { ApiError } from '../errors/ApiError';
import { IdentityVerificationType, DocumentStatus, IdentityVerification, PrismaClient } from '@prisma/client';
import logger from '../config/logger';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCodes } from '../errors/errorCodes';

export interface SubmitIdentityVerificationRequest {
  userId: string;
  documentType: IdentityVerificationType;
  country: string;
  frontImagePath: string;
  selfieImagePath: string;
  backImagePath?: string;
  deviceInfo?: string;
  documentNumber: string;
}

export interface IdentityVerificationStatus {
  status: DocumentStatus | 'NOT_SUBMITTED';
  documentType?: IdentityVerificationType;
  country?: string;
  submittedAt?: Date;
  processedAt?: Date;
  reviewedAt?: Date;
  rejectionReason?: string;
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface ReviewIdentityVerificationRequest {
  verificationId: string;
  reviewerId: string;
  status: 'VERIFIED' | 'NOT_VERIFIED' | 'UNDER_REVIEW';
  rejectionReason?: string;
  notifyUser?: boolean;
}

export class IdentityService {
  private identityRepository: IdentityRepository;
  private prisma: PrismaClient;

  constructor(identityRepository?: IdentityRepository, prisma?: PrismaClient) {
    this.identityRepository = identityRepository || new IdentityRepository();
    this.prisma = prisma || new PrismaClient();
  }

  async submitIdentityVerification(
    request: SubmitIdentityVerificationRequest,
    token: string,
    req?: Request
  ): Promise<IdentityVerification> {
    const requestId = req?.headers['x-request-id'] || uuidv4();
    try {
      const { userId, documentType, country, frontImagePath, selfieImagePath, backImagePath, deviceInfo, documentNumber } = request;

      // Fetch user with profile to ensure profile exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profile: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!user) {
        throw ApiError.notFound('User not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (!user.profile?.id) {
        logger.error(`[${requestId}] Profile not found for user ${userId}`);
        throw ApiError.badRequest('User profile not found. A profile must be created for the user.', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Check if verification already exists
      const existingVerification = await this.identityRepository.getIdentityVerificationByUserId(userId);

      if (existingVerification) {
        if (existingVerification.status === DocumentStatus.VERIFIED) {
          throw ApiError.badRequest('User identity is already verified. Contact support to update.', ErrorCodes.BAD_REQUEST);
        }
        if (existingVerification.status === DocumentStatus.PENDING || existingVerification.status === DocumentStatus.NOT_VERIFIED) {
          await this.identityRepository.deleteIdentityVerification(existingVerification.id);
          logger.info(`[${requestId}] Deleted previous verification for resubmission`, {
            userId,
            previousVerificationId: existingVerification.id,
            previousStatus: existingVerification.status,
          });
        }
        if (existingVerification.status === DocumentStatus.UNDER_REVIEW) {
          throw ApiError.badRequest('A verification request is currently under review. Please wait for review completion.', ErrorCodes.BAD_REQUEST);
        }
      }

      // Validate document type
      if (!Object.values(IdentityVerificationType).includes(documentType)) {
        throw ApiError.badRequest('Invalid document type', ErrorCodes.INVALID_REQUEST);
      }

      // Validate required images
      if (!frontImagePath || !selfieImagePath) {
        throw ApiError.badRequest('Front image and selfie are required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      // Validate document number
      if (!documentNumber) {
        throw ApiError.badRequest('Document number is required', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      // Validate that image paths are URLs
      const isUrl = (path: string) => /^https?:\/\//.test(path);
      if (!isUrl(frontImagePath) || !isUrl(selfieImagePath) || (backImagePath && !isUrl(backImagePath))) {
        throw ApiError.badRequest('Image paths must be valid URLs', ErrorCodes.INVALID_REQUEST);
      }

      // For certain document types, back image might be required
      const documentsRequiringBackImage: IdentityVerificationType[] = [
        IdentityVerificationType.DRIVER_LICENSE,
        IdentityVerificationType.VOTER_CARD,
        IdentityVerificationType.INTERNATIONAL_PASSPORT,
        IdentityVerificationType.NIN,
        IdentityVerificationType.RESIDENCE_PERMIT,
      ];

      if (documentsRequiringBackImage.includes(documentType) && !backImagePath) {
        throw ApiError.badRequest(`Back image is required for ${documentType}`, ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      // Create verification data
      const verificationData: CreateIdentityVerificationData = {
        userId,
        documentType,
        country,
        frontImageUrl: frontImagePath,
        selfieImageUrl: selfieImagePath,
        backImageUrl: backImagePath || undefined,
        deviceInfo,
        documentNumber,
        profileId: user.profile.id, // Profile ID is guaranteed to exist
      };

      // Create new verification
      const verification = await this.identityRepository.createIdentityVerification(verificationData);

      // Send notifications
      if (req) {
        await this.sendIdentityVerificationSubmittedNotification(userId, req);
        await this.sendNewVerificationToAdminsNotification(verification.id, req);
      } else {
        logger.info(`[${requestId}] Skipping notifications for user ${userId} as no Request object was provided`);
      }

      logger.info(`[${requestId}] Identity verification submitted successfully`, {
        userId,
        verificationId: verification.id,
        documentType,
        documentNumber,
      });

      return verification;
    } catch (error) {
      logger.error(`[${requestId}] Error submitting identity verification: ${error instanceof Error ? error.message : String(error)}`, {
        userId: request.userId,
        documentType: request.documentType,
      });
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to submit identity verification', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async getIdentityVerificationStatus(userId: string): Promise<IdentityVerificationStatus> {
    const requestId = uuidv4();
    try {
      const verification = await this.identityRepository.getIdentityVerificationByUserId(userId);

      if (!verification) {
        return { status: 'NOT_SUBMITTED' };
      }

      return {
        status: verification.status,
        documentType: verification.documentType,
        country: verification.country,
        submittedAt: verification.submittedAt,
        processedAt: verification.processedAt ?? undefined,
        reviewedAt: verification.reviewedAt ?? undefined,
        rejectionReason: verification.rejectionReason ?? undefined,
        reviewedBy: verification.reviewedBy ?? undefined,
      };
    } catch (error) {
      logger.error(`[${requestId}] Error getting identity verification status: ${error instanceof Error ? error.message : String(error)}`, { userId });
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to get identity verification status', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async reviewIdentityVerification(request: ReviewIdentityVerificationRequest, req: Request): Promise<IdentityVerification> {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      const { verificationId, reviewerId, status, rejectionReason, notifyUser = true } = request;

      // Validate reviewer exists and fetch role using Prisma
      const reviewer = await this.prisma.user.findUnique({
        where: { id: reviewerId },
        select: { id: true, role: { select: { name: true } } },
      });
      if (!reviewer) {
        throw ApiError.notFound('Reviewer not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (!this.hasReviewPermissions(reviewer.role?.name || '')) {
        throw ApiError.forbidden('Insufficient permissions to review verification', ErrorCodes.FORBIDDEN);
      }

      const verification = await this.identityRepository.getIdentityVerificationById(verificationId);
      if (!verification) {
        throw ApiError.notFound('Identity verification not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (verification.status === DocumentStatus.VERIFIED) {
        throw ApiError.badRequest('Cannot modify already verified identity', ErrorCodes.BAD_REQUEST);
      }

      if (status === DocumentStatus.NOT_VERIFIED && !rejectionReason) {
        throw ApiError.badRequest('Rejection reason is required when rejecting verification', ErrorCodes.MISSING_REQUIRED_FIELDS);
      }

      const updatedVerification = await this.identityRepository.updateVerificationStatus(
        verificationId,
        status,
        reviewerId,
        rejectionReason
      );

      if (status === DocumentStatus.VERIFIED) {
        // Update user and profile identityVerified status using Prisma
        await this.prisma.user.update({
          where: { id: verification.userId },
          data: { identityVerified: true },
        });
        await this.prisma.profile.update({
          where: { userId: verification.userId },
          data: { identityVerificationStatus: DocumentStatus.VERIFIED },
        });
      }

      if (notifyUser) {
        await this.sendIdentityVerificationStatusNotification(verification.userId, status, rejectionReason, req);
      }

      logger.info(`[${requestId}] Identity verification reviewed`, {
        verificationId,
        reviewerId,
        status,
        userId: verification.userId,
      });

      return updatedVerification;
    } catch (error) {
      logger.error(`[${requestId}] Error reviewing identity verification: ${error instanceof Error ? error.message : String(error)}`, {
        verificationId: request.verificationId,
        reviewerId: request.reviewerId,
      });
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to review identity verification', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async getIdentityVerifications(filters: IdentityVerificationFilters = {}, pagination: PaginationOptions = {}) {
    const requestId = uuidv4();
    try {
      return await this.identityRepository.getIdentityVerifications(filters, pagination);
    } catch (error) {
      logger.error(`[${requestId}] Error getting identity verifications: ${error instanceof Error ? error.message : String(error)}`, { filters, pagination });
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to get identity verifications', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async getVerificationStatistics() {
    const requestId = uuidv4();
    try {
      return await this.identityRepository.getVerificationStats();
    } catch (error) {
      logger.error(`[${requestId}] Error getting verification statistics: ${error instanceof Error ? error.message : String(error)}`);
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to get verification statistics', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async isUserIdentityVerified(userId: string): Promise<boolean> {
    const requestId = uuidv4();
    try {
      return await this.identityRepository.isUserIdentityVerified(userId);
    } catch (error) {
      logger.error(`[${requestId}] Error checking user identity verification: ${error instanceof Error ? error.message : String(error)}`, { userId });
      return false;
    }
  }

  async getPendingVerificationsCount(): Promise<number> {
    const requestId = uuidv4();
    try {
      return await this.identityRepository.getPendingVerificationsCount();
    } catch (error) {
      logger.error(`[${requestId}] Error getting pending verifications count: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  async resubmitIdentityVerification(
    userId: string,
    request: Omit<SubmitIdentityVerificationRequest, 'userId'>,
    token: string,
    req: Request
  ): Promise<IdentityVerification> {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      const existingVerification = await this.identityRepository.getIdentityVerificationByUserId(userId);

      if (!existingVerification) {
        throw ApiError.notFound('No previous verification found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (existingVerification.status !== DocumentStatus.NOT_VERIFIED) {
        throw ApiError.badRequest('Can only resubmit rejected verifications', ErrorCodes.BAD_REQUEST);
      }

      return await this.submitIdentityVerification({ ...request, userId }, token, req);
    } catch (error) {
      logger.error(`[${requestId}] Error resubmitting identity verification: ${error instanceof Error ? error.message : String(error)}`, { userId });
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to resubmit identity verification', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  async getVerificationById(verificationId: string) {
    const requestId = uuidv4();
    try {
      const verification = await this.identityRepository.getIdentityVerificationById(verificationId);

      if (!verification) {
        throw ApiError.notFound('Identity verification not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      return verification;
    } catch (error) {
      logger.error(`[${requestId}] Error getting verification by ID: ${error instanceof Error ? error.message : String(error)}`, { verificationId });
      throw error instanceof ApiError ? error : new ApiError(500, 'Failed to get verification', ErrorCodes.INTERNAL_ERROR, true);
    }
  }

  private async sendIdentityVerificationSubmittedNotification(userId: string, req: Request): Promise<void> {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!user) return;

      const notificationPayload: NotificationPayload = {
        eventTypeName: 'IDENTITY_VERIFICATION_SUBMITTED' as KnownEventTypes,
        dynamicData: {
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
          message: 'Your identity verification has been submitted and is under review.',
          submittedAt: new Date().toISOString(),
        },
        userIds: [userId],
      };

      const mockRes = {} as Response;
      await dispatchNotification(notificationPayload, req, mockRes);
    } catch (error) {
      logger.error(`[${requestId}] Error sending identity verification submitted notification: ${error instanceof Error ? error.message : String(error)}`, { userId });
    }
  }

  private async sendNewVerificationToAdminsNotification(verificationId: string, req: Request): Promise<void> {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      const verification = await this.identityRepository.getIdentityVerificationById(verificationId);
      if (!verification) return;

      const notificationPayload: NotificationPayload = {
        eventTypeName: 'NEW_IDENTITY_VERIFICATION' as KnownEventTypes,
        dynamicData: {
          userName: `${verification.user.firstName} ${verification.user.lastName}`,
          userEmail: verification.user.email,
          documentType: verification.documentType,
          country: verification.country,
          verificationId: verification.id,
          message: 'A new identity verification requires review.',
          submittedAt: verification.submittedAt.toISOString(),
        },
        roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'],
      };

      const mockRes = {} as Response;
      await dispatchNotification(notificationPayload, req, mockRes);
    } catch (error) {
      logger.error(`[${requestId}] Error sending new verification notification to admins: ${error instanceof Error ? error.message : String(error)}`, { verificationId });
    }
  }

  private async sendIdentityVerificationStatusNotification(
    userId: string,
    status: DocumentStatus,
    rejectionReason: string | undefined,
    req: Request
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] || uuidv4();
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!user) return;

      let eventType: string;
      let message: string;

      switch (status) {
        case DocumentStatus.VERIFIED:
          eventType = 'IDENTITY_VERIFICATION_APPROVED';
          message = 'Your identity verification has been approved!';
          break;
        case DocumentStatus.NOT_VERIFIED:
          eventType = 'IDENTITY_VERIFICATION_REJECTED';
          message = `Your identity verification has been rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`;
          break;
        case DocumentStatus.UNDER_REVIEW:
          eventType = 'IDENTITY_VERIFICATION_UNDER_REVIEW';
          message = 'Your identity verification is now under review.';
          break;
        default:
          return;
      }

      const notificationPayload: NotificationPayload = {
        eventTypeName: eventType as KnownEventTypes,
        dynamicData: {
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
          status,
          message,
          rejectionReason: rejectionReason || '',
          processedAt: new Date().toISOString(),
        },
        userIds: [userId],
      };

      const mockRes = {} as Response;
      await dispatchNotification(notificationPayload, req, mockRes);
    } catch (error) {
      logger.error(`[${requestId}] Error sending identity verification status notification: ${error instanceof Error ? error.message : String(error)}`, {
        userId,
        status,
      });
    }
  }

  private hasReviewPermissions(userRole: string): boolean {
    const allowedRoles: string[] = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
    return allowedRoles.includes(userRole);
  }
}