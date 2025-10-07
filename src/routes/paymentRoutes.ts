import express, { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import PaymentController from '../controllers/paymentController';
import { authenticationMiddleware } from '../middlewares/authentication';
import { webhookRateLimiter } from '../modules/walletModule/middlewareAndValidation';
import { Logger } from '../utils/loggers';

// Increase EventEmitter max listeners to prevent MaxListenersExceededWarning
EventEmitter.defaultMaxListeners = 15;

// Use singleton logger with 'Payments' context
const logger = Logger.getLogger('Payments');

// Instantiate PaymentController
const paymentController = new PaymentController();

// Async handler to catch promise rejections
const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error(`Error in route ${req.path}`, {
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack,
    });
    next(error);
  });

const router = express.Router();

// Initiates a payment for a product or wallet top-up
router.post(
  '/initiate',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Initiating payment request', {
      method: req.method,
      url: req.url,
      body: req.body,
      userId: req.user?.id,
    });
    if (!paymentController.initiatePayment) {
      throw new Error('initiatePayment method is not defined in PaymentController');
    }
    return paymentController.initiatePayment(req, res, next);
  })
);

// Handles payment webhooks from Flutterwave
router.post(
  '/webhook',
  webhookRateLimiter,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Received webhook request', {
      method: req.method,
      url: req.url,
      eventType: req.body['event.type'] || req.body.event,
      tx_ref: req.body.data?.tx_ref,
    });
    if (!paymentController.handleWebhook) {
      throw new Error('handleWebhook method is not defined in PaymentController');
    }
    return paymentController.handleWebhook(req, res, next);
  })
);

// Handles payment gateway redirect after payment
router.get(
  '/callback',
  webhookRateLimiter,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Handling callback request', {
      method: req.method,
      url: req.url,
      query: req.query,
    });
    if (!paymentController.handleCallback) {
      throw new Error('handleCallback method is not defined in PaymentController');
    }
    return paymentController.handleCallback(req, res, next);
  })
);

// Handles cash-on-delivery payment callback
router.get(
  '/callback/cod',
  webhookRateLimiter,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Handling COD callback request', {
      method: req.method,
      url: req.url,
      query: req.query,
    });
    if (!paymentController.handlePodCallback) {
      throw new Error('handlePodCallback method is not defined in PaymentController');
    }
    return paymentController.handlePodCallback(req, res, next);
  })
);

// Handles payment callback errors
router.get(
  '/callback/error',
  webhookRateLimiter,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Handling error callback request', {
      method: req.method,
      url: req.url,
      query: req.query,
    });
    if (!paymentController.handleErrorCallback) {
      throw new Error('handleErrorCallback method is not defined in PaymentController');
    }
    return paymentController.handleErrorCallback(req, res, next);
  })
);

// Verifies a payment or validates card payment with OTP
router.post(
  '/verify',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Verifying payment request', {
      method: req.method,
      url: req.url,
      body: req.body,
      userId: req.user?.id,
    });
    if (!paymentController.verifyPayment) {
      throw new Error('verifyPayment method is not defined in PaymentController');
    }
    return paymentController.verifyPayment(req, res, next);
  })
);

// Authorizes a payment with additional authentication details
router.post(
  '/authorize',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Authorizing payment request', {
      method: req.method,
      url: req.url,
      body: req.body,
      userId: req.user?.id,
    });
    if (!paymentController.authorizePayment) {
      throw new Error('authorizePayment method is not defined in PaymentController');
    }
    return paymentController.authorizePayment(req, res, next);
  })
);

// Checks the status of a payment method
router.get(
  '/method-status',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Checking payment method status', {
      method: req.method,
      url: req.url,
      query: req.query,
      userId: req.user?.id,
    });
    if (!paymentController.checkPaymentMethodStatus) {
      throw new Error('checkPaymentMethodStatus method is not defined in PaymentController');
    }
    return paymentController.checkPaymentMethodStatus(req, res, next);
  })
);

// Verifies BVN for bank account linking
router.post(
  '/verify-bvn',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Verifying BVN request', {
      method: req.method,
      url: req.url,
      body: req.body,
      userId: req.user?.id,
    });
    if (!paymentController.verifyBVN) {
      throw new Error('verifyBVN method is not defined in PaymentController');
    }
    return paymentController.verifyBVN(req, res, next);
  })
);

// Processes a refund for a transaction
router.post(
  '/refund',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Processing refund request', {
      method: req.method,
      url: req.url,
      body: req.body,
      userId: req.user?.id,
    });
    if (!paymentController.processRefund) {
      throw new Error('processRefund method is not defined in PaymentController');
    }
    return paymentController.processRefund(req, res, next);
  })
);

// Retrieves transaction history for a user
router.get(
  '/transaction-history',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Fetching transaction history request', {
      method: req.method,
      url: req.url,
      query: req.query,
      userId: req.user?.id,
    });
    if (!paymentController.getTransactionHistory) {
      throw new Error('getTransactionHistory method is not defined in PaymentController');
    }
    return paymentController.getTransactionHistory(req, res, next);
  })
);

// Cancels a payment
router.post(
  '/cancel',
  authenticationMiddleware,
  asyncHandler((req: Request, res: Response, next: NextFunction) => {
    logger.info('Cancelling payment request', {
      method: req.method,
      url: req.url,
      body: req.body,
      userId: req.user?.id,
    });
    if (!paymentController.cancelPayment) {
      throw new Error('cancelPayment method is not defined in PaymentController');
    }
    return paymentController.cancelPayment(req, res, next);
  })
);

export default router;