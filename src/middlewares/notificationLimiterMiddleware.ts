import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../config/redis";

export const notificationLimiter = async (
  req: Request,
  _res: Response, 
  next: NextFunction
) => {
  try {
    const redis = await getRedisClient();
    const key = `rate-limit:${req.ip}`;
    const count = await redis.incr(key);
    await redis.expire(key, 60); // 1-minute TTL
    if (count > 100) {
      return next(new Error("Rate limit exceeded"));
    }
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error("Unknown error"));
  }
};