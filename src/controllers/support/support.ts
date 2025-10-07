import { Response, NextFunction } from "express";
import { prismaClient } from "../../"; // Adjust path as needed
import { ApiError } from "../../errors/ApiError";
import { ErrorCodes } from "../../errors/errorCodes";
import { AuthUser } from "../../middlewares/authentication"; // Use AuthUser from authentication.ts
import { logger } from "../../utils/logger"; // Adjust import based on your logger setup

// Interface for ContactOption response
interface ContactOptionResponse {
  method: string;
  details: string;
  responseTime?: string;
  businessHours?: string;
}

// Interface for ContactOption creation input
interface CreateContactOptionInput {
  method: string;
  details: string;
  responseTime?: string;
  businessHours?: string;
}

// Extend Request interface
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Middleware to check if user is an admin
export const ensureAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    throw ApiError.forbidden(
      "Only admins can access this endpoint",
      ErrorCodes.FORBIDDEN
    );
  }
  next();
};

// Get Contact Options
export const getContactOptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Log request
    logger.info("Fetching contact options", { userId: req.user?.id });

    // Query the database for active contact options
    const contactOptions = await prismaClient.contactOption.findMany({
      where: {
        isActive: true,
      },
      select: {
        method: true,
        details: true,
        responseTime: true,
        businessHours: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    // Format response
    const response: ContactOptionResponse[] = contactOptions.map((option) => ({
      method: option.method,
      details: option.details,
      responseTime: option.responseTime ?? undefined,
      businessHours: option.businessHours ?? undefined,
    }));

    // Log successful fetch
    logger.info("Successfully fetched contact options", {
      count: contactOptions.length,
    });

    // Send response
    res.status(200).json(response);
  } catch (error) {
    // Log error
    logger.error("Error fetching contact options", { error });

    // Handle known errors
    if (error instanceof ApiError) {
      return next(error);
    }

    // Handle unexpected errors
    next(
      ApiError.internal(
        "Failed to fetch contact options",
        ErrorCodes.INTERNAL_SERVER_ERROR,
        error
      )
    );
  }
};

// Create Contact Option (Admin Only)
export const createContactOption = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Log request
    logger.info("Creating contact option", { userId: req.user?.id });

    // Check if req.body is an object
    if (!req.body || typeof req.body !== 'object') {
      throw ApiError.badRequest(
        "Invalid request body: Expected JSON object",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Safely cast req.body to unknown first, then to CreateContactOptionInput
    const body = req.body as unknown;
    const { method, details, responseTime, businessHours } = body as CreateContactOptionInput;

    // Validate input
    if (!method || typeof method !== 'string') {
      throw ApiError.badRequest(
        "Method is required and must be a string",
        ErrorCodes.BAD_REQUEST
      );
    }

    if (!details || typeof details !== 'string') {
      throw ApiError.badRequest(
        "Details is required and must be a string",
        ErrorCodes.BAD_REQUEST
      );
    }

    if (method.length > 50) {
      throw ApiError.badRequest(
        "Method must not exceed 50 characters",
        ErrorCodes.BAD_REQUEST
      );
    }

    if (responseTime && (typeof responseTime !== 'string' || responseTime.length > 100)) {
      throw ApiError.badRequest(
        "Response time must be a string and not exceed 100 characters",
        ErrorCodes.BAD_REQUEST
      );
    }

    if (businessHours && (typeof businessHours !== 'string' || businessHours.length > 100)) {
      throw ApiError.badRequest(
        "Business hours must be a string and not exceed 100 characters",
        ErrorCodes.BAD_REQUEST
      );
    }

    // Create contact option in the database
    const contactOption = await prismaClient.contactOption.create({
      data: {
        method,
        details,
        responseTime,
        businessHours,
        isActive: true,
      },
      select: {
        id: true,
        method: true,
        details: true,
        responseTime: true,
        businessHours: true,
        createdAt: true,
      },
    });

    // Log successful creation
    logger.info("Successfully created contact option", {
      contactOptionId: contactOption.id,
      method: contactOption.method,
    });

    // Format response
    const response: ContactOptionResponse = {
      method: contactOption.method,
      details: contactOption.details,
      responseTime: contactOption.responseTime ?? undefined,
      businessHours: contactOption.businessHours ?? undefined,
    };

    // Send response
    res.status(201).json(response);
  } catch (error) {
    // Log error
    logger.error("Error creating contact option", { error });

    // Handle known errors
    if (error instanceof ApiError) {
      return next(error);
    }

    // Handle unexpected errors
    next(
      ApiError.internal(
        "Failed to create contact option",
        ErrorCodes.INTERNAL_SERVER_ERROR,
        error
      )
    );
  }
};