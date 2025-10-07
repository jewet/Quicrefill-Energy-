import { PrismaClient, FeedbackStatus, IssueType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../errors/ApiError';
import { ErrorCodes } from '../errors/errorCodes';
import logger from '../config/logger';

// Interfaces for input validation and type safety
interface FeedbackCreateInput {
  receiverId: string;
  orderId?: string;
  serviceOrderId?: string;
  comment?: string;
  rating: number;
  priority?: string;
  issueType?: IssueType;
}

interface FeedbackUpdateInput {
  comment?: string;
  rating?: number;
  status?: FeedbackStatus;
  priority?: string;
  issueType?: IssueType;
  adminResponse?: string;
}

interface FeedbackFilter {
  status?: FeedbackStatus;
  issueType?: IssueType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface FeedbackResponse {
  id: string;
  ticketId: string;
  giver: { firstName: string; lastName: string; email: string };
  receiver: { firstName: string; lastName: string; email: string };
  comment?: string | null;
  rating: number;
  status: FeedbackStatus;
  priority: string;
  issueType: IssueType;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  order?: any;
  serviceOrder?: any;
  giverRole: { id: string; name: string };
  receiverRole: { id: string; name: string };
  agentProfile?: any;
  vendor?: any;
  customerProfile?: any;
}

interface DashboardResponse {
  total: number;
  open: number;
  resolved: number;
  avgResolutionTime: string;
  data: FeedbackResponse[];
}

const prisma = new PrismaClient();

export class FeedbackService {
  /**
   * Retrieves admin emails for notifications
   * @returns Array of admin email addresses
   * @throws ApiError if no admins are found
   */
  private async getAdminEmails(): Promise<string[]> {
    try {
      const admins = await prisma.user.findMany({
        where: { role: { name: 'ADMIN' } },
        select: { email: true },
      });
      const emails = admins.map(admin => admin.email).filter(email => email);
      if (emails.length === 0) {
        throw new ApiError(500, 'No admin emails configured', ErrorCodes.INTERNAL_ERROR, false);
      }
      return emails;
    } catch (error: any) {
      logger.error('Failed to retrieve admin emails', { error: error.message });
      throw ApiError.internal('Failed to retrieve admin emails', ErrorCodes.INTERNAL_ERROR, { error: error.message });
    }
  }

  /**
   * Ensures an EventType exists or creates a new one
   * @param name - The name of the event type
   * @param createdBy - The ID of the user creating the event type
   * @returns The ID of the event type
   * @throws ApiError if creation fails
   */
  private async ensureEventType(name: string, createdBy: string = 'system'): Promise<string> {
    try {
      let eventType = await prisma.eventType.findUnique({ where: { name } });
      if (!eventType) {
        eventType = await prisma.eventType.create({
          data: {
            id: uuidv4(),
            name,
            createdBy,
            description: `Event type for ${name}`,
          },
        });
        logger.info(`Created EventType: ${name}`, { eventTypeId: eventType.id });
      }
      return eventType.id;
    } catch (error: any) {
      logger.error(`Failed to ensure EventType: ${name}`, { error: error.message });
      throw ApiError.internal(`Failed to ensure EventType: ${error.message}`, ErrorCodes.INTERNAL_ERROR, { error: error.message });
    }
  }

  /**
   * Creates a new feedback ticket
   * @param userId - The ID of the user submitting the feedback
   * @param roleId - The ID of the user's role
   * @param input - Feedback creation input
   * @returns The created feedback object
   * @throws ApiError for validation, resource, or forbidden errors
   */
  async createFeedback(userId: string, roleId: string, input: FeedbackCreateInput): Promise<FeedbackResponse> {
    try {
      // Validate inputs
      if (!userId || !roleId || !input.receiverId || input.rating == null) {
        throw ApiError.badRequest('Missing required fields: userId, roleId, receiverId, rating', ErrorCodes.MISSING_FIELDS);
      }
      if (input.rating < 1 || input.rating > 5) {
        throw ApiError.badRequest('Rating must be between 1 and 5', ErrorCodes.VALIDATION_ERROR);
      }
      if (input.priority && !['LOW', 'MEDIUM', 'HIGH'].includes(input.priority)) {
        throw ApiError.badRequest('Invalid priority value', ErrorCodes.VALIDATION_ERROR);
      }
      if (input.issueType && !Object.values(IssueType).includes(input.issueType)) {
        throw ApiError.badRequest('Invalid issue type', ErrorCodes.VALIDATION_ERROR);
      }

      // Check if role is ADMIN
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) {
        throw ApiError.notFound('Role not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }
      if (role.name === 'ADMIN') {
        throw ApiError.forbidden('Admins cannot submit feedback', ErrorCodes.FORBIDDEN);
      }

      // Validate receiver
      const receiver = await prisma.user.findUnique({
        where: { id: input.receiverId },
        include: { role: true },
      });
      if (!receiver) {
        throw ApiError.notFound('Receiver not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Validate order or serviceOrder if provided
      if (input.orderId) {
        const order = await prisma.productOrder.findUnique({ where: { id: input.orderId } });
        if (!order) {
          throw ApiError.notFound('Order not found', ErrorCodes.ORDER_NOT_FOUND);
        }
      }
      if (input.serviceOrderId) {
        const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: input.serviceOrderId } });
        if (!serviceOrder) {
          throw ApiError.notFound('Service order not found', ErrorCodes.SERVICE_NOT_FOUND);
        }
      }

      // Determine receiver role
      const receiverRole = receiver.role;
      if (!receiverRole) {
        throw ApiError.notFound('Receiver role not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }
      const effectiveReceiverRoleId = receiverRole.name === 'DELIVERY_REP' || receiverRole.name === 'VENDOR'
        ? (await prisma.role.findFirst({ where: { name: 'VENDOR' } }))?.id || receiverRole.id
        : receiverRole.id;

      // Generate unique ticket ID
      const ticketId = `TCK${Math.floor(100000 + Math.random() * 900000)}`;

      // Create feedback
      const feedback = await prisma.feedback.create({
        data: {
          id: uuidv4(),
          ticketId,
          giverId: userId,
          giverRoleId: roleId,
          receiverId: input.receiverId,
          receiverRoleId: effectiveReceiverRoleId,
          orderId: input.orderId,
          serviceOrderId: input.serviceOrderId,
          comment: input.comment,
          rating: input.rating,
          status: FeedbackStatus.PENDING,
          priority: input.priority || 'LOW',
          issueType: input.issueType || IssueType.GENERAL,
          customerId: role.name === 'CUSTOMER' ? userId : undefined,
          agentProfileId: receiverRole.name === 'DELIVERY_REP' ? input.receiverId : undefined,
          vendorId: receiverRole.name === 'VENDOR' ? input.receiverId : undefined,
        },
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          order: true,
          serviceOrder: true,
          giverRole: true,
          receiverRole: true,
          agentProfile: true,
          vendor: true,
          customerProfile: true,
        },
      });

      logger.info(`Created feedback ticket: ${ticketId}`, { feedbackId: feedback.id, userId });

      // Update receiver's average rating
      await this.updateReceiverRating(input.receiverId, effectiveReceiverRoleId);

      // Create notification for admin
      const eventTypeId = await this.ensureEventType('FEEDBACK_SUBMITTED');
      const adminEmails = await this.getAdminEmails();
      await Promise.all(adminEmails.map(email =>
        prisma.notificationLog.create({
          data: {
            id: uuidv4(),
            userId: null,
            vendorId: receiverRole.name === 'VENDOR' ? receiver.id : null,
            type: 'FEEDBACK_SUBMITTED',
            eventTypeId,
            payload: JSON.stringify({ feedbackId: feedback.id, comment: input.comment, rating: input.rating, ticketId }),
            status: 'PENDING',
            channel: 'EMAIL',
            recipient: email,
            message: `New feedback ticket ${ticketId} submitted by ${feedback.giver.firstName} ${feedback.giver.lastName}`,
          },
        })
      ));

      return feedback;
    } catch (error: any) {
      logger.error(`Error creating feedback`, { error: error.message, userId, input });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal(`Failed to create feedback: ${error.message}`, ErrorCodes.INTERNAL_ERROR, { error: error.message });
    }
  }

  /**
   * Updates the average rating for a receiver
   * @param userId - The ID of the receiver
   * @param roleId - The ID of the receiver's role
   * @throws ApiError if update fails
   */
  async updateReceiverRating(userId: string, roleId: string): Promise<void> {
    try {
      if (!userId || !roleId) {
        throw ApiError.badRequest('Missing userId or roleId', ErrorCodes.MISSING_FIELDS);
      }

      const feedbacks = await prisma.feedback.findMany({
        where: { receiverId: userId, receiverRoleId: roleId },
        select: { rating: true },
      });

      const avgRating = feedbacks.length
        ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
        : 0;

      await prisma.rating.upsert({
        where: { userId_roleId: { userId, roleId } },
        update: { avgRating, ratingCount: feedbacks.length },
        create: {
          id: uuidv4(),
          userId,
          roleId,
          avgRating,
          ratingCount: feedbacks.length,
        },
      });

      logger.info(`Updated rating for user: ${userId}`, { avgRating, ratingCount: feedbacks.length });
    } catch (error: any) {
      logger.error(`Error updating receiver rating`, { error: error.message, userId, roleId });
      throw ApiError.internal(`Failed to update receiver rating: ${error.message}`, ErrorCodes.INTERNAL_ERROR, { error: error.message });
    }
  }

  /**
   * Retrieves feedback tickets with filtering, pagination, and KPIs for admin dashboard
   * @param filter - Filtering and pagination options
   * @returns Dashboard data with KPIs and feedback list
   * @throws ApiError for validation or internal errors
   */
async getFeedbacksForAdmin(filter: FeedbackFilter): Promise<DashboardResponse> {
  try {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', status, issueType, dateFrom, dateTo } = filter;

    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      throw ApiError.badRequest('Page and limit must be positive integers', ErrorCodes.VALIDATION_ERROR);
    }
    if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
      throw ApiError.badRequest('Invalid sort order', ErrorCodes.VALIDATION_ERROR);
    }
    if (status && !Object.values(FeedbackStatus).includes(status)) {
      throw ApiError.badRequest('Invalid status value', ErrorCodes.VALIDATION_ERROR);
    }
    if (issueType && !Object.values(IssueType).includes(issueType)) {
      throw ApiError.badRequest('Invalid issue type', ErrorCodes.VALIDATION_ERROR);
    }

    const where: Prisma.FeedbackWhereInput = {};
    if (status) where.status = status;
    if (issueType) where.issueType = issueType;

    // Initialize createdAt as an object if date filters are provided
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        if (isNaN(Date.parse(dateFrom))) {
          throw ApiError.badRequest('Invalid dateFrom format', ErrorCodes.VALIDATION_ERROR);
        }
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        if (isNaN(Date.parse(dateTo))) {
          throw ApiError.badRequest('Invalid dateTo format', ErrorCodes.VALIDATION_ERROR);
        }
        where.createdAt.lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        { ticketId: { contains: search, mode: 'insensitive' } },
        { giver: { firstName: { contains: search, mode: 'insensitive' } } },
        { giver: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Calculate KPI counts
    const [totalTickets, openTickets, resolvedTickets, feedbacks] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.count({
        where: { ...where, status: { in: [FeedbackStatus.PENDING, FeedbackStatus.RESPONDED] } },
      }),
      prisma.feedback.count({
        where: { ...where, status: FeedbackStatus.RESOLVED },
      }),
      prisma.feedback.findMany({
        where,
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          order: true,
          serviceOrder: true,
          giverRole: true,
          receiverRole: true,
          agentProfile: true,
          vendor: true,
          customerProfile: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    logger.info(`Retrieved feedback dashboard data`, { page, limit, totalTickets });

    return {
      total: totalTickets,
      open: openTickets,
      resolved: resolvedTickets,
      avgResolutionTime: await this.calculateAvgResolutionTime(feedbacks),
      data: feedbacks,
    };
  } catch (error: any) {
    logger.error(`Error retrieving feedback dashboard`, { error: error.message, filter });
    if (error instanceof ApiError) {
      throw error;
    }
    throw ApiError.internal(`Failed to retrieve feedback dashboard: ${error.message}`, ErrorCodes.INTERNAL_ERROR, { error: error.message });
  }
}

  /**
   * Updates a feedback ticket, including admin response
   * @param feedbackId - The ID of the feedback ticket
   * @param input - Update input including optional admin response
   * @returns The updated feedback object
   * @throws ApiError for validation, resource, or internal errors
   */
  async updateFeedback(feedbackId: string, input: FeedbackUpdateInput): Promise<FeedbackResponse> {
    try {
      if (!feedbackId) {
        throw ApiError.badRequest('Feedback ID is required', ErrorCodes.MISSING_FIELDS);
      }

      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          giverRole: true,
          receiverRole: true,
        },
      });
      if (!feedback) {
        throw ApiError.notFound('Feedback not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Validate input
      if (input.rating && (input.rating < 1 || input.rating > 5)) {
        throw ApiError.badRequest('Rating must be between 1 and 5', ErrorCodes.VALIDATION_ERROR);
      }
      if (input.status && !Object.values(FeedbackStatus).includes(input.status)) {
        throw ApiError.badRequest('Invalid status value', ErrorCodes.VALIDATION_ERROR);
      }
      if (input.issueType && !Object.values(IssueType).includes(input.issueType)) {
        throw ApiError.badRequest('Invalid issue type', ErrorCodes.VALIDATION_ERROR);
      }
      if (input.priority && !['LOW', 'MEDIUM', 'HIGH'].includes(input.priority)) {
        throw ApiError.badRequest('Invalid priority value', ErrorCodes.VALIDATION_ERROR);
      }

      // Handle admin response
      if (input.adminResponse) {
        const eventTypeId = await this.ensureEventType('FEEDBACK_RESPONDED');
        const adminEmails = await this.getAdminEmails();
        await Promise.all(adminEmails.map(email =>
          prisma.notificationLog.create({
            data: {
              id: uuidv4(),
              userId: feedback.giverId,
              type: 'FEEDBACK_RESPONDED',
              eventTypeId,
              payload: JSON.stringify({
                feedbackId,
                ticketId: feedback.ticketId,
                adminResponse: input.adminResponse,
              }),
              status: 'PENDING',
              channel: 'EMAIL',
              recipient: email,
              message: `Your feedback ticket ${feedback.ticketId} has received a response`,
            },
          })
        ));
      }

      const updatedFeedback = await prisma.feedback.update({
        where: { id: feedbackId },
        data: {
          comment: input.comment,
          rating: input.rating,
          status: input.adminResponse && feedback.status === FeedbackStatus.PENDING
            ? FeedbackStatus.RESPONDED
            : input.status,
          priority: input.priority,
          issueType: input.issueType,
          resolvedAt: input.status === FeedbackStatus.RESOLVED ? new Date() : undefined,
        },
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          order: true,
          serviceOrder: true,
          giverRole: true,
          receiverRole: true,
          agentProfile: true,
          vendor: true,
          customerProfile: true,
        },
      });

      if (input.rating) {
        await this.updateReceiverRating(feedback.receiverId, feedback.receiverRoleId);
      }

      logger.info(`Updated feedback ticket: ${feedback.ticketId}`, { feedbackId, input });

      return updatedFeedback;
    } catch (error: any) {
      logger.error(`Error updating feedback`, { error: error.message, feedbackId, input });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal(`Failed to update feedback: ${error.message}`, ErrorCodes.INTERNAL_ERROR, { error: error.message });
    }
  }

  /**
   * Reopens a resolved feedback ticket
   * @param feedbackId - The ID of the feedback ticket
   * @returns The reopened feedback object
   * @throws ApiError for validation, resource, or internal errors
   */
  async reopenFeedback(feedbackId: string): Promise<FeedbackResponse> {
    try {
      if (!feedbackId) {
        throw ApiError.badRequest('Feedback ID is required', ErrorCodes.MISSING_FIELDS);
      }

      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          giverRole: true,
          receiverRole: true,
        },
      });
      if (!feedback) {
        throw ApiError.notFound('Feedback not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      if (feedback.status !== FeedbackStatus.RESOLVED) {
        throw ApiError.badRequest('Only resolved feedback can be reopened', ErrorCodes.VALIDATION_ERROR);
      }

      const updatedFeedback = await prisma.feedback.update({
        where: { id: feedbackId },
        data: {
          status: FeedbackStatus.PENDING,
          resolvedAt: null,
        },
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          order: true,
          serviceOrder: true,
          giverRole: true,
          receiverRole: true,
          agentProfile: true,
          vendor: true,
          customerProfile: true,
        },
      });

      // Create notification for reopening
      const eventTypeId = await this.ensureEventType('FEEDBACK_REOPENED');
      await prisma.notificationLog.create({
        data: {
          id: uuidv4(),
          userId: feedback.giverId,
          type: 'FEEDBACK_REOPENED',
          eventTypeId,
          payload: JSON.stringify({ feedbackId, ticketId: feedback.ticketId }),
          status: 'PENDING',
          channel: 'EMAIL',
          recipient: feedback.giver.email,
          message: `Your feedback ticket ${feedback.ticketId} has been reopened`,
        },
      });

      logger.info(`Reopened feedback ticket: ${feedback.ticketId}`, { feedbackId });

      return updatedFeedback;
    } catch (error: any) {
      logger.error(`Error reopening feedback`, { error: error.message, feedbackId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal(`Failed to reopen feedback: ${error.message}`, ErrorCodes.INTERNAL_ERROR, { error: error.message });
    }
  }

  /**
   * Retrieves a single feedback ticket by ID
   * @param feedbackId - The ID of the feedback ticket
   * @returns The feedback object
   * @throws ApiError for validation, resource, or internal errors
   */
  async getFeedbackById(feedbackId: string): Promise<FeedbackResponse> {
    try {
      if (!feedbackId) {
        throw ApiError.badRequest('Feedback ID is required', ErrorCodes.MISSING_FIELDS);
      }

      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        include: {
          giver: { select: { firstName: true, lastName: true, email: true } },
          receiver: { select: { firstName: true, lastName: true, email: true } },
          order: true,
          serviceOrder: true,
          giverRole: true,
          receiverRole: true,
          agentProfile: true,
          vendor: true,
          customerProfile: true,
        },
      });

      if (!feedback) {
        throw ApiError.notFound('Feedback not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      logger.info(`Retrieved feedback ticket: ${feedback.ticketId}`, { feedbackId });

      return feedback;
    } catch (error: any) {
      logger.error(`Error retrieving feedback`, { error: error.message, feedbackId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.notFound(`Failed to retrieve feedback: ${error.message}`, ErrorCodes.RESOURCE_NOT_FOUND, { error: error.message });
    }
  }

  /**
   * Calculates the average resolution time for feedback tickets
   * @param feedbacks - Array of feedback objects
   * @returns Formatted average resolution time
   */
  private async calculateAvgResolutionTime(feedbacks: FeedbackResponse[]): Promise<string> {
    try {
      const resolved = feedbacks.filter(f => f.status === FeedbackStatus.RESOLVED && f.resolvedAt);
      if (!resolved.length) return 'N/A';

      const totalTime = resolved.reduce((sum, f) => {
        const created = new Date(f.createdAt).getTime();
        const resolved = new Date(f.resolvedAt!).getTime();
        return sum + (resolved - created);
      }, 0);

      const avgMs = totalTime / resolved.length;
      const days = Math.floor(avgMs / (1000 * 60 * 60 * 24));
      return days ? `${days} days` : 'Less than a day';
    } catch (error: any) {
      logger.error(`Error calculating average resolution time`, { error: error.message });
      return 'N/A';
    }
  }
}