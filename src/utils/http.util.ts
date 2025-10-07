import { Response } from 'express';
import { ErrorCodes } from '../errors/errorCodes'; // Updated to use ErrorCodes

export class BaseHttpException extends Error {
  constructor(
    public message: string,
    public errorCode: ErrorCodes, // Updated to ErrorCodes
    public statusCode: number,
    public errors: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class HttpResponse {
  static success(res: Response, data: any, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res: Response,
    error: { message: string; errorCode: ErrorCodes; statusCode: number; details?: any } // Updated to ErrorCodes
  ) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode,
      details: error.details || null,
    });
  }
}