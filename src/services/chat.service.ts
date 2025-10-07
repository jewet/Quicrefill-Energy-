// src/chat/chat.service.ts
import { PrismaClient as MongoPrismaClient } from '../../node_modules/.prisma/mongodb-client';
import { PrismaClient as PostgresPrismaClient } from '../../node_modules/.prisma/client';
import axios from 'axios';
import { ApiError} from '../errors/ApiError';
import { ErrorCodes } from '../errors/errorCodes';

import { logger } from '../utils/logger';
import { getRedisClient } from '../config/redis';
import {
  CreateChatRoomInput,
  SendMessageInput,
  SubmitReportInput,
  EndChatInput,
  OrderType,
  ChatRoomStatus,
  ChatMessageType,
  ChatReportStatus,
} from '../types/chat.types';

const mongoPrisma = new MongoPrismaClient();
const postgresPrisma = new PostgresPrismaClient();

export class ChatService {
  private rocketChatHost: string;
  private rocketChatUserId: string | null = null;
  private rocketChatAuthToken: string | null = null;

  constructor() {
    this.rocketChatHost = process.env.ROCKETCHAT_HOST || 'http://localhost:3000';
  }

  async initializeRocketChat() {
    if (this.rocketChatUserId && this.rocketChatAuthToken) {
      return;
    }

    try {
      const response = await axios.post(`${this.rocketChatHost}/api/v1/login`, {
        username: process.env.ROCKETCHAT_ADMIN_USERNAME || 'admin',
        password: process.env.ROCKETCHAT_ADMIN_PASSWORD || 'password',
      });
      this.rocketChatUserId = response.data.data.userId;
      this.rocketChatAuthToken = response.data.data.authToken;
      logger.info('RocketChat initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RocketChat', { error });
      throw ApiError.internal('Failed to connect to RocketChat', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async initializeChatRoom(input: CreateChatRoomInput): Promise<string> {
    const { orderId, orderType, userId, agentId, vendorId } = input;

    try {
      await this.initializeRocketChat();

      // Validate order existence
      if (orderType === OrderType.PRODUCT) {
        const order = await postgresPrisma.productOrder.findUnique({
          where: { id: orderId },
        });
        if (!order || order.orderStatus !== 'PROCESSING') {
          throw ApiError.notFound('Product order not found or not in progress', ErrorCodes.ORDER_NOT_FOUND);
        }
      } else if (orderType === OrderType.SERVICE) {
        const order = await postgresPrisma.serviceOrder.findUnique({
          where: { id: orderId },
        });
        if (!order || order.status !== 'PROCESSING') {
          throw ApiError.notFound('Service order not found or not in progress', ErrorCodes.ORDER_NOT_FOUND);
        }
      }

      // Check if user and agent exist
      const user = await postgresPrisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw ApiError.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
      }

      if (agentId) {
        const agent = await postgresPrisma.user.findUnique({ where: { id: agentId } });
        if (!agent) {
          throw ApiError.notFound('Agent not found', ErrorCodes.USER_NOT_FOUND);
        }
      }

      // Create RocketChat room
      const response = await axios.post(
        `${this.rocketChatHost}/api/v1/channels.create`,
        {
          name: `chat_${orderId}_${Date.now()}`,
          members: [userId, agentId].filter(Boolean),
        },
        {
          headers: {
            'X-Auth-Token': this.rocketChatAuthToken!,
            'X-User-Id': this.rocketChatUserId!,
          },
        }
      );
      const rocketChatRoomId = response.data.channel._id;
      if (!rocketChatRoomId) {
        throw ApiError.internal('Failed to create RocketChat room', ErrorCodes.INTERNAL_SERVER_ERROR);
      }

      // Create chat room in MongoDB
      const chatRoom = await mongoPrisma.chatRoom.create({
        data: {
          orderId,
          orderType,
          userId,
          agentId,
          vendorId,
          status: ChatRoomStatus.ACTIVE,
          rocketChatRoomId,
        },
      });

      // Cache chat room ID
      const redis = await getRedisClient();
      await redis.set(`chat:room:${orderId}:${orderType}`, chatRoom.id, { EX: 3600 });

      logger.info('Chat room initialized', { chatRoomId: chatRoom.id, orderId, orderType });
      return chatRoom.id;
    } catch (error) {
      logger.error('Failed to initialize chat room', { error, input });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to initialize chat room', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async sendMessage(input: SendMessageInput): Promise<void> {
    const { roomId, senderId, content, type } = input;

    try {
      await this.initializeRocketChat();

      const chatRoom = await mongoPrisma.chatRoom.findUnique({
        where: { id: roomId },
      });
      if (!chatRoom || chatRoom.status !== ChatRoomStatus.ACTIVE) {
        throw ApiError.notFound('Chat room not found or inactive', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const sender = await postgresPrisma.user.findUnique({ where: { id: senderId } });
      if (!sender) {
        throw ApiError.notFound('Sender not found', ErrorCodes.USER_NOT_FOUND);
      }

      // Send message to RocketChat
      await axios.post(
        `${this.rocketChatHost}/api/v1/chat.postMessage`,
        {
          roomId: chatRoom.rocketChatRoomId,
          text: type === ChatMessageType.TEXT ? content : undefined,
          attachments: type !== ChatMessageType.TEXT ? [{ type: type.toLowerCase(), title: 'Attachment', title_link: content }] : undefined,
        },
        {
          headers: {
            'X-Auth-Token': this.rocketChatAuthToken!,
            'X-User-Id': this.rocketChatUserId!,
          },
        }
      );

      // Store message in MongoDB
      await mongoPrisma.chatMessage.create({
        data: {
          roomId,
          senderId,
          content,
          type,
        },
      });

      logger.info('Message sent', { roomId, senderId, type });
    } catch (error) {
      logger.error('Failed to send message', { error, input });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to send message', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async submitReport(input: SubmitReportInput, evidenceUrl?: string): Promise<void> {
    const { roomId, reporterId, reasons, details } = input;

    try {
      const chatRoom = await mongoPrisma.chatRoom.findUnique({
        where: { id: roomId },
      });
      if (!chatRoom) {
        throw ApiError.notFound('Chat room not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const reporter = await postgresPrisma.user.findUnique({ where: { id: reporterId } });
      if (!reporter) {
        throw ApiError.notFound('Reporter not found', ErrorCodes.USER_NOT_FOUND);
      }

      if (reasons.includes('Other') && !details) {
        throw ApiError.badRequest('Details required for "Other" reason', ErrorCodes.VALIDATION_ERROR);
      }

      // Update chat room status to REPORTED
      await mongoPrisma.chatRoom.update({
        where: { id: roomId },
        data: { status: ChatRoomStatus.REPORTED },
      });

      // Store report in MongoDB
      await mongoPrisma.chatReport.create({
        data: {
          roomId,
          reporterId,
          reasons,
          details,
          evidenceUrl,
          status: ChatReportStatus.PENDING,
        },
      });

      // Log report in PostgreSQL for audit
      await postgresPrisma.report.create({
        data: {
          reporterId,
          category: 'CHAT_REPORT',
          details: JSON.stringify({ reasons, details, evidenceUrl }),
          status: 'PENDING',
          serviceOrderId: chatRoom.orderType === OrderType.SERVICE ? chatRoom.orderId : undefined,
          productOrderId: chatRoom.orderType === OrderType.PRODUCT ? chatRoom.orderId : undefined,
        },
      });

      logger.info('Chat report submitted', { roomId, reporterId, evidenceUrl });
    } catch (error) {
      logger.error('Failed to submit chat report', { error, input });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to submit chat report', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async endChat(input: EndChatInput): Promise<void> {
    const { roomId, userId } = input;

    try {
      await this.initializeRocketChat();

      const chatRoom = await mongoPrisma.chatRoom.findUnique({
        where: { id: roomId },
      });
      if (!chatRoom) {
        throw ApiError.notFound('Chat room not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Verify order completion
      if (chatRoom.orderType === OrderType.PRODUCT) {
        const order = await postgresPrisma.productOrder.findUnique({
          where: { id: chatRoom.orderId! },
        });
        if (order?.orderStatus !== 'DELIVERED') {
          throw ApiError.badRequest('Product order not completed', ErrorCodes.INVALID_ORDER_STATUS);
        }
      } else if (chatRoom.orderType === OrderType.SERVICE) {
        const order = await postgresPrisma.serviceOrder.findUnique({
          where: { id: chatRoom.orderId! },
        });
        if (order?.status !== 'DELIVERED') {
          throw ApiError.badRequest('Service order not completed', ErrorCodes.INVALID_ORDER_STATUS);
        }
      }

      // Close RocketChat room
      await axios.post(
        `${this.rocketChatHost}/api/v1/channels.close`,
        { roomId: chatRoom.rocketChatRoomId },
        {
          headers: {
            'X-Auth-Token': this.rocketChatAuthToken!,
            'X-User-Id': this.rocketChatUserId!,
          },
        }
      );

      // Update chat room status
      await mongoPrisma.chatRoom.update({
        where: { id: roomId },
        data: {
          status: ChatRoomStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      // Invalidate cache
      const redis = await getRedisClient();
      await redis.del(`chat:room:${chatRoom.orderId}:${chatRoom.orderType}`);

      logger.info('Chat room closed', { roomId, userId });
    } catch (error) {
      logger.error('Failed to end chat', { error, input });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to end chat', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getChatRoom(orderId: string, orderType: string): Promise<any> {
    try {
      const redis = await getRedisClient();
      const cachedRoomId = await redis.get(`chat:room:${orderId}:${orderType}`);
      if (cachedRoomId) {
        const room = await mongoPrisma.chatRoom.findUnique({
          where: { id: cachedRoomId },
          include: { messages: true },
        });
        if (room) {
          logger.debug('Cache hit for chat room', { orderId, orderType });
          return room;
        }
      }

      const room = await mongoPrisma.chatRoom.findFirst({
        where: { orderId, orderType },
        include: { messages: true },
      });
      if (!room) {
        throw ApiError.notFound('Chat room not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      await redis.set(`chat:room:${orderId}:${orderType}`, room.id, { EX: 3600 });
      return room;
    } catch (error) {
      logger.error('Failed to get chat room', { error, orderId, orderType });
      throw error instanceof ApiError ? error : ApiError.internal('Failed to get chat room', ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  }
}