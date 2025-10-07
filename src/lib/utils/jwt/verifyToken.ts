// user-service/src/lib/utils/jwt/verifyToken.ts
import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from '../../../secrets';
import { UnauthorizedRequest } from '../../../exceptions/unauthorizedRequests';
import { AppErrorCode } from '../../../exceptions/root';
import { accessTokenPayload } from '../../types/payload';
import { verifyAccessToken } from '../../storage/jwt_tokens';
import bcrypt from 'bcryptjs';
import logger from '../../../config/logger';
import crypto from 'crypto';

export const verifyToken = async (
  token: string,
  type: 'access' | 'refresh' = 'access'
): Promise<accessTokenPayload> => {
  // Validate token presence and format
  if (!token || typeof token !== 'string' || token.trim() === '') {
    logger.error('Token is missing or invalid', { token: token ? token.slice(0, 10) + '...' : 'undefined' });
    throw new UnauthorizedRequest('Missing or invalid token', AppErrorCode.INVALID_TOKEN);
  }

  // Validate JWT format (three base64 parts separated by dots)
  if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
    logger.error('Malformed token format', { token: token.slice(0, 10) + '...' });
    throw new UnauthorizedRequest('Malformed token', AppErrorCode.INVALID_TOKEN);
  }

  const secret = type === 'access' ? JWT_ACCESS_SECRET : JWT_REFRESH_SECRET;
  if (!secret) {
    logger.error('JWT secret not configured', { type, secretLength: secret?.length || 0 });
    throw new UnauthorizedRequest('Server configuration error', AppErrorCode.INVALID_TOKEN);
  }

  try {
    logger.info(`Verifying ${type} token`, {
      token: token.slice(0, 10) + '...',
      secretLength: secret.length,
      secretHash: crypto.createHash('sha256').update(secret).digest('hex'),
    });

    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.error('Invalid token structure: incorrect number of parts', { partsLength: parts.length });
      throw new UnauthorizedRequest('Invalid token structure', AppErrorCode.INVALID_TOKEN);
    }

    // Decode payload safely
    let payload: accessTokenPayload;
    try {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      payload = JSON.parse(payloadJson);

      // Validate payload structure
      if (!payload.userId || !payload.email || !payload.role) {
        logger.error('Incomplete payload', { payload });
        throw new UnauthorizedRequest('Missing required payload fields', AppErrorCode.INVALID_TOKEN);
      }

      // Validate iat and exp as numbers
      if (typeof payload.iat !== 'number' || isNaN(payload.iat) || typeof payload.exp !== 'number' || isNaN(payload.exp)) {
        logger.error('Invalid iat or exp in payload', { iat: payload.iat, exp: payload.exp });
        throw new UnauthorizedRequest('Invalid timestamp format', AppErrorCode.INVALID_TOKEN);
      }
    } catch (decodeError: any) {
      logger.error('Failed to parse token payload', {
        error: decodeError.message,
        token: token.slice(0, 10) + '...',
      });
      throw new UnauthorizedRequest('Invalid token payload', AppErrorCode.INVALID_TOKEN);
    }

    // Verify token signature
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as accessTokenPayload & {
      iat: number;
      exp: number;
    };

    // Additional verification for access tokens
    if (type === 'access') {
      try {
        const hashedAccessToken = await verifyAccessToken(decoded.userId);
        logger.info('Hashed token from Redis', { userId: decoded.userId, found: !!hashedAccessToken });

        if (!hashedAccessToken) {
          logger.warn('No token found in Redis', { userId: decoded.userId });
          throw new UnauthorizedRequest('Token not found in storage', AppErrorCode.INVALID_TOKEN);
        }

        const isMatch = await bcrypt.compare(token, hashedAccessToken);
        if (!isMatch) {
          logger.warn('Token mismatch in Redis', { userId: decoded.userId });
          throw new UnauthorizedRequest('Invalid token', AppErrorCode.INVALID_TOKEN);
        }

        logger.info('Token verified successfully', { userId: decoded.userId });
      } catch (redisError) {
        logger.error('Redis verification error', { error: redisError });
        logger.warn('Proceeding with valid signature due to Redis error');
      }
    }

    return decoded;
  } catch (err: any) {
    logger.error('JWT verification error', {
      error: err.message,
      token: token.slice(0, 10) + '...',
      decoded: jwt.decode(token, { complete: true }) || 'decode failed',
      secretLength: secret.length,
      secretHash: crypto.createHash('sha256').update(secret).digest('hex'),
    });

    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedRequest('Token expired', AppErrorCode.TOKEN_EXPIRED);
    } else if (err.name === 'JsonWebTokenError') {
      throw new UnauthorizedRequest('Invalid token', AppErrorCode.INVALID_TOKEN);
    } else if (err instanceof SyntaxError) {
      throw new UnauthorizedRequest('Malformed token payload', AppErrorCode.INVALID_TOKEN);
    }

    throw new UnauthorizedRequest(
      err.message || 'Invalid token',
      AppErrorCode.INVALID_TOKEN
    );
  }
};