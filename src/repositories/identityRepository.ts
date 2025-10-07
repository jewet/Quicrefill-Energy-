// src/repositories/identity.repository.ts
import { 
  PrismaClient, 
  IdentityVerification, 
  DocumentStatus,
  IdentityVerificationType,
  Prisma 
} from '@prisma/client';
import logger from '../config/logger';
import { ApiError } from '../lib/utils/errors/appError';

// Define types for better type safety
export interface CreateIdentityVerificationData {
  userId: string;
  documentType: IdentityVerificationType;
  country: string;
  frontImageUrl: string;
  backImageUrl?: string;
  selfieImageUrl: string;
  deviceInfo?: string;
  documentNumber: string;
  profileId: string;
}

export interface UpdateIdentityVerificationData {
  status?: DocumentStatus;
  reviewedById?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  processedAt?: Date;
}

export interface IdentityVerificationFilters {
  status?: DocumentStatus;
  documentType?: IdentityVerificationType;
  country?: string;
  reviewedById?: string;
  submittedAfter?: Date;
  submittedBefore?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IdentityVerificationWithUser extends IdentityVerification {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
  };
  reviewedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  statusHistory?: {
    id: string;
    verificationId: string;
    status: DocumentStatus;
    notes: string | null;
    createdAt: Date;
    updatedById?: string | null;
  }[];
}

export class IdentityRepository {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Create identity verification
   */
  async createIdentityVerification(data: CreateIdentityVerificationData): Promise<IdentityVerificationWithUser> {
    try {
      // Check if user already has a verification
      const existingVerification = await this.getIdentityVerificationByUserId(data.userId);
      
      if (existingVerification) {
        throw ApiError.conflict('User already has an identity verification record');
      }

      // Validate documentNumber
      if (!data.documentNumber) {
        throw ApiError.badRequest('Document number is required');
      }

      // Validate profileId
      if (!data.profileId) {
        throw ApiError.badRequest('Profile ID is required');
      }

      const verification = await this.prisma.identityVerification.create({
        data: {
          ...data,
          status: DocumentStatus.PENDING,
          submittedAt: new Date(),
          statusHistory: {
            create: {
              status: DocumentStatus.PENDING,
              createdAt: new Date(),
              notes: 'Initial submission',
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          statusHistory: true,
        },
      });

      logger.info(`Identity verification created for user ${data.userId}`, {
        verificationId: verification.id,
        documentType: verification.documentType,
        documentNumber: verification.documentNumber,
      });

      return verification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('Error creating identity verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId,
        documentType: data.documentType,
      });
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw ApiError.conflict('User already has an identity verification record');
        }
        if (error.code === 'P2003') {
          throw ApiError.badRequest('Invalid user ID or profile ID provided');
        }
      }
      
      throw ApiError.internal('Failed to create identity verification');
    }
  }

  /**
   * Get identity verification by user ID
   */
  async getIdentityVerificationByUserId(userId: string): Promise<IdentityVerificationWithUser | null> {
    try {
      const verification = await this.prisma.identityVerification.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            }
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          statusHistory: true,
        }
      });

      return verification;
    } catch (error) {
      logger.error('Error getting identity verification by user ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw ApiError.internal('Failed to get identity verification');
    }
  }

  /**
   * Get identity verification by ID
   */
  async getIdentityVerificationById(id: string): Promise<IdentityVerificationWithUser | null> {
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        logger.error(`Invalid UUID format: ${id}`);
        throw ApiError.badRequest('Invalid verification ID format');
      }

      const verification = await this.prisma.identityVerification.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            }
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          statusHistory: true,
        }
      });

      return verification;
    } catch (error) {
      logger.error('Error getting identity verification by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId: id
      });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get identity verification');
    }
  }

  /**
   * Update identity verification
   */
  async updateIdentityVerification(
    id: string,
    data: UpdateIdentityVerificationData
  ): Promise<IdentityVerificationWithUser> {
    try {
      // Check if verification exists
      const existingVerification = await this.prisma.identityVerification.findUnique({
        where: { id }
      });

      if (!existingVerification) {
        throw ApiError.notFound('Identity verification not found');
      }

      const verification = await this.prisma.identityVerification.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            }
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          },
          statusHistory: true,
        }
      });

      logger.info(`Identity verification updated`, {
        verificationId: id,
        status: verification.status,
        reviewedBy: verification.reviewedById
      });

      return verification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('Error updating identity verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId: id
      });
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ApiError.notFound('Identity verification not found');
        }
      }
      
      throw ApiError.internal('Failed to update identity verification');
    }
  }

  /**
   * Update verification status with admin review
   */
  async updateVerificationStatus(
    id: string,
    status: DocumentStatus,
    reviewedById: string,
    rejectionReason?: string
  ): Promise<IdentityVerificationWithUser> {
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        logger.error(`Invalid UUID format: ${id}`);
        throw ApiError.badRequest('Invalid verification ID format');
      }

      const existingVerification = await this.prisma.identityVerification.findUnique({
        where: { id },
      });

      if (!existingVerification) {
        throw ApiError.notFound('Identity verification not found');
      }

      const verification = await this.prisma.identityVerification.update({
        where: { id },
        data: {
          status,
          reviewedById,
          reviewedAt: new Date(),
          processedAt: new Date(),
          rejectionReason: status === DocumentStatus.NOT_VERIFIED ? rejectionReason : null,
          updatedAt: new Date(),
          statusHistory: {
            create: {
              status,
              updatedById: reviewedById,
              notes: rejectionReason || `Status updated to ${status}`,
              createdAt: new Date(),
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          statusHistory: true,
        },
      });

      logger.info(`Identity verification status updated`, {
        verificationId: id,
        status,
        reviewedById,
      });

      return verification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('Error updating verification status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId: id,
        status,
        reviewedById,
      });
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ApiError.notFound('Identity verification not found');
        }
      }
      
      throw ApiError.internal('Failed to update verification status');
    }
  }

  /**
   * Get paginated identity verifications with filters
   */
  async getIdentityVerifications(
    filters: IdentityVerificationFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<{
    data: IdentityVerificationWithUser[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'submittedAt',
        sortOrder = 'desc'
      } = pagination;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.IdentityVerificationWhereInput = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.documentType) {
        where.documentType = filters.documentType;
      }

      if (filters.country) {
        where.country = {
          contains: filters.country,
          mode: 'insensitive'
        };
      }

      if (filters.reviewedById) {
        where.reviewedById = filters.reviewedById;
      }

      if (filters.submittedAfter || filters.submittedBefore) {
        where.submittedAt = {};
        if (filters.submittedAfter) {
          where.submittedAt.gte = filters.submittedAfter;
        }
        if (filters.submittedBefore) {
          where.submittedAt.lte = filters.submittedBefore;
        }
      }

      // Build order by clause
      const orderBy: Prisma.IdentityVerificationOrderByWithRelationInput = {};
      if (sortBy === 'submittedAt' || sortBy === 'reviewedAt' || sortBy === 'processedAt') {
        orderBy[sortBy] = sortOrder;
      } else if (sortBy === 'userName') {
        orderBy.user = { firstName: sortOrder };
      } else {
        orderBy.submittedAt = 'desc';
      }

      const [data, total] = await Promise.all([
        this.prisma.identityVerification.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
              }
            },
            reviewedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            },
            statusHistory: true
          }
        }),
        this.prisma.identityVerification.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      logger.error('Error getting identity verifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination
      });
      throw ApiError.internal('Failed to get identity verifications');
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<{
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    underReview: number;
  }> {
    try {
      const [total, pending, verified, rejected, underReview] = await Promise.all([
        this.prisma.identityVerification.count(),
        this.prisma.identityVerification.count({ where: { status: DocumentStatus.PENDING } }),
        this.prisma.identityVerification.count({ where: { status: DocumentStatus.VERIFIED } }),
        this.prisma.identityVerification.count({ where: { status: DocumentStatus.NOT_VERIFIED } }),
        this.prisma.identityVerification.count({ where: { status: DocumentStatus.UNDER_REVIEW } })
      ]);

      return {
        total,
        pending,
        verified,
        rejected,
        underReview
      };
    } catch (error) {
      logger.error('Error getting verification statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw ApiError.internal('Failed to get verification statistics');
    }
  }

  /**
   * Delete identity verification (soft delete by updating status)
   */
  async deleteIdentityVerification(id: string): Promise<void> {
    try {
      const verification = await this.prisma.identityVerification.findUnique({
        where: { id }
      });

      if (!verification) {
        throw ApiError.notFound('Identity verification not found');
      }

      // Instead of hard delete, we might want to archive or mark as deleted
      // For now, we'll do a hard delete as per the original schema
      await this.prisma.identityVerification.delete({
        where: { id }
      });

      logger.info(`Identity verification deleted`, {
        verificationId: id,
        userId: verification.userId
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      logger.error('Error deleting identity verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationId: id
      });
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw ApiError.notFound('Identity verification not found');
        }
      }
      
      throw ApiError.internal('Failed to delete identity verification');
    }
  }

  /**
   * Check if user has verified identity
   */
  async isUserIdentityVerified(userId: string): Promise<boolean> {
    try {
      const verification = await this.prisma.identityVerification.findUnique({
        where: { 
          userId,
          status: DocumentStatus.VERIFIED 
        }
      });

      return !!verification;
    } catch (error) {
      logger.error('Error checking user identity verification status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return false;
    }
  }

  /**
   * Get pending verifications count
   */
  async getPendingVerificationsCount(): Promise<number> {
    try {
      return await this.prisma.identityVerification.count({
        where: { status: DocumentStatus.PENDING }
      });
    } catch (error) {
      logger.error('Error getting pending verifications count', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw ApiError.internal('Failed to get pending verifications count');
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}