import { Response } from 'express';
import { AppErrorCode } from '../exceptions/root';

export class BaseHttpException extends Error {
  constructor(
    public message: string,
    public errorCode: AppErrorCode,
    public statusCode: number,
    public errors: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Add BadRequestError class
export class BadRequestError extends BaseHttpException {
  constructor(message: string, errorCode: AppErrorCode, errors: any = null) {
    super(message, errorCode, 400, errors);
  }
}

// Add NotFoundError class
export class NotFoundError extends BaseHttpException {
  constructor(message: string, errorCode: AppErrorCode, errors: any = null) {
    super(message, errorCode, 404, errors);
  }
}

export class HttpResponse {
  // Use a generic type T for the data parameter to allow any valid data structure
  static success<T>(res: Response, message: string = 'Success', data: T, statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res: Response, message: string, statusCode: number = 400, details?: any) {
    return res.status(statusCode).json({
      success: false,
      message,
      details,
    });
  }
}