import { Request, Response } from 'express';
import { PrismaClient, FeedbackStatus, IssueType } from '@prisma/client';
import { FeedbackService } from '../../services/feedbackService';
import { HttpResponse } from '../../utils/http';
import { FeedbackCreateInput, FeedbackUpdateInput, FeedbackFilter } from '../../models/feedback';

const prisma = new PrismaClient();
const feedbackService = new FeedbackService();

export class FeedbackController {
  /**
   * Creates a new feedback ticket
   * @param req - Express request object
   * @param res - Express response object
   */
  async createFeedback(req: Request, res: Response) {
    try {
      const user = req.user!;
      // Fetch roleId from the role name stored in user.role
      const role = await prisma.role.findUnique({ where: { name: user.role } });
      if (!role) {
        throw new Error('Role not found for the user');
      }
      const input: FeedbackCreateInput = req.body;
      const feedback = await feedbackService.createFeedback(user.id, role.id, input);
      HttpResponse.success(res, 'Feedback submitted successfully', feedback);
    } catch (error: any) {
      HttpResponse.error(res, error.message || 'An error occurred', error.statusCode || 500, error.details);
    }
  }

  /**
   * Retrieves feedback tickets with filtering, pagination, and KPIs for admin dashboard
   * @param req - Express request object
   * @param res - Express response object
   */
  async getFeedbacks(req: Request, res: Response) {
    try {
      const issueType = req.query.issueType as string | undefined;
      // Validate issueType against IssueType enum
      const validIssueType: IssueType | undefined = issueType && Object.values(IssueType).includes(issueType as IssueType)
        ? issueType as IssueType
        : undefined;

      const filter: FeedbackFilter = {
        status: req.query.status as FeedbackStatus | undefined,
        issueType: validIssueType,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        search: req.query.search as string | undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      };
      const feedbacks = await feedbackService.getFeedbacksForAdmin(filter);
      HttpResponse.success(res, 'Feedbacks retrieved successfully', feedbacks);
    } catch (error: any) {
      HttpResponse.error(res, error.message || 'An error occurred', error.statusCode || 500, error.details);
    }
  }

  /**
   * Updates a feedback ticket
   * @param req - Express request object
   * @param res - Express response object
   */
  async updateFeedback(req: Request, res: Response) {
    try {
      const feedbackId = req.params.id;
      const input: FeedbackUpdateInput = req.body;
      const feedback = await feedbackService.updateFeedback(feedbackId, input);
      HttpResponse.success(res, 'Feedback updated successfully', feedback);
    } catch (error: any) {
      HttpResponse.error(res, error.message || 'An error occurred', error.statusCode || 500, error.details);
    }
  }

  /**
   * Reopens a resolved feedback ticket
   * @param req - Express request object
   * @param res - Express response object
   */
  async reopenFeedback(req: Request, res: Response) {
    try {
      const feedbackId = req.params.id;
      const feedback = await feedbackService.reopenFeedback(feedbackId);
      HttpResponse.success(res, 'Feedback reopened successfully', feedback);
    } catch (error: any) {
      HttpResponse.error(res, error.message || 'An error occurred', error.statusCode || 500, error.details);
    }
  }

  /**
   * Retrieves a single feedback ticket by ID
   * @param req - Express request object
   * @param res - Express response object
   */
  async getFeedbackById(req: Request, res: Response) {
    try {
      const feedbackId = req.params.id;
      const feedback = await feedbackService.getFeedbackById(feedbackId);
      HttpResponse.success(res, 'Feedback retrieved successfully', feedback);
    } catch (error: any) {
      HttpResponse.error(res, error.message || 'An error occurred', error.statusCode || 500, error.details);
    }
  }

  /**
   * Updates the average rating for a receiver
   * @param req - Express request object
   * @param res - Express response object
   */
  async updateReceiverRating(req: Request, res: Response) {
    try {
      const { userId, roleId } = req.body;
      await feedbackService.updateReceiverRating(userId, roleId);
      HttpResponse.success(res, 'Receiver rating updated successfully', null);
    } catch (error: any) {
      HttpResponse.error(res, error.message || 'An error occurred', error.statusCode || 500, error.details);
    }
  }
}