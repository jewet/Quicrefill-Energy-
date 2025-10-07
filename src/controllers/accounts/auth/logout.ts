// controllers/logout.ts
import { NextFunction, Request, Response } from "express";
import { setWithExpiry } from "../../../utils/inMemoryStore";
import { prismaClient } from "../../../config/db";
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";

// Interface for the user object attached to the request (aligned with AuthUser)
interface AuthenticatedUser {
  id: string;
  email: string; // Added to match AuthUser requirement
  role?: {
    name: string;
  };
}

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/auth.log" }),
    new winston.transports.Console(),
  ],
});

// Define constant for two hours in seconds
const TWO_HOURS_IN_SECONDS = 2 * 60 * 60;

// Helper to check if role is elevated
const isElevatedRole = (roleName: string): boolean => {
  const elevatedRoles = ["ADMIN", "MANAGER", "SUPERVISOR", "FINANCE_MANAGER"];
  return elevatedRoles.includes(roleName);
};

/**
 * Logs out the user by clearing the JWT cookie, blacklisting the token, and logging the action.
 * Handles VENDOR role with specific audit logging.
 * @param req - Express request object with authenticated user
 * @param res - Express response object
 * @param next - Express next function for error handling
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from cookies or Authorization header
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1] || "";
    const platform = typeof req.query.platform === "string" ? req.query.platform : "app";

    // Get user from request (set by authenticationMiddleware)
    const user = req.user as AuthenticatedUser | undefined;
    const userId = user?.id;
    const userRoleName = user?.role?.name;

    // Check for missing token
    if (!token) {
      logger.info("Logout attempted with no token", { ip: req.ip, platform, userId });
      return HttpResponse.success(res, null, "No active session found", 200);
    }

    // Validate user data
    if (!userId || !userRoleName) {
      logger.warn("Logout attempted with invalid user data", { ip: req.ip, platform });
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return HttpResponse.success(res, null, "Logged out successfully", 200);
    }

    // Fetch migratedToVendor from database for VENDOR role
    let migratedToVendor = false;
    if (userRoleName === "VENDOR") {
      try {
        const dbUser = await prismaClient.user.findUnique({
          where: { id: userId },
          select: { migratedToVendor: true },
        });
        if (!dbUser) {
          logger.warn("User not found in database during logout", { userId, role: userRoleName, platform });
          throw new Error("User not found");
        }
        migratedToVendor = dbUser.migratedToVendor || false;
      } catch (dbError) {
        logger.error("Failed to fetch migratedToVendor", {
          userId,
          role: userRoleName,
          error: dbError instanceof Error ? dbError.message : "Unknown database error",
          platform,
        });
        // Continue with logout even if database fetch fails
      }
    }

    // Blacklist the token
    try {
      await setWithExpiry(`blacklist:${token}`, "true", TWO_HOURS_IN_SECONDS);
      logger.info("Token blacklisted successfully", { userId, role: userRoleName, platform });
    } catch (storeError) {
      logger.error("Failed to blacklist token", {
        userId,
        role: userRoleName,
        error: storeError instanceof Error ? storeError.message : "Unknown error",
        platform,
      });
      // Continue with logout even if blacklisting fails
    }

    // Clear the token cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Log the logout action in AuditLog
    const maskedToken = token.length > 12 ? `${token.slice(0, 8)}...${token.slice(-4)}` : "****";
    try {
      await prismaClient.auditLog.create({
        data: {
          userId,
          action: "LOGOUT",
          entityType: "USER",
          entityId: userId,
          details: {
            platform,
            role: userRoleName,
            migratedToVendor: userRoleName === "VENDOR" ? migratedToVendor : undefined,
            isElevatedRole: isElevatedRole(userRoleName),
            maskedToken,
            ip: req.ip,
          },
        },
      });
      logger.info("Logout audit log created", { userId, role: userRoleName, platform });
    } catch (auditError) {
      logger.error("Failed to create audit log", {
        userId,
        role: userRoleName,
        error: auditError instanceof Error ? auditError.message : "Unknown audit log error",
        platform,
      });
      // Continue with logout even if audit logging fails
    }

    // Send success response
    return HttpResponse.success(res, null, "Logged out successfully", 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Logout error", {
      userId: (req.user as AuthenticatedUser | undefined)?.id,
      role: (req.user as AuthenticatedUser | undefined)?.role?.name,
      error: errorMessage,
      ip: req.ip,
      platform: req.query.platform || "app",
    });
    return HttpResponse.error(res, "Logout failed", 500, errorMessage);
  }
};