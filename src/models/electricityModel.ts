import { PaymentMethod, TransactionStatus } from '@prisma/client';

export interface MeterInfo {
  customerName: string;
  address: string;
  tariffPlan?: string;
}

export interface ElectricityOrder {
  id: string;
  userId: string | null;
  billerCode: string | null;
  itemCode: string | null;
  meterNumber: string | null;
  meterType: string | null;
  paymentAmount: number;
  paymentMethod: PaymentMethod | null;
  token: string | null;
  status: TransactionStatus;
  serviceFee: number | null;
  flutterwaveFee: number | null;
  vat: number | null;
  transactionRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  paymentJwt?: string;
}