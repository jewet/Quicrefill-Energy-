/**
 * Custom API Error class for handling HTTP errors with status codes
 * and standardized error messages.
 */
export class ApiError extends Error {
    readonly statusCode: number;
    readonly status: string;
    readonly isOperational: boolean;
    readonly errorCode: string; // Added errorCode property
    readonly details: any; // Added details property

    constructor(
        statusCode: number,
        message: string,
        errorCode: string = 'UNKNOWN_ERROR', // Default errorCode
        isOperational: boolean = true,
        details: any = null, // Default details to null
        stack: string = ''
    ) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = isOperational;
        this.errorCode = errorCode;
        this.details = details;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Creates a new ApiError instance for Bad Request (400)
     */
    static badRequest(message: string, errorCode: string = 'BAD_REQUEST', details: any = null): ApiError {
        return new ApiError(400, message, errorCode, true, details);
    }

    /**
     * Creates a new ApiError instance for Unauthorized (401)
     */
    static unauthorized(message: string = 'Unauthorized', errorCode: string = 'UNAUTHORIZED', details: any = null): ApiError {
        return new ApiError(401, message, errorCode, true, details);
    }

    /**
     * Creates a new ApiError instance for Forbidden (403)
     */
    static forbidden(message: string = 'Forbidden', errorCode: string = 'FORBIDDEN', details: any = null): ApiError {
        return new ApiError(403, message, errorCode, true, details);
    }

    /**
     * Creates a new ApiError instance for Not Found (404)
     */
    static notFound(message: string = 'Resource not found', errorCode: string = 'NOT_FOUND', details: any = null): ApiError {
        return new ApiError(404, message, errorCode, true, details);
    }

    /**
     * Creates a new ApiError instance for Conflict (409)
     */
    static conflict(message: string, errorCode: string = 'CONFLICT', details: any = null): ApiError {
        return new ApiError(409, message, errorCode, true, details);
    }

    /**
     * Creates a new ApiError instance for Internal Server Error (500)
     */
    static internal(message: string = 'Internal server error', errorCode: string = 'INTERNAL_ERROR', details: any = null): ApiError {
        return new ApiError(500, message, errorCode, false, details);
    }

    /**
     * Converts the error to a structured object for response
     */
    toJSON() {
        return {
            success: false,
            status: this.status,
            statusCode: this.statusCode,
            message: this.message,
            errorCode: this.errorCode,
            details: this.details,
        };
    }
}