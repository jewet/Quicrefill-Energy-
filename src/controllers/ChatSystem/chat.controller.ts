// src/chat/chat.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../../services/chat.service';
import { CreateChatRoomSchema, SendMessageSchema, SubmitReportSchema, EndChatSchema } from '../../types/chat.types';
import { ApiError } from '../../errors/ApiError';
import { ErrorCodes } from '../../errors/errorCodes';
import { logger } from '../../utils/logger';

export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  async initializeChatRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateChatRoomSchema.parse(req.body);
      const chatRoomId = await this.chatService.initializeChatRoom(input);
      res.status(201).json({
        success: true,
        data: { chatRoomId },
        message: 'Chat room initialized successfully',
      });
    } catch (error) {
      logger.error('Error in initializeChatRoom', { error, body: req.body });
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = SendMessageSchema.parse(req.body);
      await this.chatService.sendMessage(input);
      res.status(200).json({
        success: true,
        message: 'Message sent successfully',
      });
    } catch (error) {
      logger.error('Error in sendMessage', { error, body: req.body });
      next(error);
    }
  }

  async submitReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Parse form-data fields
      const input = SubmitReportSchema.parse({
        roomId: req.body.roomId,
        reporterId: req.body.reporterId,
        reasons: typeof req.body.reasons === 'string' ? JSON.parse(req.body.reasons) : req.body.reasons,
        details: req.body.details,
      });
      // Expect evidenceUrl from API gateway
      const evidenceUrl = req.body.evidenceUrl;
      await this.chatService.submitReport(input, evidenceUrl);
      res.status(200).json({
        success: true,
        message: 'Report submitted successfully',
      });
    } catch (error) {
      logger.error('Error in submitReport', { error, body: req.body });
      next(error);
    }
  }

  async endChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = EndChatSchema.parse(req.body);
      await this.chatService.endChat(input);
      res.status(200).json({
        success: true,
        message: 'Chat room closed successfully',
      });
    } catch (error) {
      logger.error('Error in endChat', { error, body: req.body });
      next(error);
    }
  }

  async getChatRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, orderType } = req.params;
      if (!orderId || !['PRODUCT', 'SERVICE'].includes(orderType)) {
        throw ApiError.badRequest('Invalid orderId or orderType', ErrorCodes.BAD_REQUEST);
      }
      const chatRoom = await this.chatService.getChatRoom(orderId, orderType);
      res.status(200).json({
        success: true,
        data: chatRoom,
      });
    } catch (error) {
      logger.error('Error in getChatRoom', { error, params: req.params });
      next(error);
    }
  }
}