// src/errors/ErrorHandler.ts
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from './ApiError';
import { ErrorCodes } from './errorCodes';
import logger from '../config/logger';
import axios from 'axios';

export const errorHandler: ErrorRequestHandler = async (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction

): Promise<void> => {
  
  // Log the error
  if (err instanceof ApiError) {
    if (!err.isOperational) {
      logger.error({
        message: `CRITICAL ERROR: ${err.message}`,
        errorCode: err.errorCode,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
    } else {
      logger.warn({
        message: `Error: ${err.message}`,
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method
      });
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      details: err.details
    });
    return Promise.resolve();
  }

  // Handle axios errors specifically
  if (axios.isAxiosError(err)) {
    const statusCode = err.response?.status || 500;
    const errorMessage = err.response?.data?.message || err.message;
    const errorCode = err.code === 'ECONNREFUSED' 
      ? ErrorCodes.CONNECTION_REFUSED 
      : ErrorCodes.SERVICE_ERROR;
    
    logger.error({
      message: `Service error: ${errorMessage}`,
      errorCode,
      statusCode,
      path: req.path,
      method: req.method,
      service: err.config?.url,
      responseData: err.response?.data
    });

    res.status(statusCode).json({
      success: false,
      message: 'Service currently unavailable',
      errorCode,
      details: process.env.NODE_ENV === 'development' ? {
        actualError: errorMessage,
        service: err.config?.url
      } : undefined
    });
    return;
  }

  // Handle unknown errors
  logger.error({
    message: `Uncaught exception: ${err.message}`,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errorCode: ErrorCodes.INTERNAL_ERROR
  });
  return;
};

// 404 handler middleware
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`, ErrorCodes.NOT_FOUND);
  next(error);
};

// Handle proxy errors
export const proxyErrorHandler = (err: Error, req: Request, _res: Response, next: NextFunction) => {
  logger.error({
    message: `Proxy error: ${err.message}`,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  const apiError = ApiError.serviceUnavailable(
    'Service currently unavailable', 
    ErrorCodes.PROXY_ERROR
  );
  
  next(apiError);
};