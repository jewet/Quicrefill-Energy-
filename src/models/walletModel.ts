import { Decimal } from "@prisma/client/runtime/library";

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  DEDUCTION = "DEDUCTION",
  REFUND = "REFUND",
}

export enum TransactionStatus {
  FAILED = "FAILED",
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
}

export interface Wallet {
  id: string;
  userId: string;
  balance: Decimal;  // Fixed from number to Decimal
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: number;
  userId: string;
  transactionType: TransactionType;
  amount: Decimal;
  status: TransactionStatus;
  dieselOrderId?: string | null;
  petrolOrderId?: string | null;
  gasOrderId?: string | null;
  electricityOrderId?: string | null;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  electricityProviderId?: number;
  paymentId?: string;
}

export interface Voucher {
  id: number;
  code: string;
  discount: Decimal;
  type: "PERCENTAGE" | "FIXED";
  maxUses: number | null;
  uses: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  appliesTo: "DELIVERY";
  createdById: string;
  updatedAt: Date;
}

export interface DeliveryRepProfile {
  id: string;
  userId: string;
  accountBalance: bigint;  // Adjust to Decimal if needed
  avgRating: number;
  credentialsVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}