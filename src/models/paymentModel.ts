import { PrismaClient, PaymentMethod, TransactionStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

/**
 * Creates a payment record in the database.
 * @param userId - The ID of the user initiating the payment.
 * @param amount - The total amount for the payment.
 * @param paymentMethod - The payment method used (e.g., CARD, TRANSFER, etc.).
 * @param status - The transaction status (e.g., PENDING, COMPLETED, etc.).
 * @param transactionRef - The unique transaction reference.
 * @param productType - The type of product (optional).
 * @param serviceType - The type of service (optional).
 * @param providerId - The ID of the payment provider (optional).
 * @param meterNumber - The meter number for electricity payments (optional).
 * @param requestedAmount - The base amount before additional charges (optional).
 * @returns The created payment record.
 */
export async function createPaymentRecord(
  userId: string,
  amount: number,
  paymentMethod: PaymentMethod,
  status: TransactionStatus,
  transactionRef: string,
  productType?: string,
  serviceType?: string,
  providerId?: number,
  meterNumber?: string,
  requestedAmount?: number
) {
  try {
    // Validate inputs
    if (!userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      throw new Error("Invalid user ID: must be a valid UUID");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Invalid amount: must be a positive number");
    }
    if (!transactionRef) {
      throw new Error("Transaction reference is required");
    }

    // Create the payment record
    const payment = await prisma.payment.create({
      data: {
        id: uuidv4(),
        userId,
        amount,
        paymentMethod,
        status,
        transactionRef,
        productType: productType || null,
        serviceType: serviceType || null,
        providerId: providerId || null,
        meterNumber: meterNumber || null,
        requestedAmount: requestedAmount || amount,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return payment;
  } catch (error: any) {
    console.error("Error creating payment record:", error.message);
    throw new Error(`Failed to create payment record: ${error.message}`);
  }
}