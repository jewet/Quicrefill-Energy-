import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import paymentService from '../services/paymentService'; // Must export an instance: export default new PaymentService();
import dotenv from 'dotenv';
import { PaymentMethod, TransactionStatus } from '@prisma/client';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Instantiate logger
const logger = new Logger('PaymentController');

// Instantiate Prisma client
const prisma = new PrismaClient();

// Zod validation schemas
export const CardDetailsSchema = z.object({
  cardno: z.string().nonempty('Card number is required'),
  cvv: z.string().nonempty('CVV is required'),
  expirymonth: z.string().nonempty('Expiry month is required'),
  expiryyear: z.string().nonempty('Expiry year is required'),
  pin: z.string().optional(),
  suggested_auth: z.string().optional(),
  billingzip: z.string().optional(),
  billingcity: z.string().optional(),
  billingaddress: z.string().optional(),
  billingstate: z.string().optional(),
  billingcountry: z.string().optional(),
});

export const PaymentRequestSchema = z
  .object({
    amount: z.number().positive('Amount must be positive'),
    paymentMethod: z.string().nonempty('Payment method is required').transform((val) => val.toLowerCase()),
    productType: z.enum(['product', 'wallet_topup'], {
      message: 'Invalid product type. Must be "product" or "wallet_topup"',
    }).optional(),
    serviceType: z.enum(['gas', 'petrol', 'diesel', 'electricity'], {
      message: 'Invalid service type. Must be "gas", "petrol", "diesel", or "electricity"',
    }).optional(),
    transactionRef: z.string().optional(),
    itemId: z.string().optional(),
    cardDetails: z
      .object({
        cardno: z.string().optional(),
        cvv: z.string().optional(),
        expirymonth: z.string().optional(),
        expiryyear: z.string().optional(),
        pin: z.string().optional(),
        suggested_auth: z.string().optional(),
        billingzip: z.string().optional(),
        billingcity: z.string().optional(),
        billingaddress: z.string().optional(),
        billingstate: z.string().optional(),
        billingcountry: z.string().optional(),
      })
      .optional(),
    isWalletTopUp: z.boolean().optional().default(false),
    meterNumber: z.string().optional(),
    voucherCode: z.string().optional(),
    destinationBankCode: z.string().optional(),
    destinationAccountNumber: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMethod === 'card' && !data.cardDetails) {
        return false;
      }
      if (
        data.paymentMethod === 'card' &&
        (!data.cardDetails?.cardno ||
          !data.cardDetails?.cvv ||
          !data.cardDetails?.expirymonth ||
          !data.cardDetails?.expiryyear)
      ) {
        return false;
      }
      if (['transfer', 'virtual_account'].includes(data.paymentMethod) && data.cardDetails) {
        return false;
      }
      if (data.isWalletTopUp && (data.productType || data.serviceType)) {
        return false;
      }
      if (data.productType && data.serviceType) {
        return false;
      }
      if (data.serviceType === 'electricity' && (!data.meterNumber || !data.destinationBankCode || !data.destinationAccountNumber)) {
        return false;
      }
      return true;
    },
    {
      message:
        'Card details (cardno, cvv, expirymonth, expiryyear) are required for Card payment method, ' +
        'cardDetails must not be provided for TRANSFER or VIRTUAL_ACCOUNT, ' +
        'isWalletTopUp cannot be used with productType or serviceType, ' +
        'productType and serviceType cannot both be set, ' +
        'meterNumber, destinationBankCode, and destinationAccountNumber are required for electricity serviceType',
      path: ['cardDetails'],
    }
  );

export const VerifyPaymentSchema = z.object({
  transactionRef: z.string().nonempty('Transaction reference is required'),
  otp: z.string().optional(),
  flwRef: z.string().optional(),
  tokenId: z.string().optional(),
});

export const PaymentMethodStatusSchema = z.object({
  paymentMethod: z.string().nonempty('Payment method is required'),
});

export const BVNVerificationSchema = z.object({
  bvn: z.string().regex(/^\d{11}$/, 'BVN must be 11 digits'),
  bankName: z.string().nonempty('Bank name is required'),
  accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
  transactionRef: z.string().nonempty('Transaction reference is required'),
});

export const AuthorizePaymentSchema = z.object({
  transactionRef: z.string().nonempty('Transaction reference is required'),
  flwRef: z.string().optional(),
  authorizationData: z
    .object({
      cardno: z.string().nonempty('Card number is required'),
      cvv: z.string().nonempty('CVV is required'),
      expirymonth: z.string().nonempty('Expiry month is required'),
      expiryyear: z.string().nonempty('Expiry year is required'),
      pin: z.string().optional(),
    })
    .refine(
      (data) => !!(data.cardno && data.cvv && data.expirymonth && data.expiryyear),
      {
        message: 'Card number, CVV, expiry month, and expiry year must be provided',
        path: ['authorizationData'],
      }
    ),
});

export const RefundRequestSchema = z.object({
  transactionRef: z.string().nonempty('Transaction reference is required'),
  amount: z.number().positive('Refund amount must be positive'),
  paymentReference: z.string().optional(),
});

export const TransactionHistorySchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum([TransactionStatus.COMPLETED, TransactionStatus.PENDING, TransactionStatus.FAILED]).optional(),
  paymentMethod: z.enum([PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.VIRTUAL_ACCOUNT, PaymentMethod.PAY_ON_DELIVERY, PaymentMethod.MONNIFY]).optional(),
});

export const CancelPaymentSchema = z.object({
  transactionRef: z.string().nonempty('Transaction reference is required'),
});

interface PaymentCallbackQuery {
  transaction_id?: string;
  status?: string;
  tx_ref?: string;
}

interface VerificationResult {
  transactionId: string;
  status: string;
  amount?: number;
  paymentMethod?: PaymentMethod;
  [key: string]: any;
}

class PaymentController {
  async initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = PaymentRequestSchema.parse(req.body);
      const {
        amount,
        paymentMethod,
        productType,
        serviceType,
        transactionRef,
        cardDetails,
        isWalletTopUp,
        meterNumber,
        itemId,
        voucherCode,
        destinationBankCode,
        destinationAccountNumber,
      } = validatedData;
      const userId = req.user?.id;

      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated', { requestBody: req.body });
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      let clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (Array.isArray(clientIp)) clientIp = clientIp[0];

      logger.info(`Initiating payment request`, {
        userId,
        amount,
        paymentMethod,
        productType: productType || 'none',
        serviceType: serviceType || 'none',
        isWalletTopUp,
        transactionRef: transactionRef || 'generated',
        clientIp,
        meterNumber: meterNumber || 'none',
        itemId: itemId || 'none',
        voucherCode: voucherCode || 'none',
        destinationBankCode: destinationBankCode || 'none',
        destinationAccountNumber: destinationAccountNumber || 'none',
      });

      interface PaymentMethodRow {
        value: string;
      }

      const paymentMethods = await prisma.$queryRaw<PaymentMethodRow[]>`
        SELECT unnest(enum_range(NULL::"public"."PaymentMethod")) AS value
      `;
      const validPaymentMethods: string[] = paymentMethods.map((row: PaymentMethodRow) => row.value);

      const normalizedPaymentMethod = validPaymentMethods.find(
        (method: string) => method.toLowerCase() === paymentMethod.toLowerCase()
      );
      if (!normalizedPaymentMethod) {
        logger.error(`Invalid payment method: ${paymentMethod}`, { validMethods: validPaymentMethods });
        res.status(400).json({
          error: `Invalid payment method: ${paymentMethod}. Must be one of: ${validPaymentMethods.join(', ')}`,
        });
        return;
      }

      let validatedCardDetails;
      if (normalizedPaymentMethod === PaymentMethod.CARD && cardDetails) {
        validatedCardDetails = CardDetailsSchema.parse(cardDetails);
      }

      if (isWalletTopUp) {
        if (normalizedPaymentMethod === PaymentMethod.WALLET) {
          logger.error('Wallet top-up cannot use WALLET payment method', { userId, paymentMethod });
          res.status(400).json({
            error: 'Wallet top-up cannot use WALLET payment method. Use CARD, TRANSFER, or VIRTUAL_ACCOUNT.',
          });
          return;
        }
      }

      const payment = serviceType === 'electricity'
        ? await paymentService.processBillPayment(
            userId,
            amount,
            normalizedPaymentMethod as PaymentMethod,
            meterNumber!,
            destinationBankCode!,
            destinationAccountNumber!,
            transactionRef,
            validatedCardDetails,
            clientIp,
            voucherCode
          )
        : await paymentService.processPayment(
            userId,
            amount,
            normalizedPaymentMethod as PaymentMethod,
            productType,
            serviceType,
            itemId,
            transactionRef,
            clientIp,
            validatedCardDetails,
            isWalletTopUp,
            meterNumber,
            voucherCode
          );

      logger.info(`Payment initiated successfully`, {
        userId,
        transactionId: payment.transactionId,
        status: payment.status,
        paymentMethod: normalizedPaymentMethod,
        productType,
        serviceType,
        itemId,
      });

      res.status(201).json({
        message: 'Payment initiated successfully',
        payment,
      });
    } catch (error: any) {
      logger.error('Payment initiation error', {
        message: error.message,
        stack: error.stack,
        userId: req.user?.id,
        paymentMethod: req.body.paymentMethod,
        transactionRef: req.body.transactionRef,
        isWalletTopUp: req.body.isWalletTopUp,
        productType: req.body.productType,
        serviceType: req.body.serviceType,
        itemId: req.body.itemId,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to initiate payment',
      });
    }
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      logger.info('Received webhook', {
        eventType: req.body['event.type'] || req.body.event,
        tx_ref: req.body.data?.tx_ref,
      });
      await paymentService.verifyWebhook(req);

      res.status(200).json({
        message: 'Webhook processed successfully',
      });
    } catch (error: any) {
      logger.error('Webhook processing error', {
        message: error.message,
        webhookData: req.body,
        rawBody: (req as any).rawBody,
      });

      if (error.message === 'Invalid webhook signature') {
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }

      res.status(200).json({
        message: 'Webhook processed with error',
        error: error.message,
      });
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionRef, otp, flwRef, tokenId } = VerifyPaymentSchema.parse(req.body);

      if (otp && flwRef && tokenId) {
        logger.info(`Validating card payment with OTP`, { transactionRef, flwRef });
        const result = await paymentService.validateCardPayment(transactionRef, flwRef, tokenId, otp);
        res.status(200).json({
          message: 'Card payment validation result',
          result,
        });
        return;
      }

      logger.info(`Verifying payment`, { transactionRef });
      const result = await paymentService.verifyPayment(transactionRef);
      res.status(200).json({
        message: 'Payment verification result',
        result,
      });
    } catch (error: any) {
      logger.error('Payment verification error', {
        message: error.message,
        transactionRef: req.body.transactionRef,
        flwRef: req.body.flwRef,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to verify payment',
      });
    }
  }

  async handleCallback(
    req: Request<{}, {}, {}, PaymentCallbackQuery & { response?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      logger.info('Payment callback processing', {
        query: req.query,
        path: req.path,
        headers: req.headers,
      });

      const { transaction_id, tx_ref, response } = req.query;

      let transactionData: any;
      if (response) {
        try {
          transactionData = JSON.parse(decodeURIComponent(response));
        } catch (parseErr: unknown) {
          const errorMessage = parseErr instanceof Error ? parseErr.message : 'Unknown parsing error';
          logger.error('Failed to parse response parameter', {
            error: errorMessage,
            response,
          });
          throw new Error('Invalid response format');
        }
      }

      const transactionId = transactionData?.txRef || tx_ref || transaction_id;
      if (!transactionId) {
        logger.error('Missing transaction identifier in callback', { query: req.query });
        throw new Error('Missing transaction ID or tx_ref');
      }

      logger.info('Handling callback for transaction', {
        transactionId,
        status: transactionData?.status,
        flwRef: transactionData?.flwRef,
      });

      let verificationResult: VerificationResult;
      if (
        transactionData?.authModelUsed === 'VBVSECURECODE' &&
        transactionData?.flwRef &&
        transactionData.status === 'pending' &&
        transactionData.chargeResponseCode === '02'
      ) {
        logger.info('Validating card payment with OTP', { transactionId });
        verificationResult = await paymentService.validateCardPayment(
          transactionId,
          transactionData.flwRef,
          'default-token-id', // Adjust based on actual tokenId if available
          '12345' // Default sandbox OTP
        );
      } else {
        logger.info('Verifying payment', { transactionId });
        verificationResult = await paymentService.verifyPayment(transactionId);
      }

      // Fetch payment to determine payment method for redirect
      const payment = await prisma.payment.findUnique({
        where: { id: transactionId },
        select: { paymentMethod: true },
      });

      logger.info('Callback verification result', {
        transactionId: verificationResult.transactionId,
        status: verificationResult.status,
        amount: verificationResult.amount ?? 'N/A',
        paymentMethod: payment?.paymentMethod,
      });

      const frontendUrl = (process.env.FRONTEND_URL || 'https://your-frontend.com')
        .trim()
        .replace(/\/+$/, '');
      let redirectPath: string;

      switch (verificationResult.status) {
        case TransactionStatus.COMPLETED:
          redirectPath = `/payment-success?tx_ref=${encodeURIComponent(transactionId)}`;
          break;
        case TransactionStatus.FAILED:
          redirectPath = `/payment-failed?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`;
          break;
        case TransactionStatus.PENDING:
          redirectPath =
            payment?.paymentMethod === PaymentMethod.TRANSFER
              ? `/payment-bank-transfer-pending?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`
              : payment?.paymentMethod === PaymentMethod.VIRTUAL_ACCOUNT
              ? `/payment-virtual-account-pending?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`
              : `/payment-pending?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`;
          break;
        case 'cancelled':
          redirectPath = `/payment-cancelled?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`;
          break;
        default:
          logger.warn(`Unknown payment status: ${verificationResult.status}`, { transactionId });
          redirectPath = `/payment-failed?tx_ref=${encodeURIComponent(transactionId)}&status=UNKNOWN`;
      }

      const redirectUrl = `${frontendUrl}${redirectPath}`;
      logger.info(`Redirecting to: ${redirectUrl}`);

      if (!res.headersSent) {
        res.redirect(302, redirectUrl);
      }
    } catch (error: any) {
      logger.error('Payment callback error', {
        error: error.message,
        query: req.query,
        stack: error.stack,
      });

      const { tx_ref } = req.query as { tx_ref?: string };
      const frontendUrl = (process.env.FRONTEND_URL || 'https://your-frontend.com')
        .trim()
        .replace(/\/+$/, '');
      const errorMessage = error.message || 'Payment callback failed';
      const redirectUrl = `${frontendUrl}/payment-failed?tx_ref=${encodeURIComponent(
        tx_ref || 'unknown'
      )}&error=${encodeURIComponent(errorMessage)}`;

      if (!res.headersSent) {
        res.redirect(302, redirectUrl);
      } else {
        logger.info(`Would redirect to error: ${redirectUrl}`);
      }
    }
  }

  async checkPaymentMethodStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentMethod } = PaymentMethodStatusSchema.parse(req.query);
      const userId = req.user?.id;

      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated');
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      interface PaymentMethodRow {
        value: string;
      }

      const paymentMethods = await prisma.$queryRaw<PaymentMethodRow[]>`
        SELECT unnest(enum_range(NULL::"public"."PaymentMethod")) AS value
      `;
      const validMethods: string[] = paymentMethods.map((row: PaymentMethodRow) => row.value);
      if (!validMethods.includes(paymentMethod)) {
        logger.error(`Invalid payment method: ${paymentMethod}`, { validMethods });
        res.status(400).json({
          error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`,
        });
        return;
      }

      logger.info(`Checking payment method status`, { paymentMethod, userId });
      const result = await paymentService.checkPaymentMethodStatus(paymentMethod as PaymentMethod);

      res.status(200).json({
        message: 'Payment method status retrieved successfully',
        result,
      });
    } catch (error: any) {
      logger.error('Payment method status check error', {
        message: error.message,
        paymentMethod: req.query.paymentMethod,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to check payment method status',
      });
    }
  }

  async verifyBVN(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bvn, bankName, accountNumber, transactionRef } = BVNVerificationSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated');
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      logger.info(`Verifying BVN`, { userId, bvn, bankName, transactionRef });
      const result = await paymentService.verifyBVN(userId, bvn, bankName, accountNumber, transactionRef);

      res.status(200).json({
        message: 'BVN verification completed',
        result,
      });
    } catch (error: any) {
      logger.error('BVN verification error', {
        message: error.message,
        userId: req.user?.id,
        bvn: req.body.bvn,
        transactionRef: req.body.transactionRef,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to verify BVN',
      });
    }
  }

  async handlePodCallback(
    req: Request<{}, {}, {}, PaymentCallbackQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transaction_id, tx_ref, status } = req.query;

      if (!tx_ref && !transaction_id) {
        logger.error('Missing transaction ID or tx_ref in POD callback');
        res.status(400).json({ error: 'Missing transaction ID or tx_ref' });
        return;
      }

      const transactionId = (tx_ref || transaction_id) as string;
      logger.info(`Handling POD callback`, { transactionId, status });

      const verificationResult = await paymentService.verifyPayment(transactionId);

      const payment = await prisma.payment.findUnique({ where: { id: transactionId } });
      if (!payment || payment.paymentMethod !== PaymentMethod.PAY_ON_DELIVERY) {
        logger.error(`Invalid payment method for POD callback`, { paymentMethod: payment?.paymentMethod, transactionId });
        res.status(400).json({ error: 'Invalid payment method for POD callback' });
        return;
      }

      const frontendUrl = (process.env.FRONTEND_URL || 'https://your-frontend.com').trim().replace(/\/+$/, '');
      let redirectUrl: string;
      switch (verificationResult.status) {
        case TransactionStatus.COMPLETED:
          redirectUrl = `${frontendUrl}/payment/pod/success?tx_ref=${encodeURIComponent(transactionId)}`;
          break;
        case TransactionStatus.FAILED:
          redirectUrl = `${frontendUrl}/payment/pod/failed?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`;
          break;
        case TransactionStatus.PENDING:
          redirectUrl = `${frontendUrl}/payment/pod/pending?tx_ref=${encodeURIComponent(transactionId)}&status=${verificationResult.status}`;
          break;
        default:
          redirectUrl = `${frontendUrl}/payment/error?tx_ref=${encodeURIComponent(transactionId)}&error=Unknown payment status`;
      }

      logger.info(`Redirecting to: ${redirectUrl}`);
      res.redirect(302, redirectUrl);
    } catch (error: any) {
      logger.error('POD callback error', {
        message: error.message,
        query: req.query,
      });
      res.redirect(
        302,
        `${(process.env.FRONTEND_URL || 'https://your-frontend.com').trim().replace(/\/+$/, '')}/payment/error?error=${encodeURIComponent(error.message || 'POD payment callback failed')}`
      );
    }
  }

  async handleErrorCallback(
    req: Request<{}, {}, {}, { tx_ref?: string; error?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { tx_ref, error } = req.query;

      logger.info(`Handling error callback`, { tx_ref, error });

      if (tx_ref) {
        try {
          await paymentService.verifyPayment(tx_ref);
        } catch (verifyError: any) {
          logger.warn(`Verification failed in error callback`, { error: verifyError.message, tx_ref });
        }
      }

      const frontendUrl = (process.env.FRONTEND_URL || 'https://your-frontend.com').trim().replace(/\/+$/, '');
      const errorMessage = error ? decodeURIComponent(error) : 'Payment failed';
      const redirectUrl = `${frontendUrl}/payment-failed?tx_ref=${encodeURIComponent(
        tx_ref || 'unknown'
      )}&error=${encodeURIComponent(errorMessage)}`;

      logger.info(`Redirecting to: ${redirectUrl}`);
      res.redirect(302, redirectUrl);
    } catch (error: any) {
      logger.error('Error callback error', {
        message: error.message,
        query: req.query,
      });
      const frontendUrl = (process.env.FRONTEND_URL || 'https://your-frontend.com').trim().replace(/\/+$/, '');
      res.redirect(
        302,
        `${frontendUrl}/payment-failed?error=${encodeURIComponent('Unexpected error occurred')}`
      );
    }
  }

  async authorizePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated');
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      const { transactionRef, flwRef, authorizationData } = AuthorizePaymentSchema.parse(req.body);

      logger.info(`Authorizing payment`, { transactionRef, userId, flwRef: flwRef || 'Will fetch from database' });

      const result = await paymentService.authorize3DSCardPayment(transactionRef, flwRef, authorizationData);

      res.status(200).json({
        message: 'Payment authorization processed successfully',
        result,
      });
    } catch (error: any) {
      logger.error('Payment authorization error', {
        message: error.message,
        transactionRef: req.body.transactionRef,
        flwRef: req.body.flwRef,
        userId: req.user?.id,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to authorize payment',
      });
    }
  }

  async processRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated');
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      const { transactionRef, amount, paymentReference } = RefundRequestSchema.parse(req.body);

      logger.info(`Processing refund`, { transactionRef, userId, amount });

      await paymentService.processRefund(transactionRef, userId, amount, paymentReference);

      res.status(200).json({
        message: 'Refund processed successfully',
      });
    } catch (error: any) {
      logger.error('Refund processing error', {
        message: error.message,
        transactionRef: req.body.transactionRef,
        userId: req.user?.id,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to process refund',
      });
    }
  }

  async getTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated');
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      const { page, limit, startDate, endDate, status, paymentMethod } = TransactionHistorySchema.parse(req.query);

      logger.info(`Fetching transaction history`, { userId, page, limit, status, paymentMethod });

      const result = await paymentService.getTransactionHistory(userId, {
        page,
        limit,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        paymentMethod,
      });

      res.status(200).json({
        message: 'Transaction history retrieved successfully',
        result,
      });
    } catch (error: any) {
      logger.error('Transaction history fetch error', {
        message: error.message,
        userId: req.user?.id,
        query: req.query,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to fetch transaction history',
      });
    }
  }

  async cancelPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('Unauthorized access attempt: No user authenticated');
        res.status(401).json({ error: 'Unauthorized - No user authenticated' });
        return;
      }

      const { transactionRef } = CancelPaymentSchema.parse(req.body);

      logger.info(`Cancelling payment`, { transactionRef, userId });

      await paymentService.cancelPayment(transactionRef, userId);

      res.status(200).json({
        message: 'Payment cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Payment cancellation error', {
        message: error.message,
        transactionRef: req.body.transactionRef,
        userId: req.user?.id,
      });
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({
        error: error.message || 'Failed to cancel payment',
      });
    }
  }
}

export default PaymentController;