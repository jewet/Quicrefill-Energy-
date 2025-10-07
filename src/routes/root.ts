import { Router, Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { authenticationMiddleware } from '../middlewares/authentication';
import paymentRoutes from './paymentRoutes';
import { apiAuthRoutes, accountsAuthRoutes } from './accounts/auth';
import accountRoutes from './accounts/root';
import CustomerAddressRouter from './customerMap/customerAddress.routes';
import CategoryRouter from './category/categoryRoutes';
import CartRouter from './cart/cart.routes';
import SupportRouter from './support/root';
import otpRoutes from './otp/otp.route';
import TermiiOtpRouter from './otp/termii-otp.router';
import IdentityVerificationRoutes from './identity/IdentityVerificationRoutes';
import emailRoutes from './email/emailRoutes';
import verificationRoute from './verificationRoutes';
import documentTypeRoute from './documentTypeRoute';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';
import { errorHandler } from '../errors/globalErrorHandler'; // Import external error handler
import ServiceRoutes from './serviceRoutes';
// Middleware to sanitize URLs
const sanitizeUrl = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const originalUrl = req.originalUrl;
  const [path, queryString] = originalUrl.split('?');
  const sanitizedPath = path.replace(/(\r\n|[\r\n]|%0D|%0A)/g, '');
  const sanitizedUrl = queryString ? `${sanitizedPath}?${queryString}` : sanitizedPath;

  logger.info(`[sanitizeUrl] Original URL: ${originalUrl}, Sanitized URL: ${sanitizedUrl}`, { requestId });
  if (path !== sanitizedPath) {
    logger.info(`[sanitizeUrl] Redirecting from ${originalUrl} to ${sanitizedUrl}`, { requestId });
    res.redirect(307, sanitizedUrl);
    return;
  }
  next();
};

// Initialize router
const rootRoutes: Router = Router({ caseSensitive: false, strict: false });

// Apply URL sanitization globally
rootRoutes.use(sanitizeUrl);

// Debug middleware to log all incoming requests
rootRoutes.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`[rootRoutes] Incoming request: ${req.method} ${req.originalUrl}, RequestID: ${requestId}, Body: ${JSON.stringify(req.body)}`);
  next();
});

// Root route
rootRoutes.get('/', (req: Request, res: Response) => {
  res.json({ message: 'API is running' });
});

// Customer service API status
rootRoutes.get('/api/customer', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Customer Service API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount other routes
rootRoutes.use('/api/payments', paymentRoutes);
rootRoutes.use('/api/auth', apiAuthRoutes);
rootRoutes.use('/accounts/auth', accountsAuthRoutes);
rootRoutes.use('/accounts', accountRoutes);
rootRoutes.use('/api/otp', otpRoutes);
rootRoutes.use('/api/termii/otp', TermiiOtpRouter);
rootRoutes.use('/api/category', (req: Request, res: Response, next: NextFunction) => {
  logger.info('[rootRoutes] Entering /api/category router');
  next();
}, CategoryRouter);
rootRoutes.use('/api/carts', CartRouter);
rootRoutes.use('/api/support', SupportRouter);
rootRoutes.use('/api/identity', authenticationMiddleware, IdentityVerificationRoutes);
rootRoutes.use('/api/email', emailRoutes);
rootRoutes.use('/api/user', authenticationMiddleware, CustomerAddressRouter);
rootRoutes.use('/api', authenticationMiddleware, verificationRoute);
rootRoutes.use('/api', authenticationMiddleware, documentTypeRoute);
rootRoutes.use('/api/services', ServiceRoutes);

// Catch-all for 404 errors
rootRoutes.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  logger.warn(`[rootRoutes] 404 - Route not found: ${req.originalUrl}, RequestID: ${requestId}`);
  next(new ApiError(404, `Route ${req.originalUrl} not found`, 'NOT_FOUND', true));
});

// Use external error handler
rootRoutes.use(errorHandler);

export { rootRoutes };