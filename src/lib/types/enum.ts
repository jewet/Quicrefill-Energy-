// src/types/enums.ts

/**
 * Order status enum
 */
export enum OrderStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    RIDER_ASSIGNED = 'RIDER_ASSIGNED',
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED'
  }
  
  /**
   * Transaction status enum
   */
  export enum TransactionStatus {
    FAILED = 'FAILED',
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED'
  }
  
  /**
   * Product status enum
   */
  export enum ProductStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED'
  }
  
  /**
   * Document status enum
   */
  export enum DocumentStatus {
    VERIFIED = 'VERIFIED',
    NOT_VERIFIED = 'NOT_VERIFIED',
    PENDING = 'PENDING'
  }
  
  /**
   * Transaction type enum
   */
  export enum TransactionType {
    DEPOSIT = 'DEPOSIT',
    DEDUCTION = 'DEDUCTION',
    REFUND = 'REFUND'
  }
