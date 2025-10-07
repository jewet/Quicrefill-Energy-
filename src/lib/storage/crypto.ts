import { AppErrorCode } from "../../exceptions/root";
import { UnauthorizedRequest } from "../../exceptions/unauthorizedRequests";
import { getRedisClient } from "../../config/redis";

export const storeCryptoHash = async (key: string, hash: string) => {
    const redis = await getRedisClient(); // Await the Redis client
    await redis.set(key, hash, { EX: 60 * 20 }); // 20 minutes
};

export const getCryptoHash = async (key: string) => {
    const redis = await getRedisClient(); // Await the Redis client
    if (await redis.exists(key)) {
        return await redis.get(key);
    }
    throw new UnauthorizedRequest("invalid reset token", AppErrorCode.INVALID_TOKEN);
};

export const deleteCryptoHash = async (key: string) => {
    const redis = await getRedisClient(); // Await the Redis client
    await redis.del(key);
};