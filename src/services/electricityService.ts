import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, PaymentMethod, TransactionStatus, ServiceOrder, AdminSettings, Prisma } from '@prisma/client';
import walletService from './walletService';
import paymentService from './paymentService';
import axios from 'axios';
import {
  generateTransactionReference,
  generateJWT,
  isPrepaidElectricity,
  validateMeterNumber,
  validatePaymentAmount,
  verifyJWT,
  calculateTotalAmount,
  calculateMerchantDeduction,
} from '../utils/electricityUtils';
import { ElectricityOrder, MeterInfo } from '../models/electricityModel';

// Initialize Prisma client
const prisma = new PrismaClient();

// Define custom error class for service-specific errors
class ElectricityServiceError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ElectricityServiceError';
  }
}

// Utility function to check if payment method is valid
const isValidPaymentMethod = (method: string): method is PaymentMethod => {
  return Object.values(PaymentMethod).includes(method as PaymentMethod);
};

// Interfaces for Flutterwave responses
interface FlutterwaveValidationResponse {
  status: string;
  message: string;
  data: {
    name: string;
    address: string;
    response_code: string;
    response_message: string;
    biller_code: string;
    customer: string;
    product_code: string;
    email: string | null;
    fee: number;
    maximum: number;
    minimum: number;
  };
}

interface FlutterwaveBillPaymentResponse {
  status: string;
  message: string;
  data: {
    reference: string;
    amount: number;
    extra?: string;
  };
}

interface FlutterwaveBillStatusResponse {
  status: string;
  message: string;
  data: {
    extra?: string;
    reference: string;
    amount: number;
  };
}

interface FlutterwaveBiller {
  id: number;
  biller_name: string;
  description: string;
  country: string;
  item_codes: { label_name: string; identifier: string }[];
  logo: string;
}

interface FlutterwaveBillersResponse {
  status: string;
  message: string;
  data: FlutterwaveBiller[];
}

/**
 * Utility function to check if an error is an Axios error
 */
function isAxiosError(error: unknown): error is { response?: any; request?: any; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('response' in error || 'request' in error || 'config' in error) &&
    typeof (error as any).message === 'string'
  );
}

export class ElectricityService {
  /**
   * Fetches electricity billers from Flutterwave dynamically
   */
  async getElectricityBillers(location?: string): Promise<FlutterwaveBiller[]> {
    try {
      console.log(`Fetching electricity billers${location ? ` for location: ${location}` : ''}`);
      const response = await axios.get<FlutterwaveBillersResponse>(
        'https://api.flutterwave.com/v3/billers?country=NG&category=ELECTRICITY',
        {
          headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
        }
      );

      if (response.data.status !== 'success') {
        console.error('Failed to fetch billers:', response.data);
        throw new ElectricityServiceError(`Failed to fetch billers: ${response.data.message}`, 'BILLERS_FETCH_FAILED');
      }

      let billers = response.data.data;
      if (location) {
        billers = billers.filter(
          (biller) =>
            biller.biller_name.toLowerCase().includes(location.toLowerCase()) ||
            biller.description.toLowerCase().includes(location.toLowerCase())
        );
      }

      console.log(`Fetched ${billers.length} electricity billers`);
      return billers;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error('Error fetching billers:', error.message, error.response?.data || 'No response data');
        throw new ElectricityServiceError(
          `Failed to fetch electricity billers: ${error.response?.data?.message || error.message}`,
          'BILLERS_FETCH_AXIOS_ERROR'
        );
      }
      console.error('Unexpected error fetching billers:', error);
      throw new ElectricityServiceError('Failed to fetch electricity billers', 'BILLERS_FETCH_UNEXPECTED_ERROR');
    }
  }

  /**
   * Fetches the service charge from AdminSettings or falls back to default
   */
  private async getServiceCharge(): Promise<number> {
    try {
      const adminSettings: AdminSettings | null = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultServiceCharge === null) {
        console.warn('No AdminSettings found or defaultServiceCharge not set. Falling back to default: 500');
        return 500;
      }
      return adminSettings.defaultServiceCharge;
    } catch (error: any) {
      console.error('Error fetching service charge from AdminSettings:', error.message);
      throw new ElectricityServiceError('Failed to fetch service charge', 'SERVICE_CHARGE_FETCH_ERROR');
    }
  }

  /**
   * Fetches the Flutterwave fee for a biller item
   */
  private async getFlutterwaveFee(billerCode: string, itemCode: string): Promise<number> {
    try {
      console.log(`Fetching Flutterwave fee for billerCode ${billerCode}, itemCode ${itemCode}`);
      const response = await axios.get<{ status: string; message: string; data: { item_code: string; fee: number }[] }>(
        `https://api.flutterwave.com/v3/billers/${billerCode}/items`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );

      if (response.data.status !== 'success') {
        console.error('Failed to fetch biller items:', response.data);
        throw new ElectricityServiceError(
          `Failed to fetch biller items: ${response.data.message}`,
          'BILLER_ITEMS_FETCH_FAILED'
        );
      }

      const item = response.data.data.find((i) => i.item_code === itemCode);
      if (!item) {
        console.error(`Item code ${itemCode} not found for billerCode ${billerCode}`);
        throw new ElectricityServiceError(`Item code ${itemCode} not found for biller`, 'ITEM_CODE_NOT_FOUND');
      }

      console.log(`Flutterwave fee for ${itemCode}: ${item.fee}`);
      return item.fee;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error('Error fetching Flutterwave fee:', error.message, error.response?.data || 'No response data');
        throw new ElectricityServiceError(
          `Failed to fetch Flutterwave fee: ${error.response?.data?.message || error.message}`,
          'FLUTTERWAVE_FEE_FETCH_AXIOS_ERROR'
        );
      }
      console.error('Unexpected error fetching Flutterwave fee:', error);
      throw new ElectricityServiceError('Failed to fetch Flutterwave fee', 'FLUTTERWAVE_FEE_FETCH_UNEXPECTED_ERROR');
    }
  }

  /**
   * Fetches the VAT rate from AdminSettings or falls back to default
   */
  private async getVatRate(): Promise<number> {
    try {
      const adminSettings: AdminSettings | null = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultVatRate === null) {
        console.warn('No AdminSettings found or defaultVatRate not set. Falling back to default: 0.075 (7.5%)');
        return 0.075;
      }
      return adminSettings.defaultVatRate;
    } catch (error: any) {
      console.error('Error fetching VAT rate from AdminSettings:', error.message);
      throw new ElectricityServiceError('Failed to fetch VAT rate', 'VAT_RATE_FETCH_ERROR');
    }
  }

  /**
   * Validates a meter number using Flutterwave API
   */
  async validateMeterNumberWithFlutterwave(
    billerCode: string,
    itemCode: string,
    meterNumber: string
  ): Promise<MeterInfo> {
    if (!billerCode) {
      console.error('[validateMeterNumberWithFlutterwave] Biller code is null or undefined');
      throw new ElectricityServiceError('Biller code is required', 'BILLER_CODE_NOT_FOUND');
    }
    if (!itemCode) {
      console.error('[validateMeterNumberWithFlutterwave] Item code is null or undefined');
      throw new ElectricityServiceError('Item code is required', 'ITEM_CODE_NOT_FOUND');
    }
    if (!validateMeterNumber(meterNumber)) {
      console.error('[validateMeterNumberWithFlutterwave] Invalid meter number format:', meterNumber);
      throw new ElectricityServiceError('Invalid meter number format. Must be 10 to 13 digits.', 'INVALID_METER_NUMBER');
    }

    try {
      console.log(
        `[validateMeterNumberWithFlutterwave] Validating meter ${meterNumber} with billerCode ${billerCode} and itemCode ${itemCode}`
      );
      const response = await axios.get<FlutterwaveValidationResponse>(
        `https://api.flutterwave.com/v3/bill-items/${itemCode}/validate?code=${billerCode}&customer=${meterNumber}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status !== 'success') {
        console.error('[validateMeterNumberWithFlutterwave] Meter validation failed:', response.data);
        let errorMessage = response.data.message;
        let errorCode = 'METER_VALIDATION_FAILED';

        if (response.data.message.includes('Invalid customer id')) {
          errorMessage = 'The meter number is invalid or not registered with the selected provider. Please verify the meter number and try again.';
          errorCode = 'INVALID_CUSTOMER_ID';
        }

        throw new ElectricityServiceError(errorMessage, errorCode);
      }

      console.log('[validateMeterNumberWithFlutterwave] Meter validated successfully:', response.data.data);
      return {
        customerName: response.data.data.name || 'Unknown Customer',
        address: response.data.data.address || 'Unknown Address',
        tariffPlan: response.data.data.response_message || 'Unknown Tariff',
      };
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error(
          '[validateMeterNumberWithFlutterwave] Axios error:',
          error.message,
          error.response?.data || 'No response data'
        );
        let errorMessage = error.response?.data?.message || error.message;
        let errorCode = error.response?.status === 401 ? 'FLUTTERWAVE_AUTH_ERROR' : 'METER_VALIDATION_AXIOS_ERROR';

        if (error.response?.data?.message.includes('Invalid customer id')) {
          errorMessage = 'The meter number is invalid or not registered with the selected provider. Please verify the meter number and try again.';
          errorCode = 'INVALID_CUSTOMER_ID';
        }

        throw new ElectricityServiceError(`Failed to validate meter number: ${errorMessage}`, errorCode);
      }
      console.error('[validateMeterNumberWithFlutterwave] Unexpected error:', error);
      throw new ElectricityServiceError(
        'Failed to validate meter number due to an unexpected error',
        'METER_VALIDATION_UNEXPECTED_ERROR'
      );
    }
  }

  /**
   * Retrieves meter information for a given biller and meter number
   */
  async getMeterInfo(billerCode: string, meterNumber: string, meterType: 'prepaid' | 'postpaid' = 'prepaid'): Promise<MeterInfo> {
    const billers = await this.getElectricityBillers();
    const biller = billers.find((b) => b.id.toString() === billerCode || b.biller_name === billerCode);
    if (!biller) {
      throw new ElectricityServiceError(`Biller not found for code: ${billerCode}`, 'BILLER_NOT_FOUND');
    }

    const itemCode = biller.item_codes.find((ic) => ic.identifier.includes(meterType.toUpperCase()))?.identifier;
    if (!itemCode) {
      throw new ElectricityServiceError(`No ${meterType} item code found for biller code: ${billerCode}`, 'ITEM_CODE_NOT_FOUND');
    }

    return this.validateMeterNumberWithFlutterwave(biller.id.toString(), itemCode, meterNumber);
  }

  /**
   * Saves a meter number for a user
   */
  async saveMeterNumber(userId: string, meterNumber: string): Promise<void> {
    if (!validateMeterNumber(meterNumber)) {
      console.error('Invalid meter number format for saving:', meterNumber);
      throw new ElectricityServiceError('Invalid meter number format', 'INVALID_METER_NUMBER');
    }
    try {
      console.log(`Saving meter number ${meterNumber} for user ${userId}`);
      await prisma.user.update({
        where: { id: userId },
        data: { savedMeterNumbers: { push: meterNumber } },
      });
    } catch (error: any) {
      console.error('Error saving meter number:', error.message);
      throw new ElectricityServiceError('Failed to save meter number', 'SAVE_METER_ERROR');
    }
  }

  /**
   * Retrieves saved meter numbers for a user
   */
  async getSavedMeterNumbers(userId: string): Promise<string[]> {
    try {
      console.log(`Fetching saved meter numbers for user ${userId}`);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { savedMeterNumbers: true },
      });
      return user?.savedMeterNumbers || [];
    } catch (error: any) {
      console.error('Error fetching saved meter numbers:', error.message);
      throw new ElectricityServiceError('Failed to fetch saved meter numbers', 'FETCH_METER_NUMBERS_ERROR');
    }
  }

  /**
   * Creates an electricity order
   */
  async createElectricityOrder(
    userId: string,
    billerCode: string,
    meterNumber: string,
    amount: number,
    paymentMethod: PaymentMethod,
    meterType: 'prepaid' | 'postpaid' = 'prepaid'
  ): Promise<ElectricityOrder> {
    if (!validatePaymentAmount(amount)) {
      console.error(`Invalid payment amount for user ${userId}: ${amount}`);
      throw new ElectricityServiceError('Invalid payment amount. Must be between 0 and 1,000,000 NGN.', 'INVALID_PAYMENT_AMOUNT');
    }

    if (!validateMeterNumber(meterNumber)) {
      console.error(`Invalid meter number for user ${userId}: ${meterNumber}`);
      throw new ElectricityServiceError('Invalid meter number format. Must be 10 to 13 digits.', 'INVALID_METER_NUMBER');
    }

    if (!isValidPaymentMethod(paymentMethod)) {
      console.error(`Invalid payment method for user ${userId}: ${paymentMethod}`);
      throw new ElectricityServiceError('Invalid payment method for electricity payment', 'INVALID_PAYMENT_METHOD');
    }

    try {
      console.log(`Creating order for user ${userId}, billerCode ${billerCode}, meterType ${meterType}`);
      const billers = await this.getElectricityBillers();
      const biller = billers.find((b) => b.id.toString() === billerCode || b.biller_name === billerCode);
      if (!biller) {
        console.error(`Biller not found for code: ${billerCode}`);
        throw new ElectricityServiceError(`Biller not found for code: ${billerCode}`, 'BILLER_NOT_FOUND');
      }

      const itemCode = biller.item_codes.find((ic) => ic.identifier.includes(meterType.toUpperCase()))?.identifier;
      if (!itemCode) {
        console.error(`No ${meterType} item code found for biller: ${billerCode}`);
        throw new ElectricityServiceError(`No ${meterType} item code found for biller`, 'ITEM_CODE_NOT_FOUND');
      }

      await this.validateMeterNumberWithFlutterwave(biller.id.toString(), itemCode, meterNumber);

      const serviceFee = await this.getServiceCharge();
      const flutterwaveFee = await this.getFlutterwaveFee(biller.id.toString(), itemCode);
      const subtotal = amount + flutterwaveFee + serviceFee;
      const vatRate = await this.getVatRate();
      const vat = Math.ceil(subtotal * vatRate);

      // Find the ServiceType ID for 'electricity'
      const serviceType = await prisma.serviceType.findUnique({
        where: { name: 'electricity' },
        select: { id: true },
      });
      if (!serviceType) {
        throw new ElectricityServiceError('ServiceType "electricity" not found', 'SERVICE_TYPE_NOT_FOUND');
      }

      const paymentJwt = generateJWT(userId, amount, meterNumber, biller.id.toString());
      console.log(`Generated JWT for order: ${paymentJwt}`);

      const order = await prisma.serviceOrder.create({
        data: {
          id: uuidv4(),
          userId,
          billerCode: biller.id.toString(),
          itemCode,
          meterNumber,
          meterType,
          amountDue: new Prisma.Decimal(amount + serviceFee + flutterwaveFee + vat),
          paymentMethod,
          status: 'PENDING',
          paymentStatus: TransactionStatus.PENDING,
          serviceFee,
          flutterwaveFee,
          vat,
          customerReference: generateTransactionReference(),
          serviceTypeId: serviceType.id, // Connect to ServiceType by ID
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const savedMeters = await this.getSavedMeterNumbers(userId);
      if (!savedMeters.includes(meterNumber)) {
        await this.saveMeterNumber(userId, meterNumber);
        console.log(`Meter number ${meterNumber} saved for user ${userId}`);
      }

      console.log(`Order created successfully: ${order.id}`);
      return {
        id: order.id,
        userId: order.userId!,
        billerCode: order.billerCode!,
        itemCode: order.itemCode!,
        meterNumber: order.meterNumber!,
        meterType: order.meterType!,
        paymentAmount: amount,
        paymentMethod: order.paymentMethod!,
        token: order.token,
        status: order.paymentStatus,
        serviceFee: order.serviceFee ?? null,
        flutterwaveFee: order.flutterwaveFee ?? null,
        vat: order.vat ?? null,
        transactionRef: order.transactionRef,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        paymentJwt,
      };
    } catch (error: any) {
      console.error(`Error creating order for user ${userId}: ${error.message}`, {
        stack: error.stack,
        requestData: { userId, billerCode, meterNumber, amount, paymentMethod, meterType },
      });
      throw error instanceof ElectricityServiceError
        ? error
        : new ElectricityServiceError(
            error.message.includes('Invalid customer id')
              ? 'The meter number is invalid or not registered with the selected provider.'
              : `Failed to create electricity order: ${error.message}`,
            error.code || 'ORDER_CREATION_ERROR'
          );
    }
  }

  /**
   * Processes a payment for an electricity order
   */
  async processPayment(
    userId: string,
    orderId: string,
    paymentMethod: PaymentMethod,
    paymentJwt: string
  ): Promise<{
    success: boolean;
    message: string;
    token?: string;
    paymentLink?: string;
    bankTransferDetails?: { accountNumber: string; bankName: string; reference: string };
  }> {
    console.log(`Processing payment for orderId: ${orderId}, method: ${paymentMethod}`);

    let decodedJwt;
    try {
      decodedJwt = verifyJWT(paymentJwt);
      console.log('JWT verified successfully');
    } catch (error: unknown) {
      console.error('JWT verification failed:', error);
      throw new ElectricityServiceError('Invalid or expired payment authorization', 'JWT_VERIFICATION_FAILED');
    }

    let order: ServiceOrder | null;
    try {
      order = await prisma.serviceOrder.findUnique({
        where: { id: orderId },
      });
      if (!order || order.userId !== userId) {
        console.error(`Order not found or unauthorized: ${orderId}`);
        throw new ElectricityServiceError('Order not found or unauthorized', 'ORDER_NOT_FOUND');
      }

      if (
        decodedJwt.userId !== userId ||
        decodedJwt.paymentAmount !== order.amountDue.toNumber() - (order.serviceFee ?? 0) - (order.flutterwaveFee ?? 0) - (order.vat ?? 0) ||
        decodedJwt.meterNumber !== order.meterNumber ||
        decodedJwt.billerCode !== order.billerCode
      ) {
        console.error(`JWT payload mismatch for order ${orderId}`);
        throw new ElectricityServiceError('Invalid payment authorization: JWT payload mismatch', 'JWT_PAYLOAD_MISMATCH');
      }
    } catch (error: any) {
      console.error('Error fetching order:', error.message);
      throw new ElectricityServiceError('Failed to fetch order', 'FETCH_ORDER_ERROR');
    }

    const billerCode = order.billerCode;
    const itemCode = order.itemCode;
    if (!billerCode || !itemCode) {
      console.error(`No biller code or item code found for order ${orderId}`);
      throw new ElectricityServiceError('No biller code or item code configured for order', 'BILLER_CODE_NOT_FOUND');
    }

    const serviceFee = order.serviceFee ?? (await this.getServiceCharge());
    const flutterwaveFee = order.flutterwaveFee ?? (await this.getFlutterwaveFee(billerCode, itemCode));
    const subtotal = order.amountDue.toNumber() - (order.vat ?? 0);
    const vatRate = await this.getVatRate();
    const vat = Math.ceil(subtotal * vatRate);
    const totalCustomerAmount = order.amountDue.toNumber();

    const merchantDeduction = calculateMerchantDeduction(
      order.amountDue.toNumber() - serviceFee - flutterwaveFee - vat,
      flutterwaveFee
    );
    console.log(`Merchant deduction for order ${orderId}: ${merchantDeduction}`);

    switch (paymentMethod) {
      case PaymentMethod.WALLET: {
        const transactionRef = generateTransactionReference();
        let walletTransactionId: string | undefined;

        try {
          await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>) => {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { email: true, phoneNumber: true, name: true },
            });
            if (!user) {
              throw new ElectricityServiceError('User not found', 'USER_NOT_FOUND');
            }

            const payload = {
              country: 'NG',
              customer_id: order.meterNumber!,
              amount: order.amountDue.toNumber() - serviceFee - flutterwaveFee - vat,
              reference: transactionRef,
              email: user.email || 'default@example.com',
              phone_number: user.phoneNumber || '07000000000',
              fullname: user.name || 'Unknown User',
            };

            console.log('Initiating Flutterwave bill payment:', payload);
            const response = await axios.post<FlutterwaveBillPaymentResponse>(
              `https://api.flutterwave.com/v3/billers/${billerCode}/items/${itemCode}/payment`,
              payload,
              { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
            );

            if (response.data.status !== 'success') {
              throw new ElectricityServiceError(
                `Flutterwave bill payment failed: ${response.data.message || 'No message provided'}`,
                response.data.message.includes('Insufficient funds')
                  ? 'INSUFFICIENT_SOURCE_BALANCE'
                  : 'FLUTTERWAVE_PAYMENT_FAILED'
              );
            }

            const billStatus = await this.getBillStatus(transactionRef);
            if (billStatus.status !== 'success' || !billStatus.data) {
              throw new ElectricityServiceError('Bill status check failed after payment initiation', 'BILL_STATUS_FAILED');
            }

            let token: string | undefined = billStatus.data.extra?.match(/TOKEN\d+/)?.[0] ?? undefined;
            if (!token && isPrepaidElectricity(billerCode)) {
              console.warn('Token not found in bill status:', billStatus.data);
            }

            console.log(`Deducting ${totalCustomerAmount} from user wallet for order ${orderId}`);
            const walletTx = await walletService.payWithWallet(
              userId,
              totalCustomerAmount,
              orderId,
              'electricity',
              null,
              serviceFee,
              vatRate,
              0,
              undefined
            );
            walletTransactionId = walletTx.id;
            console.log(`Wallet deducted, transaction ID: ${walletTransactionId}`);

            await tx.serviceOrder.update({
              where: { id: orderId },
              data: {
                status: 'PAYMENT_RECEIVED',
                paymentStatus: TransactionStatus.COMPLETED,
                token,
                flutterwaveFee,
                vat,
                serviceFee,
                transactionRef,
              },
            });

            await tx.walletTransaction.update({
              where: { id: walletTransactionId },
              data: {
                status: TransactionStatus.COMPLETED,
                billerCode,
              },
            });

            await tx.payment.create({
              data: {
                id: uuidv4(),
                userId,
                transactionRef,
                serviceType: 'electricity', // Set as string
                billerCode,
                meterNumber: order.meterNumber!,
                amount: totalCustomerAmount,
                requestedAmount: order.amountDue.toNumber() - serviceFee - flutterwaveFee - vat,
                status: TransactionStatus.COMPLETED,
                paymentMethod,
                paymentDetails: { merchantDeduction },
                serviceOrderId: orderId,
              },
            });

            console.log('Wallet payment completed, token:', token);
          });

          const updatedOrder = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
          return {
            success: true,
            message: 'Payment completed successfully',
            token: updatedOrder?.token ?? undefined,
          };
        } catch (error: unknown) {
          if (isAxiosError(error)) {
            console.error('Payment processing failed:', error.message, error.response?.data || 'No response data');
            throw new ElectricityServiceError(
              `Payment failed: ${error.response?.data?.message || error.message}`,
              error.response?.status === 401
                ? 'FLUTTERWAVE_AUTH_ERROR'
                : error.response?.data?.message.includes('Insufficient funds')
                ? 'INSUFFICIENT_SOURCE_BALANCE'
                : 'WALLET_PAYMENT_AXIOS_ERROR'
            );
          }
          console.error('Unexpected error in payment processing:', error);
          throw new ElectricityServiceError(
            `Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'WALLET_PAYMENT_UNEXPECTED_ERROR'
          );
        }
      }

      case PaymentMethod.MONNIFY: {
        const transactionRef = generateTransactionReference();
        try {
          const paymentResult = await this.initiateFlutterwavePayment(
            userId,
            order.amountDue.toNumber() - (order.serviceFee ?? 0) - (order.flutterwaveFee ?? 0) - (order.vat ?? 0),
            serviceFee,
            order.meterNumber!,
            billerCode,
            transactionRef
          );

          await prisma.serviceOrder.update({
            where: { id: orderId },
            data: {
              status: 'PENDING',
              paymentStatus: TransactionStatus.PENDING,
              transactionRef,
              serviceFee,
              flutterwaveFee,
              vat,
            },
          });

          await prisma.payment.create({
            data: {
              id: uuidv4(),
              userId,
              transactionRef,
              serviceType: 'electricity', // Set as string
              billerCode,
              meterNumber: order.meterNumber!,
              amount: totalCustomerAmount,
              requestedAmount: order.amountDue.toNumber() - serviceFee - flutterwaveFee - vat,
              status: TransactionStatus.PENDING,
              paymentMethod,
              paymentDetails: { merchantDeduction, paymentLink: paymentResult.paymentLink },
              serviceOrderId: orderId,
            },
          });

          return {
            success: true,
            message: 'Redirect to Flutterwave payment link',
            paymentLink: paymentResult.paymentLink,
          };
        } catch (error: unknown) {
          console.error(`Flutterwave payment initiation failed:`, error);
          throw new ElectricityServiceError(
            `Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'FLUTTERWAVE_PAYMENT_INIT_ERROR'
          );
        }
      }

      case PaymentMethod.TRANSFER: {
        const transactionRef = generateTransactionReference();
        try {
          const paymentResult = await paymentService.processPayment(
            userId,
            totalCustomerAmount,
            paymentMethod,
            undefined,
            'electricity',
            undefined,
            transactionRef,
            undefined,
            undefined,
            false,
            order.meterNumber!
          );

          if (paymentResult.status !== TransactionStatus.PENDING) {
            throw new ElectricityServiceError(
              `Payment initiation failed with status: ${paymentResult.status}`,
              'TRANSFER_PAYMENT_STATUS_ERROR'
            );
          }

          const transferDetails = paymentResult.paymentDetails?.bankTransfer;
          if (!transferDetails) {
            throw new ElectricityServiceError(
              'Bank transfer details not found in payment result',
              'TRANSFER_DETAILS_NOT_FOUND'
            );
          }

          console.log(`Transfer details for order ${orderId}:`, {
            transfer_reference: transferDetails.accountReference,
            transfer_account: transferDetails.accountNumber,
            transfer_bank: transferDetails.bankName,
          });

          await prisma.serviceOrder.update({
            where: { id: orderId },
            data: {
              status: 'PENDING',
              paymentStatus: TransactionStatus.PENDING,
              transactionRef,
              serviceFee,
              flutterwaveFee,
              vat,
            },
          });

          await prisma.payment.create({
            data: {
              id: uuidv4(),
              userId,
              transactionRef,
              serviceType: 'electricity', // Set as string
              billerCode,
              meterNumber: order.meterNumber!,
              amount: totalCustomerAmount,
              requestedAmount: order.amountDue.toNumber() - serviceFee - flutterwaveFee - vat,
              status: TransactionStatus.PENDING,
              paymentMethod,
              paymentDetails: {
                merchantDeduction,
                account_number: transferDetails.accountNumber,
                bank_name: transferDetails.bankName,
                transfer_reference: transferDetails.accountReference,
              },
              serviceOrderId: orderId,
            },
          });

          return {
            success: true,
            message: `Please make a bank transfer to account number ${transferDetails.accountNumber} at ${transferDetails.bankName}. Reference: ${transferDetails.accountReference}. Payment is pending manual verification.`,
            bankTransferDetails: {
              accountNumber: transferDetails.accountNumber,
              bankName: transferDetails.bankName,
              reference: transferDetails.accountReference,
            },
          };
        } catch (error: unknown) {
          console.error(`Transfer payment initiation failed:`, error);
          throw new ElectricityServiceError(
            `Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'TRANSFER_PAYMENT_INIT_ERROR'
          );
        }
      }

      default:
        console.error('Unsupported payment method:', paymentMethod);
        throw new ElectricityServiceError('Unsupported payment method', 'UNSUPPORTED_PAYMENT_METHOD');
    }
  }

  /**
   * Initiates a Flutterwave payment
   */
  private async initiateFlutterwavePayment(
    userId: string,
    amount: number,
    serviceFee: number,
    meterNumber: string,
    billerCode: string,
    transactionRef: string
  ): Promise<{ paymentLink: string }> {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    let userEmail: string;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userEmail = user?.email || 'default@example.com';
    } catch (error: any) {
      console.error('Error fetching user email:', error.message);
      userEmail = 'default@example.com';
    }

    const serviceFeeDynamic = await this.getServiceCharge();
    const flutterwaveFee = Math.ceil(amount * 0.015);
    const totalAmountWithoutVat = amount + serviceFeeDynamic + flutterwaveFee;
    const vatRate = await this.getVatRate();
    const vat = Math.ceil(totalAmountWithoutVat * vatRate);
    const totalAmount = totalAmountWithoutVat + vat;

    const payload = {
      tx_ref: transactionRef,
      amount: totalAmount,
      currency: 'NGN',
      customer: {
        email: userEmail,
        number: meterNumber,
      },
      redirect_url: `${baseUrl}/api/electricity/verify`,
      customizations: {
        title: 'Electricity Bill Payment',
        description: `Payment of N${amount} + N${serviceFeeDynamic} service fee + VAT for meter ${meterNumber}`,
      },
    };

    try {
      console.log('Sending Flutterwave payment request:', JSON.stringify(payload));
      const response = await axios.post<{ data: { link: string } }>(
        'https://api.flutterwave.com/v3/payments',
        payload,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      console.log('Flutterwave response:', response.data);
      return { paymentLink: response.data.data.link };
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error(
          'Flutterwave payment initiation failed:',
          error.message,
          error.response?.data || 'No response data'
        );
        throw new ElectricityServiceError(
          `Failed to initiate payment: ${error.message}`,
          'FLUTTERWAVE_INIT_AXIOS_ERROR'
        );
      }
      console.error('Unexpected error in payment initiation:', error);
      throw new ElectricityServiceError('Failed to initiate payment', 'FLUTTERWAVE_INIT_UNEXPECTED_ERROR');
    }
  }

  /**
   * Fetches the bill status from Flutterwave
   */
  private async getBillStatus(transactionRef: string): Promise<FlutterwaveBillStatusResponse> {
    try {
      console.log('Fetching bill status for ref:', transactionRef);
      const response = await axios.get<FlutterwaveBillStatusResponse>(
        `https://api.flutterwave.com/v3/bills/${transactionRef}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      if (response.data.status !== 'success') {
        console.error('Bill status fetch failed:', response.data);
        throw new ElectricityServiceError('Failed to fetch bill status', 'BILL_STATUS_FETCH_FAILED');
      }
      console.log('Bill status response:', response.data);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error('Error fetching bill status:', error.message, error.response?.data || 'No response data');
        throw new ElectricityServiceError(`Failed to fetch bill status: ${error.message}`, 'BILL_STATUS_AXIOS_ERROR');
      }
      console.error('Unexpected error in bill status fetch:', error);
      throw new ElectricityServiceError('Failed to fetch bill status', 'BILL_STATUS_UNEXPECTED_ERROR');
    }
  }

  /**
   * Verifies a payment for an electricity order
   */
  async verifyPayment(
    orderId: string,
    transactionRef: string
  ): Promise<{ success: boolean; message: string; token?: string }> {
    console.log(`Verifying payment for orderId: ${orderId}, transactionRef: ${transactionRef}`);

    let order: ServiceOrder | null;
    try {
      order = await prisma.serviceOrder.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        console.error('Order not found:', orderId);
        throw new ElectricityServiceError('Order not found', 'ORDER_NOT_FOUND');
      }
    } catch (error: any) {
      console.error('Error fetching order for verification:', error.message);
      throw new ElectricityServiceError('Failed to fetch order', 'FETCH_ORDER_ERROR');
    }

    try {
      const billStatus = await this.getBillStatus(transactionRef);
      if (billStatus.status === 'success' && billStatus.data) {
        console.log('Payment verified successfully via bill status');
        const billerCode = order.billerCode;
        if (!billerCode) {
          throw new ElectricityServiceError('No biller code configured for order', 'BILLER_CODE_NOT_FOUND');
        }

        const serviceFee = order.serviceFee ?? (await this.getServiceCharge());
        const flutterwaveFee = order.flutterwaveFee ?? Math.ceil((order.amountDue.toNumber() - (order.vat ?? 0) - serviceFee) * 0.015);
        const subtotal = order.amountDue.toNumber() - (order.vat ?? 0);
        const vatRate = await this.getVatRate();
        const vat = Math.ceil(subtotal * vatRate);
        const totalAmount = order.amountDue.toNumber();

        if (billStatus.data.amount !== totalAmount) {
          console.error(`Amount mismatch for order ${orderId}: expected ${totalAmount}, received ${billStatus.data.amount}`);
          await prisma.serviceOrder.update({
            where: { id: orderId },
            data: { paymentStatus: TransactionStatus.FAILED },
          });
          throw new ElectricityServiceError('Payment verification failed: amount mismatch', 'AMOUNT_MISMATCH');
        }

        const merchantDeduction = calculateMerchantDeduction(
          order.amountDue.toNumber() - serviceFee - flutterwaveFee - vat,
          flutterwaveFee
        );
        console.log(`Verification details for order ${orderId}: totalAmount=${totalAmount}, merchantDeduction=${merchantDeduction}`);

        let token: string | undefined = billStatus.data.extra?.match(/TOKEN\d+/)?.[0] ?? undefined;
        if (isPrepaidElectricity(billerCode) && !token) {
          console.warn('Token not found in bill status:', billStatus.data);
        }

        await prisma.serviceOrder.update({
          where: { id: orderId },
          data: {
            status: 'PAYMENT_RECEIVED',
            paymentStatus: TransactionStatus.COMPLETED,
            token,
            flutterwaveFee,
            vat,
            serviceFee,
            transactionRef,
          },
        });

        const payment = await prisma.payment.findFirst({
          where: { serviceOrderId: orderId },
        });

        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: TransactionStatus.COMPLETED,
              paymentDetails: {
                merchantDeduction,
                totalAmount,
              },
            },
          });
        } else {
          console.warn(`No payment found for serviceOrderId ${orderId}`);
        }

        return { success: true, message: 'Payment verified successfully', token };
      } else {
        console.error('Bill status verification failed:', billStatus);
        await prisma.serviceOrder.update({
          where: { id: orderId },
          data: { paymentStatus: TransactionStatus.FAILED },
        });
        if (order.paymentMethod === PaymentMethod.WALLET) {
          const totalAmount = calculateTotalAmount(
            order.amountDue.toNumber() - (order.serviceFee ?? 0) - (order.flutterwaveFee ?? 0) - (order.vat ?? 0),
            order.serviceFee ?? 0,
            order.flutterwaveFee ?? 0,
            order.vat ?? 0
          );
          await walletService.refundFunds(order.userId!, totalAmount, orderId, 'electricity', null, false);
          console.log('Refunded wallet due to verification failure');
        }
        return { success: false, message: 'Payment verification failed' };
      }
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.error('Error verifying payment:', error.message, error.response?.data || 'No response data');
        await prisma.serviceOrder.update({
          where: { id: orderId },
          data: { paymentStatus: TransactionStatus.FAILED },
        });
        if (order.paymentMethod === PaymentMethod.WALLET) {
          const totalAmount = calculateTotalAmount(
            order.amountDue.toNumber() - (order.serviceFee ?? 0) - (order.flutterwaveFee ?? 0) - (order.vat ?? 0),
            order.serviceFee ?? 0,
            order.flutterwaveFee ?? 0,
            order.vat ?? 0
          );
          await walletService.refundFunds(order.userId!, totalAmount, orderId, 'electricity', null, false);
          console.log('Refunded wallet due to error');
        }
        throw new ElectricityServiceError(`Verification failed: ${error.message}`, 'VERIFY_PAYMENT_AXIOS_ERROR');
      }
      console.error('Unexpected error in payment verification:', error);
      throw new ElectricityServiceError(
        `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERIFY_PAYMENT_UNEXPECTED_ERROR'
      );
    }
  }

  /**
   * Regenerates a payment JWT for an existing order
   */
  async regeneratePaymentJwt(userId: string, orderId: string): Promise<string> {
    try {
      console.log(`Regenerating JWT for user ${userId}, order ${orderId}`);
      const order = await prisma.serviceOrder.findUnique({
        where: { id: orderId },
      });

      if (!order || order.userId !== userId) {
        console.error(`Order not found or unauthorized: ${orderId}`);
        throw new ElectricityServiceError('Order not found or unauthorized', 'ORDER_NOT_FOUND');
      }

      if (order.status !== 'PENDING') {
        console.error(`Order ${orderId} is not in a pending state: ${order.status}`);
        throw new ElectricityServiceError('Order is not in a pending state', 'ORDER_NOT_PENDING');
      }

      if (!order.billerCode) {
        console.error(`No biller code configured for order ${orderId}`);
        throw new ElectricityServiceError('No biller code configured for order', 'BILLER_CODE_NOT_FOUND');
      }

      if (!order.meterNumber) {
        console.error(`No meter number configured for order ${orderId}`);
        throw new ElectricityServiceError('No meter number configured for order', 'METER_NUMBER_NOT_FOUND');
      }

      const newJwt = generateJWT(
        userId,
        order.amountDue.toNumber() - (order.serviceFee ?? 0) - (order.flutterwaveFee ?? 0) - (order.vat ?? 0),
        order.meterNumber,
        order.billerCode
      );
      console.log(`New JWT generated for order ${orderId}: ${newJwt}`);
      return newJwt;
    } catch (error: any) {
      console.error(`Error regenerating JWT for order ${orderId}: ${error.message}`);
      throw error instanceof ElectricityServiceError
        ? error
        : new ElectricityServiceError(`Failed to regenerate payment JWT: ${error.message}`, 'JWT_REGENERATION_ERROR');
    }
  }

  /**
   * Retrieves order history for a user
   */
  async getOrderHistory(userId: string): Promise<ElectricityOrder[]> {
    try {
      console.log(`Fetching order history for user ${userId}`);
      const orders = await prisma.serviceOrder.findMany({
        where: {
          userId,
          serviceType: {
            name: 'electricity', // Filter by related ServiceType name
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return orders.map((order) => ({
        id: order.id,
        userId: order.userId!,
        billerCode: order.billerCode!,
        itemCode: order.itemCode!,
        meterNumber: order.meterNumber!,
        meterType: order.meterType!,
        paymentAmount: order.amountDue.toNumber() - (order.serviceFee ?? 0) - (order.flutterwaveFee ?? 0) - (order.vat ?? 0),
        paymentMethod: order.paymentMethod!,
        token: order.token,
        status: order.paymentStatus,
        serviceFee: order.serviceFee ?? null,
        flutterwaveFee: order.flutterwaveFee ?? null,
        vat: order.vat ?? null,
        transactionRef: order.transactionRef,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }));
    } catch (error: any) {
      console.error('Error fetching order history:', error.message);
      throw new ElectricityServiceError('Failed to fetch order history', 'FETCH_ORDER_HISTORY_ERROR');
    }
  }
}

export default new ElectricityService();