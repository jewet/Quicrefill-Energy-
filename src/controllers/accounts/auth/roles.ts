import { PrismaClient, Role } from "@prisma/client";
import winston from "winston";
import { setCache, getCache, invalidateCache } from "../../../config/redis";

const prisma = new PrismaClient();

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

// Redis cache settings
const ROLES_CACHE_KEY = "roles:all";
const ROLES_CACHE_TTL = 300; // 5 minutes TTL for roles cache

// Function to fetch all roles from the database
async function fetchRolesFromDatabase(): Promise<Role[]> {
  try {
    const roles = await prisma.role.findMany({
      where: { isActive: true }, // Only fetch active roles
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdById: true, // Added to match Prisma Role type
      },
    });
    logger.info("Roles fetched from database", { roleCount: roles.length });
    return roles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to fetch roles from database", { error: errorMessage });
    throw new Error(`Failed to fetch roles: ${errorMessage}`);
  }
}

// Function to fetch all roles, using Redis cache
export async function getAllRoles(): Promise<Role[]> {
  try {
    // Try to get roles from Redis cache
    const cachedRoles = await getCache(ROLES_CACHE_KEY);
    if (cachedRoles) {
      logger.info("Returning cached roles from Redis");
      return JSON.parse(cachedRoles);
    }

    // Fetch roles from database if cache miss
    const roles = await fetchRolesFromDatabase();

    // Store roles in Redis cache
    await setCache(ROLES_CACHE_KEY, JSON.stringify(roles), ROLES_CACHE_TTL);
    logger.info("Roles cached in Redis", { roleCount: roles.length });

    return roles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to fetch or cache roles", { error: errorMessage });
    throw new Error(`Failed to get roles: ${errorMessage}`);
  }
}

// Function to clear the role cache in Redis
export async function clearRoleCache(): Promise<void> {
  try {
    await invalidateCache(ROLES_CACHE_KEY);
    logger.info("Role cache cleared in Redis");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Failed to clear role cache in Redis", { error: errorMessage });
    throw new Error(`Failed to clear role cache: ${errorMessage}`);
  }
}