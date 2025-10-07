import { PrismaClient, ServiceVerification, VerificationStatus } from '@prisma/client';
import logger from '../config/logger';
import { ApiError } from '../lib/utils/errors/appError';

const prisma = new PrismaClient();

export interface CreateVerificationData {
  serviceId: string;
  profileId?: string; // Added to align with schema
  userId?: string; // Added to align with schema
  notes?: string;
  adminId?: string;
}

export class VerificationRepository {
  /**
   * Create a new service verification
   */
  async createVerification(verificationData: CreateVerificationData): Promise<ServiceVerification> {
    try {
      // Check if verification already exists for this service
      const existingVerification = await prisma.serviceVerification.findFirst({
        where: { serviceId: verificationData.serviceId },
      });

      if (existingVerification) {
        if (existingVerification.status === VerificationStatus.PENDING) {
          throw ApiError.conflict(
            'A verification request is already pending for this service'
          );
        } else {
          // Update existing verification in a transaction
          const [updatedVerification] = await prisma.$transaction([
            prisma.serviceVerification.update({
              where: { id: existingVerification.id },
              data: {
                notes: verificationData.notes,
                status: VerificationStatus.PENDING,
                submittedAt: new Date(),
                processedAt: null,
                adminId: verificationData.adminId,
              },
            }),
            prisma.service.update({
              where: { id: verificationData.serviceId },
              data: {
                status: 'PENDING_VERIFICATION',
              },
            }),
          ]);
          return updatedVerification;
        }
      }

      // Create new verification in a transaction
      const [verification] = await prisma.$transaction([
        prisma.serviceVerification.create({
          data: {
            serviceId: verificationData.serviceId,
            profileId: verificationData.profileId,
            userId: verificationData.userId,
            notes: verificationData.notes,
            status: VerificationStatus.PENDING,
            adminId: verificationData.adminId,
            submittedAt: new Date(),
          },
        }),
        prisma.service.update({
          where: { id: verificationData.serviceId },
          data: {
            status: 'PENDING_VERIFICATION',
          },
        }),
      ]);
      return verification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error creating verification: ${error}`);
      throw ApiError.internal('Failed to create verification');
    }
  }

  /**
   * Get verification by serviceId
   */
  async getVerificationByServiceId(serviceId: string): Promise<ServiceVerification | null> {
    try {
      const verification = await prisma.serviceVerification.findFirst({
        where: { serviceId },
      });
      return verification;
    } catch (error) {
      logger.error(`Error getting verification for service ${serviceId}: ${error}`);
      throw ApiError.internal('Failed to get verification');
    }
  }

  /**
   * Get verification by id
   */
  async getVerificationById(id: string): Promise<ServiceVerification | null> {
    try {
      const verification = await prisma.serviceVerification.findUnique({
        where: { id },
      });
      return verification;
    } catch (error) {
      logger.error(`Error getting verification ${id}: ${error}`);
      throw ApiError.internal('Failed to get verification');
    }
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(
    id: string,
    status: VerificationStatus,
    adminId: string,
    notes?: string
  ): Promise<ServiceVerification> {
    try {
      // Fetch the service verification to get the serviceId
      const verification = await prisma.serviceVerification.findUnique({
        where: { id },
        select: { serviceId: true },
      });

      if (!verification || !verification.serviceId) {
        throw ApiError.notFound('Service verification or associated service not found');
      }

      // Update verification and service in a transaction
      const [updatedVerification] = await prisma.$transaction([
        prisma.serviceVerification.update({
          where: { id },
          data: {
            status,
            adminId,
            notes: notes || undefined,
            processedAt: new Date(),
          },
        }),
        prisma.service.update({
          where: { id: verification.serviceId },
          data: {
            status: status === VerificationStatus.APPROVED ? 'ACTIVE' : 'INACTIVE',
            verified: status === VerificationStatus.APPROVED,
            verifiedAt: status === VerificationStatus.APPROVED ? new Date() : null,
          },
        }),
      ]);
      return updatedVerification;
    } catch (error) {
      logger.error(`Error updating verification status ${id}: ${error}`);
      throw ApiError.internal('Failed to update verification status');
    }
  }

  /**
   * Get pending verifications
   */
  async getPendingVerifications(): Promise<ServiceVerification[]> {
    try {
      const verifications = await prisma.serviceVerification.findMany({
        where: { status: VerificationStatus.PENDING },
        orderBy: {
          submittedAt: 'asc',
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              providerId: true,
              serviceType: true,
            },
          },
        },
      });
      return verifications;
    } catch (error) {
      logger.error(`Error getting pending verifications: ${error}`);
      throw ApiError.internal('Failed to get verifications');
    }
  }
}