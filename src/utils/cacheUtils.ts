import { getRedisClient } from '../config/redis';
import { logger } from '@sentry/node';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
}

export class CacheService {
  private static instance: CacheService;
  private redisClient: any = null;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private async getClient() {
    if (!this.redisClient) {
      this.redisClient = await getRedisClient();
    }
    return this.redisClient;
  }

  private generateKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);
      
      if (options.ttl) {
        await client.setEx(cacheKey, options.ttl, serializedValue);
      } else {
        await client.set(cacheKey, serializedValue);
      }
      
      logger.debug(`Cache SET: ${cacheKey}`, { ttl: options.ttl });
    } catch (error) {
      logger.error(`Cache SET failed for key ${key}`, { error: String(error) });
    }
  }

  async get<T>(key: string, prefix?: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, prefix);
      const value = await client.get(cacheKey);
      
      if (value) {
        logger.debug(`Cache HIT: ${cacheKey}`);
        return JSON.parse(value) as T;
      }
      
      logger.debug(`Cache MISS: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET failed for key ${key}`, { error: String(error) });
      return null;
    }
  }

  async delete(key: string, prefix?: string): Promise<void> {
    try {
      const client = await this.getClient();
      const cacheKey = this.generateKey(key, prefix);
      await client.del(cacheKey);
      logger.debug(`Cache DELETE: ${cacheKey}`);
    } catch (error) {
      logger.error(`Cache DELETE failed for key ${key}`, { error: String(error) });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const client = await this.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(keys);
        logger.debug(`Cache DELETE PATTERN: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Cache DELETE PATTERN failed for pattern ${pattern}`, { error: String(error) });
    }
  }

  async invalidateProductCache(): Promise<void> {
    await this.deletePattern('product:*');
  }

  async invalidateProductCacheById(productId: string): Promise<void> {
    await this.deletePattern(`product:*:${productId}`);
    await this.deletePattern(`product:${productId}:*`);
  }

  async invalidateVendorProductCache(productOwnerId: string): Promise<void> {
    await this.deletePattern(`vendor:${productOwnerId}:products:*`);
  }

  async invalidateCategoryCache(categoryId?: string): Promise<void> {
    if (categoryId) {
      await this.deletePattern(`category:${categoryId}:products:*`);
    } else {
      await this.deletePattern('category:*:products:*');
    }
  }

  async invalidateCartCache(userId: string): Promise<void> {
    await this.deletePattern(`cart:${userId}*`);
  }
}

export const cacheService = CacheService.getInstance();

export const cacheKeys = {
  product: {
    byId: (id: string) => `product:${id}`,
    list: (params: any) => `product:list:${JSON.stringify(params)}`,
    vendor: (vendorId: string, params: any) => `vendor:${vendorId}:products:${JSON.stringify(params)}`,
    category: (categoryId: string, params: any) => `category:${categoryId}:products:${JSON.stringify(params)}`,
    featured: (limit: number) => `product:featured:${limit}`,
    similar: (productId: string, limit: number) => `product:${productId}:similar:${limit}`,
    search: (query: string, params: any) => `product:search:${query}:${JSON.stringify(params)}`,
    nearby: (userId: string, latitude: number, longitude: number, radius: number, params: any) =>
      `product:nearby:${userId}:${latitude}:${longitude}:${radius}:${JSON.stringify(params)}`,
    zoneAndLocality: (zoneId: string, localityIds: any, params: any) =>
      `product:zone:${zoneId}:localities:${JSON.stringify(localityIds)}:${JSON.stringify(params)}`,
  },
  category: {
    byId: (id: string) => `category:${id}`,
    list: () => 'category:list',
  },
  cart: {
    byUserId: (userId: string) => `cart:${userId}`,
    totals: (userId: string) => `cart:totals:${userId}`,
  }
};

export const CACHE_TTL = {
  PRODUCT: 300,        // 5 minutes - Individual products
  PRODUCT_LIST: 180,   // 3 minutes - Product lists
  PRODUCT_DETAIL: 600, // 10 minutes - Detailed product info
  CATEGORY: 3600,      // 1 hour - Category data
  FEATURED: 900,       // 15 minutes - Featured products
  SEARCH: 120,         // 2 minutes - Search results
  CART: 300,           // 5 minutes - Cart data
} as const;

export const withCache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = CACHE_TTL.PRODUCT_LIST
): Promise<T> => {
  const cached = await cacheService.get<T>(key);
  if (cached) {
    return cached;
  }

  const result = await fn();
  await cacheService.set(key, result, { ttl });
  
  return result;
};

export const testCache = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const testKey = 'test:cache:product';
    const testData = { id: 'test', name: 'Test Product', price: 100 };
    
    await cacheService.set(testKey, testData, { ttl: 60 });
    
    const retrieved = await cacheService.get<typeof testData>(testKey);
    
    if (retrieved && retrieved.id === testData.id) {
      await cacheService.delete(testKey);
      return { success: true, message: 'Cache is working correctly' };
    } else {
      return { success: false, message: 'Cache retrieval failed' };
    }
  } catch (error) {
    return { success: false, message: `Cache test failed: ${String(error)}` };
  }
};