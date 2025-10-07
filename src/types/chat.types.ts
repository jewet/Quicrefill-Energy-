// src/chat/chat.types.ts
import { z } from 'zod';

export const OrderType = {
  PRODUCT: 'PRODUCT',
  SERVICE: 'SERVICE',
} as const;

export const ChatRoomStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  REPORTED: 'REPORTED',
} as const;

export const ChatMessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
} as const;

export const ChatReportStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;

export const CreateChatRoomSchema = z.object({
  orderId: z.string().uuid(),
  orderType: z.enum([OrderType.PRODUCT, OrderType.SERVICE]),
  userId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
});

export const SendMessageSchema = z.object({
  roomId: z.string(),
  senderId: z.string().uuid(),
  content: z.string().min(1),
  type: z.enum([ChatMessageType.TEXT, ChatMessageType.IMAGE, ChatMessageType.FILE]),
});

export const SubmitReportSchema = z.object({
  roomId: z.string(),
  reporterId: z.string().uuid(),
  reasons: z.array(z.string()).min(1),
  details: z.string().optional(),
});

export const EndChatSchema = z.object({
  roomId: z.string(),
  userId: z.string().uuid(),
});

export type CreateChatRoomInput = z.infer<typeof CreateChatRoomSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type SubmitReportInput = z.infer<typeof SubmitReportSchema>;
export type EndChatInput = z.infer<typeof EndChatSchema>;