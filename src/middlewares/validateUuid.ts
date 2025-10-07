import { Request, Response, NextFunction } from 'express';
import { validate } from 'uuid';
import { ApiError } from '../lib/utils/errors/appError';

export const validateUuid = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    // Log the original ID for debugging
    console.log(`[validateUuid] Original ${paramName}: ${id}, URL: ${req.originalUrl}`);

    // Check if the ID is provided and is a string
    if (!id || typeof id !== 'string') {
      const errorMsg = `Invalid ${paramName}: must be a non-empty string, URL: ${req.originalUrl}, ID: ${id}`;
      console.log(`[validateUuid] ${errorMsg}`);
      return next(new ApiError(400, errorMsg));
    }

    // Sanitize ID by removing only CRLF and encoded CRLF (%0D, %0A)
    // Use a precise regex to avoid affecting UUID characters
    const cleanedId = id.trim().replace(/(\r\n|[\r\n]|%0D|%0A)/g, '');

    // Log the cleaned ID to trace changes
    console.log(`[validateUuid] Cleaned ${paramName}: ${cleanedId}, URL: ${req.originalUrl}`);

    // Validate UUID using uuid library
    if (!validate(cleanedId)) {
      const errorMsg = `Invalid ${paramName}: must be a valid UUID, URL: ${req.originalUrl}, ID: ${id}, Cleaned: ${cleanedId}`;
      console.log(`[validateUuid] ${errorMsg}`);
      return next(new ApiError(400, errorMsg));
    }

    // Update req.params with cleaned ID if necessary
    if (cleanedId !== id) {
      req.params[paramName] = cleanedId;
      console.log(`[validateUuid] Updated ${paramName} to cleaned: ${cleanedId}, URL: ${req.originalUrl}`);
    }

    console.log(`[validateUuid] Valid UUID: ${cleanedId}, URL: ${req.originalUrl}`);
    next();
  };
};