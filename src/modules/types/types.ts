import { Prisma, TransactionType, TransactionStatus } from "@prisma/client";

export interface WalletTransactionMetadata {
  isWalletTopUp?: boolean;
  paymentLink?: string | null;
  serviceType?: string | null;
  productType?: string | null;
  webhookStatus?: string;
  serviceFee?: number;
  vat?: number;
  petroleumTax?: number;
  voucherCode?: string;
  voucherDiscount?: number;
  isPartial?: boolean;
  originalTransactionId?: string;
  purpose?: string;
  virtualAccountId?: string;
  vendorId?: string | null | undefined; // Updated to allow null
  adminMerchantAccount?: string;
  refundReference?: string;
  monnifyRef?: string;
  [key: string]: any;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  walletId: string;
  amount: Prisma.Decimal;
  transactionType: TransactionType | null;
  status: TransactionStatus;
  paymentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: WalletTransactionMetadata | null;
  serviceOrderId?: string | null;
  electricityProviderId?: number | null;
}