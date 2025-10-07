import { PrismaClient, VerificationStatus } from '@prisma/client';
import { ApiError } from '../lib/utils/errors/appError';
import logger from '../config/logger';
import { dispatchNotification, NotificationPayload } from './notificationServices';
import { KnownEventTypes } from '../utils/EventTypeDictionary';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export class VerificationService {
  /**
   * Get pending service verifications
   */
  async getPendingVerifications() {
    try {
      const verifications = await prisma.serviceVerification.findMany({
        where: {
          status: VerificationStatus.PENDING,
        },
        include: {
          service: true,
          profile: true,
          user: true,
        },
      });
      return verifications;
    } catch (error) {
      logger.error(`Error getting pending verifications: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get pending verifications');
    }
  }

  /**
   * Get verification details
   */
  async getVerificationById(id: string) {
    try {
      const verification = await prisma.serviceVerification.findUnique({
        where: { id },
        include: {
          service: true,
          profile: true,
          user: true,
        },
      });

      if (!verification) {
        logger.error(`Verification not found: ${id}`);
        throw ApiError.notFound('Verification not found');
      }

      return verification;
    } catch (error) {
      logger.error(`Error getting verification details: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get verification details');
    }
  }

  /**
   * Process verification (approve or reject)
   * @param req Express request (for notification context)
   */
  async processVerification(id: string, status: VerificationStatus, adminId: string, notes?: string, req?: Request) {
    try {
      // Validate status
      if (!Object.values(VerificationStatus).includes(status)) {
        logger.error(`Invalid status: ${status}`);
        throw ApiError.badRequest(
          `Status must be one of: ${Object.values(VerificationStatus).join(', ')}`
        );
      }

      // Check if verification exists
      const verification = await prisma.serviceVerification.findUnique({
        where: { id },
      });

      if (!verification) {
        logger.error(`Verification not found: ${id}`);
        throw ApiError.notFound('Verification not found');
      }

      // Validate verification status
      if (verification.status !== VerificationStatus.PENDING) {
        logger.error(`Verification already processed: ${verification.status}`);
        throw ApiError.conflict(
          `Verification has already been ${verification.status.toLowerCase()}`
        );
      }

      // Process verification
      const updatedVerification = await prisma.serviceVerification.update({
        where: { id },
        data: {
          status,
          adminId,
          notes,
          processedAt: new Date(),
        },
        include: {
          service: true,
          user: true,
        },
      });

      // Send notification if serviceId exists
      if (updatedVerification.serviceId) {
        try {
          // Fetch the service to get providerId
          const service = await prisma.service.findUnique({
            where: { id: updatedVerification.serviceId },
          });

          if (service && service.providerId) {
            // Fetch user directly with Prisma
            const user = await prisma.user.findUnique({
              where: { id: service.providerId },
            });

            if (user) {
              let eventType: KnownEventTypes;
              let message: string;
              if (status === VerificationStatus.APPROVED) {
                eventType = 'SERVICE_VERIFICATION_APPROVED' as KnownEventTypes;
                message = `Your service "${service.name}" has been approved and is now active.`;
              } else if (status === VerificationStatus.REJECTED) {
                eventType = 'SERVICE_VERIFICATION_REJECTED' as KnownEventTypes;
                message = `Your service "${service.name}" verification was rejected.${notes ? ' Reason: ' + notes : ''}`;
              } else {
                eventType = 'SERVICE_VERIFICATION_UPDATED' as KnownEventTypes;
                message = `Your service "${service.name}" verification status has been updated.`;
              }

              const notificationPayload: NotificationPayload = {
                eventTypeName: eventType,
                dynamicData: {
                  userName: `${user.firstName} ${user.lastName}`,
                  userEmail: user.email,
                  serviceName: service.name,
                  status,
                  message,
                  rejectionReason: notes || '',
                  processedAt: new Date().toISOString(),
                },
                userIds: [user.id],
              };

              // Use mock Request and Response if not provided
              const mockRequest = req || ({} as Request);
              const mockRes = {} as Response;
              await dispatchNotification(notificationPayload, mockRequest, mockRes);
            }
          }
        } catch (notifyError) {
          logger.error('Error sending service verification notification', {
            error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
            verificationId: id,
          });
        }
      }

      return updatedVerification;
    } catch (error) {
      logger.error(`Error processing verification: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to process verification');
    }
  }
}