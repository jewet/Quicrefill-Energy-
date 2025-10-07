// email-service/src/controllers/emailController.ts
import { Request, Response } from "express";
import {emailTemplateService } from "../../services/email"; // Adjusted path
import { EmailTemplateRequest, BulkEmailRequest } from "../../models/emailModel";

export class EmailController {
  async createTemplate(req: Request, res: Response): Promise<void> {
    const data: EmailTemplateRequest = req.body;
    if (!data.name || !data.subject || !data.htmlContent) {
      res.status(400).json({ success: false, message: "Name, subject, and htmlContent are required" });
      return;
    }

    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }
      const template = await emailTemplateService.createTemplate(data, req.user.id);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data: Partial<EmailTemplateRequest> = req.body;

    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }
      const template = await emailTemplateService.updateTemplate(id, data, req.user.id);
      res.status(200).json({ success: true, data: template });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        return;
      }
      await emailTemplateService.deleteTemplate(id, req.user.id);
      res.status(200).json({ success: true, message: "Template deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await emailTemplateService.getTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }

  async sendEmail(req: Request, res: Response): Promise<void> {
    const data: BulkEmailRequest = req.body;

    try {
      await emailTemplateService.sendEmail(data);
      res.status(200).json({ success: true, message: "Email(s) sent successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  }
}

export const emailController = new EmailController();