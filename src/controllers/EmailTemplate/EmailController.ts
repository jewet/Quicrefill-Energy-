import { Request, Response } from 'express';
import { emailTemplateService } from '../../services/email';
import { BulkEmailRequest, EmailTemplateRequest } from '../../models/emailModel';
import { HttpResponse } from '../../utils/http.util';

import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console(),
  ],
});

export class EmailController {
  static async createTemplate(req: Request, res: Response): Promise<void> {
    const data: EmailTemplateRequest = req.body;
    if (!data.name || !data.subject || !data.htmlContent) {
      HttpResponse.error(res, 'Name, subject, and htmlContent are required', 400);
      return;
    }

    try {
      const updatedBy = req.user?.id;
      if (!updatedBy) {
        HttpResponse.error(res, 'Unauthorized: User not found', 401);
        return;
      }
      const template = await emailTemplateService.createTemplate(data, updatedBy);
      HttpResponse.success(res, template, 'Email template created', 201);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('createTemplate Controller Error', { error: errorMessage });
      HttpResponse.error(res, errorMessage, 400);
    }
  }

  static async updateTemplate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data: Partial<EmailTemplateRequest> = req.body;

    try {
      const updatedBy = req.user?.id;
      if (!updatedBy) {
        HttpResponse.error(res, 'Unauthorized: User not found', 401);
        return;
      }
      const template = await emailTemplateService.updateTemplate(id, data, updatedBy);
      HttpResponse.success(res, template, 'Email template updated');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('updateTemplate Controller Error', { id, error: errorMessage });
      HttpResponse.error(res, errorMessage, 400);
    }
  }

  static async deleteTemplate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const deletedBy = req.user?.id;
      if (!deletedBy) {
        HttpResponse.error(res, 'Unauthorized: User not found', 401);
        return;
      }
      await emailTemplateService.deleteTemplate(id, deletedBy);
      HttpResponse.success(res, null, 'Email template deleted');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('deleteTemplate Controller Error', { id, error: errorMessage });
      HttpResponse.error(res, errorMessage, 400);
    }
  }

  static async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await emailTemplateService.getTemplates();
      HttpResponse.success(res, templates);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('getTemplates Controller Error', { error: errorMessage });
      HttpResponse.error(res, errorMessage, 500);
    }
  }

  static async getTemplateById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const template = await emailTemplateService.getById(id);
      if (!template) {
        HttpResponse.error(res, 'Email template not found', 404);
        return;
      }
      HttpResponse.success(res, template);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('getTemplateById Controller Error', { id, error: errorMessage });
      HttpResponse.error(res, errorMessage, 500);
    }
  }

  static async sendEmail(req: Request, res: Response): Promise<void> {
    const data: BulkEmailRequest = req.body;

    try {
      await emailTemplateService.sendEmail(data);
      HttpResponse.success(res, null, 'Email(s) sent successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('sendEmail Controller Error', { error: errorMessage });
      HttpResponse.error(res, errorMessage, 400);
    }
  }
}

export const emailController = new EmailController();