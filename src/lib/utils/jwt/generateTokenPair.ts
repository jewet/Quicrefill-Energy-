// src/lib/utils/jwt/generateTokenPair.ts
import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from '../../../secrets';
import { accessTokenPayload } from '../../types/payload';
import { storeAccessToken } from '../../storage/jwt_tokens';
import { verifyToken } from './verifyToken';

// Token expiration times
export const ACCESS_TOKEN_EXPIRES_IN = 60 * 60; // 1 hour
export const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24; // 1 day

export const generateTokenPair = async (payload: accessTokenPayload) => {
  console.log('generateTokenPair started with payload:', payload);

  // Validate secrets
  if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
    console.error('JWT secrets not configured:', {
      accessSecret: JWT_ACCESS_SECRET ? 'Set' : 'Not set',
      refreshSecret: JWT_REFRESH_SECRET ? 'Set' : 'Not set',
    });
    throw new Error('JWT secrets not configured');
  }

  // Validate payload
  if (!payload.userId || !payload.email || !payload.role) {
    console.error('Invalid payload:', payload);
    throw new Error('Missing required payload fields');
  }

  // Sanitize payload, include contextRole if present
  const sanitizedPayload: accessTokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role, // Role enum is string at runtime (e.g., "DELIVERY_REP")
    contextRole: payload.contextRole, // Include contextRole
  };
  console.log('Sanitized payload:', sanitizedPayload);

  try {
    // Generate access token
    console.log('Generating access token...');
    const accessToken = jwt.sign(sanitizedPayload, JWT_ACCESS_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      algorithm: 'HS256',
    });
    const decodedAccessToken = jwt.decode(accessToken, { complete: true });
    console.log('Decoded access token payload:', decodedAccessToken);

    // Generate refresh token
    console.log('Generating refresh token...');
    const refreshToken = jwt.sign(sanitizedPayload, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      algorithm: 'HS256',
    });
    const decodedRefreshToken = jwt.decode(refreshToken, { complete: true });
    console.log('Decoded refresh token payload:', decodedRefreshToken);

    // Store access token
    console.log('Storing access token...');
    await storeAccessToken(accessToken, payload.userId);
    console.log('Access token stored');

    return {
      accessToken,
      refreshToken,
    };
  } catch (err: any) {
    console.error('Token generation error:', err.message);
    throw new Error('Failed to generate tokens');
  }
};

export const generateAccessToken = async (refreshToken: string) => {
  console.log('generateAccessToken started with refreshToken:', refreshToken.slice(0, 10) + '...');

  // Validate refresh token format
  if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
    console.error('Invalid refresh token format:', refreshToken);
    throw new Error('Invalid refresh token format');
  }

  // Verify refresh token
  const payload = await verifyToken(refreshToken, 'refresh');
  console.log('Verified refresh token payload:', payload);

  // Validate payload
  if (!payload.userId || !payload.email || !payload.role) {
    console.error('Invalid payload from refresh token:', payload);
    throw new Error('Invalid refresh token payload');
  }

  // Generate new access token, include contextRole
  const newPayload: accessTokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role, // Preserve Role enum value
    contextRole: payload.contextRole, // Include contextRole from refresh token
  };
  console.log('Generating new access token...');
  const accessToken = jwt.sign(newPayload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    algorithm: 'HS256',
  });
  console.log('New access token generated:', accessToken.slice(0, 10) + '...');

  // Store access token
  console.log('Storing new access token...');
  await storeAccessToken(accessToken, payload.userId);
  console.log('New access token stored');

  return { accessToken };
};