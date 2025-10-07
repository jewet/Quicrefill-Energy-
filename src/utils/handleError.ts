
import * as Sentry from '@sentry/node'; // Example: Logging errors to Sentry
import { captureLogs } from './logger'; // Assuming you have a logger utility to capture logs
import { ENV } from '../config/env'; // Assuming environment variables are in this config

// In-memory cache to handle rate limiting for Sentry error submissions
const sentryErrorCache: Set<string> = new Set();
const ERROR_LIMIT_TIMEFRAME = 60 * 1000; // 1 minute (can be adjusted)

// Helper function to mask sensitive data
const maskSensitiveData = (error: any): any => {
  // Masking example: Replace passwords or PII
  if (error?.message) {
    error.message = error.message.replace(/password=[^&]+/gi, 'password=*****'); // Example regex for password masking
  }
  return error;
};

// Check if we are in production environment
const isProduction = ENV.NODE_ENV === 'production';

// Helper function for rate limiting (for Sentry error submissions)
const shouldSubmitToSentry = (error: any): boolean => {
  const errorKey = JSON.stringify(error); // Create a unique key for each error type

  // Check if this error has already been reported in the past 60 seconds
  if (sentryErrorCache.has(errorKey)) {
    return false; // Skip submitting to Sentry if the error was already submitted
  }

  // Add to the cache and set a timeout to expire after 1 minute
  sentryErrorCache.add(errorKey);
  setTimeout(() => sentryErrorCache.delete(errorKey), ERROR_LIMIT_TIMEFRAME);

  return true;
};

// Handle errors professionally, with structured logging, sensitive data masking, and alerting
export const handleError = (message: string, error: any): void => {
  // Mask sensitive data before logging or reporting errors
  const sanitizedError = maskSensitiveData(error);

  // Structured logging
  const logMessage = {
    message: message,
    error: sanitizedError?.message || 'Unknown error',
    stack: isProduction ? null : sanitizedError?.stack || 'No stack trace', // Don't log stack in production
    timestamp: new Date().toISOString(),
  };

  // Log the error to a logging service (e.g., Sentry, LogRocket, etc.)
  try {
    // Rate-limit the number of errors submitted to Sentry
    if (isProduction && shouldSubmitToSentry(sanitizedError)) {
      // Log the error to Sentry for monitoring and alerting
      Sentry.captureException(sanitizedError);
    }

    // Capture the log locally or to an external logging service
    captureLogs(logMessage);

    // Optionally, send alerts (e.g., email, Slack) based on the severity or environment

  } catch (loggingError) {
    // Fallback for errors while logging the original error
    console.error('Error while logging the error: ', loggingError);
  }

  // Finally, log the error to the console (can be removed in production)
  if (!isProduction) {
    console.error(message, sanitizedError);
  }
};
