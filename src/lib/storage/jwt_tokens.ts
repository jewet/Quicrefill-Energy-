import { AppErrorCode } from '../../exceptions/root';
import { UnauthorizedRequest } from '../../exceptions/unauthorizedRequests';
import { getRedisClient } from '../../config/redis';
import { ACCESS_TOKEN_EXPIRES_IN } from '../utils/jwt/generateTokenPair';
import winston from 'winston';
import { ENV } from '../../config/env';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Initialize logger
const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: `${ENV.LOG_DIR || './logs'}/customer-error.log`,
      level: 'error',
    }),
    new winston.transports.File({
      filename: `${ENV.LOG_DIR || './logs'}/customer-combined.log`,
    }),
  ],
});

if (ENV.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

// Configurable Redis command timeout (in milliseconds)
const REDIS_COMMAND_TIMEOUT = parseInt(ENV.REDIS_COMMAND_TIMEOUT || '2000', 10); // 2s for faster retries

// Type guard for Redis-specific errors
interface RedisError extends Error {
  code?: string;
}

const isRedisError = (error: unknown): error is RedisError => {
  return error instanceof Error && 'code' in error;
};

/**
 * Stores a hashed access token in Redis for a given user with retry logic.
 */
export const storeAccessToken = async (accessToken: string, userId: string, retries: number = 3): Promise<void> => {
  // Validate inputs
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    logger.error('Invalid userId provided', { userId });
    throw new UnauthorizedRequest('Invalid user ID', AppErrorCode.INVALID_TOKEN);
  }
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
    logger.error('Invalid accessToken provided', { userId });
    throw new UnauthorizedRequest('Invalid access token', AppErrorCode.INVALID_TOKEN);
  }

  // Validate JWT format
  if (!accessToken.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
    logger.error('Malformed token provided for storage', { userId, accessToken: accessToken.slice(0, 10) + '...' });
    throw new UnauthorizedRequest('Malformed token', AppErrorCode.INVALID_TOKEN);
  }

  // Decode and validate payload
  const decoded = jwt.decode(accessToken, { complete: true }) as { payload: { userId: string; iat?: number; exp?: number } } | null;
  if (!decoded || !decoded.payload || decoded.payload.userId !== userId || typeof decoded.payload.iat !== 'number' || typeof decoded.payload.exp !== 'number') {
    logger.error('Invalid token payload', { userId, decoded });
    throw new UnauthorizedRequest('Invalid token payload', AppErrorCode.INVALID_TOKEN);
  }
  logger.debug('Token payload validated', { userId, payload: decoded.payload });

  const key = `user:access-token:${userId}`;
  // Hash the access token
  const hashedToken = await bcrypt.hash(accessToken, 10);
  logger.debug('Storing hashed access token in Redis', {
    userId,
    key,
    hashedTokenLength: hashedToken.length,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN - 120,
  });

  const redis = await getRedisClient(); // Added await
  const start = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    logger.debug(`Attempt ${attempt}/${retries} to store hashed access token`, { userId, key });
    try {
      if (!redis.isOpen || !redis.isReady) {
        logger.warn('Redis client not ready, attempting to reconnect', {
          userId,
          key,
          isOpen: redis.isOpen,
          isReady: redis.isReady,
        });
        await redis.connect();
      }

      // Use Redis MULTI for atomic operation
      const multi = redis.multi();
      multi.set(key, hashedToken, { EX: ACCESS_TOKEN_EXPIRES_IN - 120 });
      const result = await Promise.race([
        multi.exec(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Redis MULTI operation timed out after ${REDIS_COMMAND_TIMEOUT}ms`)), REDIS_COMMAND_TIMEOUT)
        ),
      ]);

      const duration = Date.now() - start;
      logger.info('Hashed access token stored successfully', { userId, key, result, duration, attempt });

      // Check for blocked clients
      const info = await redis.info('CLIENTS');
      const blockedClients = info.match(/blocked_clients:(\d+)/)?.[1] || '0';
      if (parseInt(blockedClients) > 0) {
        const clientList = await redis.sendCommand(['CLIENT', 'LIST']);
        logger.warn('Detected blocked clients after storing token', {
          userId,
          blockedClients,
          clientList: clientList ? String(clientList) : 'unknown',
        });
      }

      return;
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Attempt ${attempt}/${retries} failed to store hashed access token`, {
        userId,
        key,
        duration,
        attempt,
        error: errMsg,
        code: isRedisError(error) ? error.code : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (attempt === retries) {
        throw new Error(`Failed to store hashed access token after ${retries} attempts: ${errMsg}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
};

/**
 * Verifies if an access token exists in Redis for a given user.
 * Returns the hashed token for bcrypt comparison.
 */
export const verifyAccessToken = async (userId: string): Promise<string | null> => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    logger.error('Invalid userId provided for verification', { userId });
    throw new UnauthorizedRequest('Invalid user ID', AppErrorCode.INVALID_TOKEN);
  }

  const key = `user:access-token:${userId}`;
  logger.debug('Verifying access token in Redis', { userId, key });

  const redis = await getRedisClient(); // Added await
  const start = Date.now();

  if (!redis.isOpen || !redis.isReady) {
    logger.warn('Redis client not ready for verifyAccessToken', {
      userId,
      key,
      isOpen: redis.isOpen,
      isReady: redis.isReady,
    });
    try {
      await redis.connect();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to reconnect Redis client', { userId, key, error: errMsg });
      throw new Error(`Redis client reconnection failed: ${errMsg}`);
    }
  }

  try {
    const exists = await Promise.race([
      redis.exists(key),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Redis EXISTS operation timed out after ${REDIS_COMMAND_TIMEOUT}ms`)), REDIS_COMMAND_TIMEOUT)
      ),
    ]);

    if (!exists) {
      logger.warn('Access token not found in Redis', { userId, key });
      return null;
    }

    const hashedAccessToken = await Promise.race<string | null>([
      redis.get(key),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Redis GET operation timed out after ${REDIS_COMMAND_TIMEOUT}ms`)), REDIS_COMMAND_TIMEOUT)
      ),
    ]);

    if (!hashedAccessToken) {
      logger.warn('Access token retrieved but empty', { userId, key });
      return null;
    }

    const duration = Date.now() - start;
    logger.info('Hashed access token retrieved successfully', { userId, key, tokenLength: hashedAccessToken.length, duration });

    const info = await redis.info('CLIENTS');
    const blockedClients = info.match(/blocked_clients:(\d+)/)?.[1] || '0';
    if (parseInt(blockedClients) > 0) {
      const clientList = await redis.sendCommand(['CLIENT', 'LIST']);
      logger.warn('Detected blocked clients after verifying token', {
        userId,
        blockedClients,
        clientList: clientList ? String(clientList) : 'unknown',
      });
    }

    return hashedAccessToken;
  } catch (error: unknown) {
    const duration = Date.now() - start;
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to verify access token in Redis', {
      userId,
      key,
      duration,
      error: errMsg,
      code: isRedisError(error) ? error.code : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

/**
 * Tests Redis performance by performing multiple SET operations.
 */
export const testRedisPerformance = async (): Promise<void> => {
  logger.info('Starting Redis performance test...');
  const redis = await getRedisClient(); // Added await
  const start = Date.now();

  if (!redis.isOpen || !redis.isReady) {
    logger.warn('Redis client not ready for performance test', {
      isOpen: redis.isOpen,
      isReady: redis.isReady,
    });
    try {
      await redis.connect();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Failed to reconnect Redis client for performance test', { error: errMsg });
      throw new Error(`Redis client reconnection failed: ${errMsg}`);
    }
  }

  try {
    for (let i = 0; i < 100; i++) {
      const key = `test:${i}`;
      await Promise.race([
        redis.set(key, `value-${i}`, { EX: 3600 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Redis SET operation timed out after ${REDIS_COMMAND_TIMEOUT}ms`)), REDIS_COMMAND_TIMEOUT)
        ),
      ]);
    }
    const duration = Date.now() - start;
    logger.info('Redis performance test completed: Set 100 keys successfully', { duration });

    const info = await redis.info('CLIENTS');
    const blockedClients = info.match(/blocked_clients:(\d+)/)?.[1] || '0';
    if (parseInt(blockedClients) > 0) {
      const clientList = await redis.sendCommand(['CLIENT', 'LIST']);
      logger.warn('Detected blocked clients after performance test', {
        blockedClients,
        clientList: clientList ? String(clientList) : 'unknown',
      });
    }
  } catch (error: unknown) {
    const duration = Date.now() - start;
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Redis performance test failed', {
      duration,
      error: errMsg,
      code: isRedisError(error) ? error.code : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Redis performance test failed: ${errMsg}`);
  }
};