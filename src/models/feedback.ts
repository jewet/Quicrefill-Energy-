import { TransactionStatus, OrderStatus, FeedbackStatus, IssueType } from '@prisma/client';

export interface FeedbackCreateInput {
  receiverId: string;
  orderId?: string;
  serviceOrderId?: string;
  comment?: string;
  rating: number;
  priority?: string;
  issueType?: IssueType;
}

export interface FeedbackUpdateInput {
  comment?: string;
  rating?: number;
  status?: FeedbackStatus;
  priority?: string;
  issueType?: IssueType;
  adminResponse?: string;
}

export interface FeedbackFilter {
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

export interface Feedback {
  id: string;
  ticketId: string;
  giver: { firstName: string; lastName: string; email: string };
  receiver: { firstName: string; lastName: string; email: string };
  comment?: string | null;
  rating: number;
  status: FeedbackStatus;
  priority?: string;
  issueType?: IssueType;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  order?: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    notes: string | null;
    userId: string;
    serviceId: string | null;
    vendorId: string | null;
    deliveryAddressId: string;
    agentId: string | null;
    subtotal: number; // Changed from Decimal to number
    deliveryFee: number; // Changed from Decimal to number
    serviceCharge: number; // Changed from Decimal to number
    vatAmount: number; // Changed from Decimal to number
    total: number; // Changed from Decimal to number
    confirmationCode: string;
    paymentMethod: string;
    paymentStatus: TransactionStatus;
    orderStatus: OrderStatus;
    voucherId: number | null;
    [key: string]: any;
  } | null;
  serviceOrder?: {
    id: string;
    [key: string]: any;
  } | null;
  giverRole: { id: string; name: string };
  receiverRole: { id: string; name: string };
  agentProfile?: any;
  vendor?: any;
  customerProfile?: any;
}