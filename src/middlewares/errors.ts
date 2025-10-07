import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { BaseHttpException } from '../exceptions/root';
import { ApiError } from '../lib/utils/errors/appError';
import { ZodError } from 'zod';
import path from 'path';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/customer-error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/customer-combined.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] || 'unknown';
  if (res.headersSent) {
    logger.warn(`[${requestId}] Headers already sent, cannot send error response`, {
      error: err.message || String(err),
      stack: err.stack,
      path: req.path,
    });
    return;
  }

  // Handle request aborted errors
  if (err.type === 'request.aborted' || err.code === 'ECONNABORTED') {
    logger.warn('Client aborted request', {
      path: req.path,
      method: req.method,
      error: err.message,
      expected: err.expected,
      received: err.received,
      requestId,
    });
    res.status(499).end();
    return;
  }

  logger.error('Unhandled error', {
    error: err.message || 'Unknown Error',
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId,
  });

  // Handle custom BaseHttpException
  if (err instanceof BaseHttpException) {
    res.status(err.statusCode).json({
      success: false,
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
      errorCode: err.errorCode,
      errors: err.errors,
    });
    return;
  }

  // Handle ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      details: err.details,
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      status: 'fail',
      statusCode: 400,
      message: 'Validation error',
      errors: err.errors,
    });
    return;
  }

  // Handle generic errors
  res.status(500).json({
    success: false,
    status: 'error',
    statusCode: 500,
    message: err.message || 'Internal server error',
    errorCode: 'INTERNAL_ERROR',
  });
};