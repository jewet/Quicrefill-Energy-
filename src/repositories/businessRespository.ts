// src/repositories/business.repository.ts
import { PrismaClient, BusinessVerification, VerificationStatus } from '@prisma/client';
import logger from '../config/logger';
import { ApiError } from '../lib/utils/errors/appError';

const prisma = new PrismaClient();

interface CreateBusinessVerificationData {
  userId: string;
  businessName: string;
  rcNumber: string;
  businessAddress: string;
  tinNumber?: string | null;
  cacDocumentUrl: string;
  proofOfAddressUrl: string;
  tinDocumentUrl?: string | null;
}

export class BusinessRepository {
  /**
   * Create business verification
   */
  async createBusinessVerification(data: CreateBusinessVerificationData): Promise<BusinessVerification> {
    try {
      const verification = await prisma.businessVerification.create({
        data: {
          ...data,
          status: VerificationStatus.PENDING,
          submittedAt: new Date()
        }
      });
      return verification;
    } catch (error) {
      logger.error(`Error creating business verification: ${error}`);
      throw ApiError.internal(
        'Failed to create business verification'
      );
    }
  }

  /**
   * Get business verification by user ID
   */
  async getBusinessVerificationByUserId(userId: string): Promise<BusinessVerification | null> {
    try {
      const verification = await prisma.businessVerification.findUnique({
        where: { userId }
      });
      return verification;
    } catch (error) {
      logger.error(`Error getting business verification for user ${userId}: ${error}`);
      throw ApiError.internal(
        'Failed to get business verification'
      );
    }
  }

  /**
   * Update business verification status
   */
  async updateBusinessVerificationStatus(
    id: string,
    status: VerificationStatus,
    adminId: string,
    rejectionReason?: string
  ): Promise<BusinessVerification> {
    try {
      const verification = await prisma.businessVerification.update({
        where: { id },
        data: {
          status,
          adminId,
          rejectionReason: rejectionReason || null,
          processedAt: new Date()
        }
      });
      return verification;
    } catch (error) {
      logger.error(`Error updating business verification status: ${error}`);
      throw ApiError.internal(
        'Failed to update business verification status'
      );
    }
  }
}