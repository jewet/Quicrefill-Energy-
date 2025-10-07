import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ApiError } from './ApiError';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const errorMessage = err instanceof Error ? err.message : String(err || 'Unknown error');

  logger.error(`[errorHandler] Error: ${errorMessage}, URL: ${req.originalUrl}, RequestID: ${requestId}, Stack: ${err instanceof Error ? err.stack : 'No stack trace'}`);

  if (res.headersSent) {
    logger.warn(`[errorHandler] Headers already sent, cannot send error response, RequestID: ${requestId}`);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
      details: err.details || { error: err.message },
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errorCode: 'INTERNAL_ERROR',
    details: { error: errorMessage },
  });
};