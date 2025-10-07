import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '.prisma/client';
import { ApiError } from '../../../lib/utils/errors/appError'; // Adjust path to match your ApiError

const prisma = new PrismaClient();

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user; // Adjust type based on your middleware's req.user structure

  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new ApiError(400, 'Invalid user ID format');
    }

    // Fetch authenticated user's role
    const authUser = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      include: { role: true }, // Include role relation
    });

    if (!authUser || !authUser.role) {
      throw new ApiError(403, 'Unauthorized: User or role not found');
    }

    // Allow any authenticated user to access their own data, or ADMIN to access any user
    if (authUser.role.name !== 'ADMIN' && authUser.id !== userId) {
      throw new ApiError(403, 'Unauthorized: You can only access your own user data or require ADMIN role');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
          },
        },
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        emailVerified: true,
        phoneVerified: true,
        identityVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const isNewCustomer = user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    res.status(200).json({
      success: true,
      data: {
        ...user,
        isNewCustomer,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    await prisma.$disconnect();
  }
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authenticatedUser = (req as any).user; // Adjust type based on your middleware's req.user structure
  const { page = '1', limit = '10', role, emailVerified } = req.query;

  try {
    // Fetch authenticated user's role
    const authUser = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      include: { role: true }, // Include role relation
    });

    if (!authUser || !authUser.role) {
      throw new ApiError(403, 'Unauthorized: User or role not found');
    }

    // Restrict access to ADMIN role only
    if (authUser.role.name !== 'ADMIN') {
      throw new ApiError(403, 'Unauthorized: Only ADMIN role can access all users');
    }

    // Parse pagination parameters
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      throw new ApiError(400, 'Invalid pagination parameters');
    }

    // Build query filters
    const where: any = {};
    if (role) {
      // Validate role as a string
      const roleStr = Array.isArray(role) ? role[0] : role;
      if (typeof roleStr !== 'string') {
        throw new ApiError(400, 'Invalid role query parameter: must be a string');
      }

      // Fetch valid roles from the Role table
      const validRoles = await prisma.role.findMany({
        select: { name: true },
      });
      const validRoleNames = validRoles.map((r) => r.name);

      // Validate role against Role table
      if (!validRoleNames.includes(roleStr)) {
        throw new ApiError(400, `Invalid role value. Must be one of: ${validRoleNames.join(', ')}`);
      }
      where.role = { name: roleStr }; // Filter by role.name
    }
    if (emailVerified !== undefined) {
      where.emailVerified = emailVerified === 'true';
    }

    // Fetch users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              createdById: true,
            },
          },
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          emailVerified: true,
          phoneVerified: true,
          identityVerified: true,
          createdAt: true,
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Add isNewCustomer to each user
    const usersWithNewCustomer = users.map((user) => ({
      ...user,
      isNewCustomer: user.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    }));

    res.status(200).json({
      success: true,
      data: {
        users: usersWithNewCustomer,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  } finally {
    await prisma.$disconnect();
  }
};