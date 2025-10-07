import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod'; // Import ZodIssue
import logger from '../config/logger';
import { ApiError } from '../lib/utils/errors/appError';

// Utility to safely serialize objects
function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    if (value instanceof require('http').ClientRequest || value instanceof require('http').IncomingMessage) {
      return '[HTTP Object]';
    }
    return value;
  });
}

export const validateRequest = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      logger.info(`Validating ${source}: ${safeStringify(data)}`);

      // Use parseAsync to support async refinements
      const result = await schema.parseAsync(data);

      // Assign validated data back to the request
      if (source === 'body') req.body = result;
      else if (source === 'query') req.query = result || {};
      else if (source === 'params') req.params = result;

      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue: ZodIssue) => ({
          path: issue.path.map(String).join('.'), // Convert path elements to strings
          message: issue.message,
        }));
        const errorMessage = `Validation failed for ${source}: ${safeStringify(errors)}`;
        logger.error(errorMessage);
        throw new ApiError(400, errorMessage, 'VALIDATION_ERROR', true, { validationErrors: errors });
      }
      logger.error(`Validation error in ${source}: ${(error instanceof Error) ? error.message : 'Unknown error'}`, {
        error: safeStringify(error),
      });
      next(
        error instanceof ApiError
          ? error
          : new ApiError(500, 'Validation error', 'INTERNAL_SERVER_ERROR', true, {
              originalError: (error instanceof Error) ? error.message : 'Unknown error',
            })
      );
    }
  };
};