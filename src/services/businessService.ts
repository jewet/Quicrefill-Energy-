import { BusinessRepository } from '../repositories/businessRespository';
import { StorageServiceClient } from './storageServiceClient';
import { ApiError } from '../lib/utils/errors/appError';
import logger from '../config/logger';
import { VerificationStatus, PrismaClient } from '@prisma/client';
import { dispatchNotification, NotificationPayload } from './notificationServices';
import { KnownEventTypes } from '../utils/EventTypeDictionary';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface BusinessVerificationData {
  businessName: string;
  rcNumber: string;
  businessAddress: string;
  tinNumber?: string;
  token: string;
}

export class BusinessService {
  private businessRepository: BusinessRepository;
  private prisma: PrismaClient;

  constructor(businessRepository?: BusinessRepository, prisma?: PrismaClient) {
    this.businessRepository = businessRepository || new BusinessRepository();
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Submit business verification
   */
  async submitBusinessVerification(
    userId: string,
    businessData: BusinessVerificationData,
    cacDocumentPath: string,
    proofOfAddressPath: string,
    tinDocumentPath?: string
  ) {
    const requestId = uuidv4();
    try {
      // Check if verification already exists
      const existingVerification = await this.businessRepository.getBusinessVerificationByUserId(userId);
      let verification;

      if (existingVerification) {
        if (existingVerification.status === VerificationStatus.PENDING) {
          throw ApiError.conflict('A business verification request is already pending for this user');
        }
        verification = await this.businessRepository.updateBusinessVerificationStatus(
          existingVerification.id,
          VerificationStatus.PENDING,
          '',
          undefined
        );
      } else {
        // Upload documents to storage service
        const uploadResult = await StorageServiceClient.uploadBusinessDocument(
          proofOfAddressPath,
          cacDocumentPath,
          businessData.token,
          tinDocumentPath
        );

        if (!uploadResult) {
          throw ApiError.internal('Failed to upload business documents');
        }

        // Create business verification data
        const verificationData = {
          userId,
          businessName: businessData.businessName,
          rcNumber: businessData.rcNumber,
          businessAddress: businessData.businessAddress,
          tinNumber: businessData.tinNumber || null,
          cacDocumentUrl: uploadResult.cacDocumentPath,
          proofOfAddressUrl: uploadResult.proofOfAddressPath,
          tinDocumentUrl: uploadResult.tinDocumentPath || null,
        };

        verification = await this.businessRepository.createBusinessVerification(verificationData);
      }

      logger.info(`[${requestId}] Business verification submitted successfully`, {
        userId,
        verificationId: verification.id,
        businessName: businessData.businessName,
      });

      return verification;
    } catch (error: any) {
      logger.error(`[${requestId}] Failed to upload business document: ${error.message}`, {
        userId,
      });
      throw error instanceof ApiError ? error : ApiError.badRequest(error.message || 'Business document upload failed');
    }
  }

  /**
   * Check business verification status
   */
  async checkBusinessVerificationStatus(userId: string) {
    const requestId = uuidv4();
    try {
      const verification = await this.businessRepository.getBusinessVerificationByUserId(userId);

      if (!verification) {
        return {
          status: 'NOT_SUBMITTED',
          message: 'Business verification has not been submitted',
        };
      }

      return {
        status: verification.status,
        businessName: verification.businessName,
        rcNumber: verification.rcNumber,
        submittedAt: verification.submittedAt,
        processedAt: verification.processedAt,
        rejectionReason: verification.rejectionReason,
      };
    } catch (error) {
      logger.error(`[${requestId}] Error checking business verification status: ${error}`, { userId });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to check business verification status');
    }
  }

  /**
   * Update business verification status and notify user
   */
  async updateBusinessVerificationStatus(
    id: string,
    status: VerificationStatus,
    adminId: string,
    rejectionReason?: string,
    req?: Request
  ) {
    const requestId = req?.headers['x-request-id'] || uuidv4();
    try {
      // Optional: Validate admin permissions (uncomment to enable)
      /*
      if (!(await this.hasAdminPermissions(adminId))) {
        throw ApiError.forbidden('Insufficient permissions to update business verification');
      }
      */

      const updatedVerification = await this.businessRepository.updateBusinessVerificationStatus(
        id,
        status,
        adminId,
        rejectionReason
      );

      try {
        // Fetch user using Prisma
        const user = await this.prisma.user.findUnique({
          where: { id: updatedVerification.userId },
          select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (user) {
          let eventType: KnownEventTypes;
          let message: string;
          if (status === VerificationStatus.APPROVED) {
            eventType = 'BUSINESS_VERIFICATION_APPROVED' as KnownEventTypes;
            message = `Your business "${updatedVerification.businessName}" has been approved.`;
          } else if (status === VerificationStatus.REJECTED) {
            eventType = 'BUSINESS_VERIFICATION_REJECTED' as KnownEventTypes;
            message = `Your business "${updatedVerification.businessName}" verification was rejected.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`;
          } else {
            eventType = 'BUSINESS_VERIFICATION_UPDATED' as KnownEventTypes;
            message = `Your business "${updatedVerification.businessName}" verification status has been updated.`;
          }

          const notificationPayload: NotificationPayload = {
            eventTypeName: eventType,
            dynamicData: {
              userName: `${user.firstName} ${user.lastName}`,
              userEmail: user.email,
              businessName: updatedVerification.businessName,
              status,
              message,
              rejectionReason: rejectionReason || '',
              processedAt: new Date().toISOString(),
            },
            userIds: [user.id],
          };

          if (req) {
            const mockRes = {} as Response;
            await dispatchNotification(notificationPayload, req, mockRes);
          }
        }
      } catch (notifyError) {
        logger.error(`[${requestId}] Error sending business verification notification: ${notifyError instanceof Error ? notifyError.message : 'Unknown error'}`, {
          verificationId: id,
        });
      }

      logger.info(`[${requestId}] Business verification status updated`, {
        verificationId: id,
        status,
        adminId,
        userId: updatedVerification.userId,
      });

      return updatedVerification;
    } catch (error) {
      logger.error(`[${requestId}] Error updating business verification status: ${error}`, {
        verificationId: id,
        adminId,
      });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to update business verification status');
    }
  }

  /**
   * Optional: Check if the user has admin permissions (uncomment to use)
   */
  /*
  private async hasAdminPermissions(adminId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: { select: { name: true } } },
    });
    const allowedRoles = ['ADMIN', 'MANAGER', 'SUPERVISOR'];
    return allowedRoles.includes(user?.role?.name || '');
  }
  */
}