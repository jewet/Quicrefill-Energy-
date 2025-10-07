// src/errors/ApiError.ts
export class ApiError extends Error {
    statusCode: number;
    isOperational: boolean;
    errorCode: string;
    details?: any;

  
    constructor(
      statusCode: number,
      message: string,
      errorCode: string,
      isOperational = true,
      details?: any
    ) {
      
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      this.errorCode = errorCode;
      this.details = details;
      Error.captureStackTrace(this, this.constructor);
    }
  
    static badRequest(message: string, errorCode: string, details?: any) {
      return new ApiError(400, message, errorCode, true, details);
    }

  static conflict(message: string, errorCode: string, details?: any) {
    return new ApiError(409, message, errorCode, true, details);
  }
  
    static unauthorized(message: string, errorCode: string, details?: any) {
      return new ApiError(401, message, errorCode, true, details);
    }
  
    static forbidden(message: string, errorCode: string, details?: any) {
      return new ApiError(403, message, errorCode, true, details);
    }
  
    static notFound(message: string, errorCode: string, details?: any) {
      return new ApiError(404, message, errorCode, true, details);
    }
  
    static tooManyRequests(message: string, errorCode: string, details?: any) {
      return new ApiError(429, message, errorCode, true, details);
    }
  
    static internal(message: string, errorCode: string, details?: any) {
      return new ApiError(500, message, errorCode, false, details);
    }
  
    static serviceUnavailable(message: string, errorCode: string, details?: any) {
      return new ApiError(503, message, errorCode, true, details);
    }
  }