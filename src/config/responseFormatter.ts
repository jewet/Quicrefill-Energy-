// src/config/responseFormatter.ts
import { Response } from 'express';

export const successResponse = (
  res: Response,
  data: unknown,
  message: string = 'Success',
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode: number = 400,
  errorCode: string = 'UNKNOWN_ERROR',
  details?: unknown
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    details,
  });
};