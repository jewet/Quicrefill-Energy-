import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { inMemoryStore } from '../utils/inMemoryStore';
import { UnauthorizedRequest } from '../exceptions/unauthorizedRequests';
import { AppErrorCode } from '../exceptions/root';
import { verifyToken } from '../lib/utils/jwt/verifyToken';
import { accessTokenPayload } from '../lib/types/payload';
import { HttpResponse } from '../utils/http.util';
import logger from '../config/logger';
import { ErrorCodes } from '../errors/errorCodes';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Define user type for request
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  contextRole?: string;
  isAdmin: boolean;
}

// Extend Express Request interface
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    userId?: string;
  }
}

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log unauthorized access attempts
const logUnauthorizedAccess = (ip: string, reason: string): void => {
  const logFile = path.join(logDir, 'auth_attempts.log');
  const logEntry = `[${new Date().toISOString()}] Unauthorized attempt from IP: ${ip} - Reason: ${reason}\n`;
  fs.appendFileSync(logFile, logEntry, 'utf8');
};

// Rate limiter for login attempts
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' },
  headers: true,
});

// Authentication Middleware
export const authenticationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

    if (!token) {
      logUnauthorizedAccess(req.ip || 'unknown', 'No token provided');
      throw new UnauthorizedRequest('User is not authenticated', AppErrorCode.UNAUTHENTICATED);
    }

    if (inMemoryStore.isTokenBlacklisted(token)) {
      logUnauthorizedAccess(req.ip || 'unknown', 'Token is blacklisted');
      throw new UnauthorizedRequest('Session expired. Please log in again.', AppErrorCode.INVALID_TOKEN);
    }

    const decoded = (await verifyToken(token)) as accessTokenPayload;

    // Validate role exists in Role table
    const role = await prisma.role.findUnique({
      where: { name: decoded.role },
    });
    if (!role) {
      logUnauthorizedAccess(req.ip || 'unknown', `Invalid role: ${decoded.role}`);
      throw new UnauthorizedRequest('Invalid role', AppErrorCode.INVALID_ROLE);
    }

    // Fetch user to get isAdmin status
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isAdmin: true },
    });
    if (!user) {
      logUnauthorizedAccess(req.ip || 'unknown', `User not found: ${decoded.userId}`);
      throw new UnauthorizedRequest('User not found', AppErrorCode.UNAUTHENTICATED);
    }

    // Validate contextRole if provided
    let contextRole: string | undefined;
    if (decoded.contextRole) {
      const contextRoleRecord = await prisma.role.findUnique({
        where: { name: decoded.contextRole },
      });
      if (!contextRoleRecord) {
        logUnauthorizedAccess(req.ip || 'unknown', `Invalid contextRole: ${decoded.contextRole}`);
        throw new UnauthorizedRequest('Invalid context role', AppErrorCode.INVALID_ROLE);
      }
      contextRole = contextRoleRecord.name;
    }

    const cacheKey = `user:${decoded.userId}`;
    inMemoryStore.set(cacheKey, decoded, 3600);

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: role.name,
      contextRole,
      isAdmin: user.isAdmin,
    };

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid token';
    logUnauthorizedAccess(req.ip || 'unknown', errorMessage);
    next(error);
  }
};

// Simple Authentication Middleware
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    logUnauthorizedAccess(req.ip || 'unknown', 'No token provided');
    return HttpResponse.error(res, {
      message: 'No token provided',
      errorCode: ErrorCodes.MISSING_TOKEN,
      statusCode: 401,
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as accessTokenPayload;

    // Validate role exists in Role table
    const role = await prisma.role.findUnique({
      where: { name: decoded.role },
    });
    if (!role) {
      logUnauthorizedAccess(req.ip || 'unknown', `Invalid role: ${decoded.role}`);
      return HttpResponse.error(res, {
        message: 'Invalid role',
        errorCode: ErrorCodes.INVALID_ROLE,
        statusCode: 401,
      });
    }

    // Fetch user to get isAdmin status
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isAdmin: true },
    });
    if (!user) {
      logUnauthorizedAccess(req.ip || 'unknown', `User not found: ${decoded.userId}`);
      return HttpResponse.error(res, {
        message: 'User not found',
        errorCode: ErrorCodes.USER_NOT_FOUND,
        statusCode: 401,
      });
    }

    // Validate contextRole if provided
    let contextRole: string | undefined;
    if (decoded.contextRole) {
      const contextRoleRecord = await prisma.role.findUnique({
        where: { name: decoded.contextRole },
      });
      if (!contextRoleRecord) {
        logUnauthorizedAccess(req.ip || 'unknown', `Invalid contextRole: ${decoded.contextRole}`);
        return HttpResponse.error(res, {
          message: 'Invalid context role',
          errorCode: ErrorCodes.INVALID_ROLE,
          statusCode: 401,
        });
      }
      contextRole = contextRoleRecord.name;
    }

    req.userId = decoded.userId;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: role.name,
      contextRole,
      isAdmin: user.isAdmin,
    };
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid token';
    logUnauthorizedAccess(req.ip || 'unknown', errorMessage);
    return HttpResponse.error(res, {
      message: 'Invalid token',
      errorCode: ErrorCodes.INVALID_TOKEN,
      statusCode: 401,
    });
  }
};

// Role-Based Authorization Middleware Factory
export const authorizeRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const checkRole = req.user?.contextRole && req.user.role !== 'ADMIN' ? req.user.contextRole : req.user?.role;
    if (!checkRole || !roles.includes(checkRole)) {
      logUnauthorizedAccess(
        req.ip || 'unknown',
        `Insufficient permissions - Required roles: ${roles.join(', ')}, Got: ${checkRole || 'none'}`
      );
      return HttpResponse.error(res, {
        message: 'Forbidden - Insufficient permissions',
        errorCode: ErrorCodes.FORBIDDEN,
        statusCode: 403,
      });
    }
    next();
  };
};

// Admin Authentication Middleware
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  await authenticationMiddleware(req, res, (err?: any) => {
    if (err) {
      return next(err);
    }
    const adminRoleChecker = authorizeRoles(['ADMIN']);
    return adminRoleChecker(req, res, next);
  });
};

// Event Type Access Middleware
export const restrictEventTypeAccess = (method: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      await authenticationMiddleware(req, res, (err?: any) => {
        if (err) {
          return next(err);
        }

        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          if (!req.user?.role || req.user.role !== 'ADMIN') {
            logUnauthorizedAccess(
              req.ip || 'unknown',
              `User attempted to ${method} event type without admin role - Role: ${req.user?.role || 'none'}`
            );
            return HttpResponse.error(res, {
              message: 'Forbidden - Admin access required to manage event types',
              errorCode: ErrorCodes.UNAUTHORIZED_ADMIN,
              statusCode: 403,
            });
          }
        } else if (method.toUpperCase() === 'GET') {
          if (!req.user) {
            logUnauthorizedAccess(req.ip || 'unknown', 'No user authenticated for viewing event types');
            return HttpResponse.error(res, {
              message: 'Unauthorized - Authentication required to view event types',
              errorCode: ErrorCodes.UNAUTHORIZED,
              statusCode: 401,
            });
          }
        } else {
          logUnauthorizedAccess(req.ip || 'unknown', `Invalid method for event type access: ${method}`);
          return HttpResponse.error(res, {
            message: 'Method not allowed',
            errorCode: ErrorCodes.BAD_REQUEST,
            statusCode: 405,
          });
        }

        next();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logUnauthorizedAccess(req.ip || 'unknown', `Error in event type access: ${errorMessage}`);
      return HttpResponse.error(res, {
        message: `Failed to check event type access: ${errorMessage}`,
        errorCode: ErrorCodes.INTERNAL_ERROR,
        statusCode: 500,
      });
    }
  };
};

// Email Template Access Middleware
export const restrictEmailTemplateAccess = (method: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      await authenticationMiddleware(req, res, (err?: any) => {
        if (err) {
          return next(err);
        }

        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          if (!req.user?.role || req.user.role !== 'ADMIN') {
            logUnauthorizedAccess(
              req.ip || 'unknown',
              `User attempted to ${method} email template without admin role - Role: ${req.user?.role || 'none'}`
            );
            return HttpResponse.error(res, {
              message: 'Forbidden - Admin access required to manage email templates',
              errorCode: ErrorCodes.UNAUTHORIZED_ADMIN,
              statusCode: 403,
            });
          }
        } else if (method.toUpperCase() === 'GET') {
          if (!req.user) {
            logUnauthorizedAccess(req.ip || 'unknown', 'No user authenticated for viewing email templates');
            return HttpResponse.error(res, {
              message: 'Unauthorized - Authentication required to view email templates',
              errorCode: ErrorCodes.UNAUTHORIZED,
              statusCode: 401,
            });
          }
        } else {
          logUnauthorizedAccess(req.ip || 'unknown', `Invalid method for email template access: ${method}`);
          return HttpResponse.error(res, {
            message: 'Method not allowed',
            errorCode: ErrorCodes.BAD_REQUEST,
            statusCode: 405,
          });
        }

        next();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logUnauthorizedAccess(req.ip || 'unknown', `Error in email template access: ${errorMessage}`);
      return HttpResponse.error(res, {
        message: `Failed to check email template access: ${errorMessage}`,
        errorCode: ErrorCodes.INTERNAL_ERROR,
        statusCode: 500,
      });
    }
  };
};

// Pay on Delivery Check Middleware
export const checkPayOnDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const { paymentMethod } = req.body;
    if (paymentMethod !== 'PAY_ON_DELIVERY') {
      logger.info('Skipping pay on delivery check for non-PAY_ON_DELIVERY method', { paymentMethod, userId: req.user?.id });
      return next();
    }

    const userId = req.user?.id || req.userId;
    if (!userId) {
      logger.error('User not authenticated in checkPayOnDelivery', { paymentMethod });
      return HttpResponse.error(res, {
        message: 'User not authenticated',
        errorCode: ErrorCodes.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    const cacheKey = `user_orders:${userId}`;
    let userOrders: number;
    const cachedOrders = inMemoryStore.get(cacheKey);

    if (cachedOrders) {
      userOrders = parseInt(cachedOrders, 10);
    } else {
      userOrders = await prisma.productOrder.count({
        where: {
          userId,
          orderStatus: { in: ['DELIVERED'] },
        },
      });
      inMemoryStore.set(cacheKey, userOrders.toString(), 3600);
    }

    if (userOrders === 0) {
      logger.warn('Pay on delivery rejected for new customer', { userId, paymentMethod });
      return HttpResponse.error(res, {
        message: 'Pay on delivery not available for new customers',
        errorCode: ErrorCodes.FORBIDDEN,
        statusCode: 403,
      });
    }

    logger.info('Pay on delivery allowed', { userId, userOrders });
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to check pay on delivery eligibility', { error: errorMessage, userId: req.user?.id });
    return HttpResponse.error(res, {
      message: `Failed to check pay on delivery eligibility: ${errorMessage}`,
      errorCode: ErrorCodes.INTERNAL_ERROR,
      statusCode: 500,
    });
  }
};

// Payment Request Validation Middleware
export const validatePaymentRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const { amount, paymentMethod, transactionRef } = req.body;

    if (!amount || !paymentMethod) {
      return HttpResponse.error(res, {
        message: 'Missing payment details',
        errorCode: ErrorCodes.MISSING_FIELDS,
        statusCode: 400,
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return HttpResponse.error(res, {
        message: 'Invalid payment amount. Must be a positive number.',
        errorCode: ErrorCodes.INVALID_PAYMENT_AMOUNT,
        statusCode: 400,
      });
    }

    interface PaymentMethodRow {
      value: string;
    }

    const paymentMethods = await prisma.$queryRaw<PaymentMethodRow[]>`
      SELECT unnest(enum_range(NULL::"public"."PaymentMethod")) AS value
    `;
    const allowedPaymentMethods: string[] = paymentMethods.map((row: PaymentMethodRow) => row.value);

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return HttpResponse.error(res, {
        message: `Invalid payment method. Must be one of: ${allowedPaymentMethods.join(', ')}.`,
        errorCode: ErrorCodes.INVALID_PAYMENT_METHOD,
        statusCode: 400,
      });
    }

    if (transactionRef && (typeof transactionRef !== 'string' || !/^[a-zA-Z0-9-_]+$/.test(transactionRef))) {
      return HttpResponse.error(res, {
        message: 'Invalid transaction reference format. Use alphanumeric characters, hyphens, and underscores only.',
        errorCode: ErrorCodes.BAD_REQUEST,
        statusCode: 400,
      });
    }

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return HttpResponse.error(res, {
      message: `Failed to validate payment request: ${errorMessage}`,
      errorCode: ErrorCodes.INTERNAL_ERROR,
      statusCode: 500,
    });
  }
};

// Raw Body Saver Middleware
export const rawBodySaver = (req: Request, res: Response, next: NextFunction): void | Response => {
  if (Buffer.isBuffer(req.body)) {
    (req as any).rawBody = req.body;
    logger.info('Raw Body Set:', {
      body: req.body.toString('utf8').slice(0, 100),
      length: req.body.length,
      headers: req.headers,
    });
  } else {
    logger.warn('Raw body is not a Buffer:', {
      bodyType: typeof req.body,
      body: req.body,
      headers: req.headers,
    });
    (req as any).rawBody = null;
  }
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch (error) {
      logger.error('Failed to parse raw body as JSON:', { error });
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }
  next();
};