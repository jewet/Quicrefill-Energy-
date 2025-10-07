import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiError } from '../lib/utils/errors/appError';

const prisma = new PrismaClient();

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      return next(new ApiError(401, 'Not authenticated', 'auth/unauthorized'));
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'You do not have permission to perform this action', 'auth/forbidden')
      );
    }

    next();
  };
};

export const isServiceOwnerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', 'auth/unauthorized'));
    }

    const serviceId = req.params.id || req.params.serviceId;

    if (!serviceId) {
      return next(ApiError.badRequest('Service ID is required', 'server/bad-request'));
    }

    // Admin has access to all services
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // For non-admins, check service ownership
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return next(ApiError.notFound('Service not found', 'server/not-found'));
    }

    if (service.providerRole !== req.user.role) {
      return next(ApiError.forbidden(
        'You do not have permission to access this service',
        'auth/forbidden'
      ));
    }

    next();
  } catch (error) {
    next(error);
  }
};