import { Request, Response, NextFunction } from 'express';
import { cacheService, cacheKeys, CACHE_TTL } from '../utils/cacheUtils';

export interface CacheMiddlewareOptions {
  ttl?: number;
  key?: string | ((req: Request) => string);
  condition?: (req: Request) => boolean;
}

/**
 * Cache middleware for Express routes
 * @param options - Cache options
 * @returns Express middleware function
 */
export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching should be skipped based on condition
    if (options.condition && !options.condition(req)) {
      return next();
    }

    try {
      // Generate cache key
      let cacheKey: string;
      if (typeof options.key === 'function') {
        cacheKey = options.key(req);
      } else if (options.key) {
        cacheKey = options.key;
      } else {
        // Default cache key based on URL and query params
        cacheKey = `route:${req.originalUrl}`;
      }

      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Store original send method
      const originalSend = res.json;

      // Override send method to cache the response
      res.json = function (data: any) {
        // Cache the response
        cacheService.set(cacheKey, data, { ttl: options.ttl || CACHE_TTL.PRODUCT_LIST });

        // Call original send method
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      // If caching fails, continue without cache
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Cache middleware specifically for product routes
 */
export const productCacheMiddleware = cacheMiddleware({
  ttl: CACHE_TTL.PRODUCT_LIST,
  key: (req: Request) => {
    const params = { ...req.query, path: req.path };
    return cacheKeys.product.list(params); // Use cacheKeys.product.list
  },
  condition: (req: Request) => {
    // Only cache for certain product routes
    return req.path.startsWith('/api/customer/products') || req.path.startsWith('/api/product');
  },
});

/**
 * Cache middleware for featured products
 */
export const featuredProductsCacheMiddleware = cacheMiddleware({
  ttl: CACHE_TTL.FEATURED,
  key: (req: Request) => {
    const limit = Number(req.query.limit) || 10;
    return cacheKeys.product.featured(limit); // Use cacheKeys.product.featured
  },
});

/**
 * Cache middleware for product details
 */
export const productDetailCacheMiddleware = cacheMiddleware({
  ttl: CACHE_TTL.PRODUCT_DETAIL,
  key: (req: Request) => {
    const productId = req.params.id;
    return cacheKeys.product.byId(productId); // Use cacheKeys.product.byId
  },
});