import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../../services/productService';
import { createProductSchema, updateProductSchema, productQuerySchema, vendorProductQuerySchema } from '../../schemas/product.schema';
import { ApiError } from '../../lib/utils/errors/appError';
import { ProductStatus } from '@prisma/client';

const productService = new ProductService();

export class ProductController {
  /**
   * Create a new product
   */
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      const validatedData = createProductSchema.parse(req.body);
      const product = await productService.createProduct(validatedData, req.user.id);

      res.status(201).json({
        status: 'success',
        data: product,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to create product: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while creating product'));
      }
    }
  }

  /**
   * Get all products
   */
  async getAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryParams = productQuerySchema.parse(req.query);
      const userId = req.user?.id;

      const { products, totalCount } = await productService.getAllProducts(queryParams, userId);
      const totalPages = Math.ceil(totalCount / queryParams.limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching products'));
      }
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const product = await productService.getProductById(id, userId);

      res.status(200).json({
        status: 'success',
        data: product,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch product: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching product'));
      }
    }
  }

  /**
   * Get similar products
   */
  async getSimilarProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

      const products = await productService.getSimilarProducts(id, limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch similar products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching similar products'));
      }
    }
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const products = await productService.getFeaturedProducts(limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch featured products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching featured products'));
      }
    }
  }

  /**
   * Get nearby provider products
   */
  async getNearbyProviderProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      const queryParams = productQuerySchema.parse(req.query);
      const { latitude, longitude, radius } = req.query;

      if (!latitude || !longitude || !radius) {
        throw new ApiError(400, 'Latitude, longitude, and radius are required');
      }

      const { products, totalCount } = await productService.getNearbyProviderProducts(
        req.user.id,
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        parseFloat(radius as string),
        queryParams
      );
      const totalPages = Math.ceil(totalCount / queryParams.limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch nearby products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching nearby products'));
      }
    }
  }

  /**
   * Get products by zone and locality
   */
  async getProductsByZoneAndLocality(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryParams = productQuerySchema.parse(req.query);
      const { zoneId, localityIds } = req.query;

      if (!zoneId || !localityIds) {
        throw new ApiError(400, 'Zone ID and locality IDs are required');
      }

      const parsedLocalityIds = typeof localityIds === 'string' ? JSON.parse(localityIds) : localityIds;

      const { products, totalCount } = await productService.getProductsByZoneAndLocality(zoneId as string, parsedLocalityIds, queryParams);
      const totalPages = Math.ceil(totalCount / queryParams.limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch products by zone and locality: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching products by zone and locality'));
      }
    }
  }

  /**
   * Update product
   */
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      const { id } = req.params;
      const validatedData = updateProductSchema.parse(req.body);

      const product = await productService.updateProduct(id, validatedData, req.user.id);

      res.status(200).json({
        status: 'success',
        data: product,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to update product: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while updating product'));
      }
    }
  }

  /**
   * Search products
   */
  async searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.q as string | undefined;

      if (!search) {
        throw new ApiError(400, 'Search query is required');
      }

      const queryParams = productQuerySchema.parse({
        ...req.query,
        search,
        status: req.user?.role === 'ADMIN' || req.user?.role === 'VENDOR' ? req.query.status : ProductStatus.APPROVED,
      });

      const userId = req.user?.id;
      const { products, totalCount } = await productService.getAllProducts(queryParams, userId);
      const totalPages = Math.ceil(totalCount / queryParams.limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to search products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while searching products'));
      }
    }
  }

  /**
   * Get all approved products (public)
   */
  async getApprovedProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryParams = productQuerySchema.parse({
        ...req.query,
        status: ProductStatus.APPROVED,
      });

      const { products, totalCount } = await productService.getAllProducts(queryParams);
      const totalPages = Math.ceil(totalCount / queryParams.limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch approved products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching approved products'));
      }
    }
  }

  /**
   * Get all products simple (for debugging)
   */
  async getAllProductsSimple(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await productService.getAllProducts({ page: 1, limit: 10, sortBy: 'createdAt', order: 'desc' });

      res.status(200).json({
        status: 'success',
        results: products.products.length,
        data: products.products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching products'));
      }
    }
  }

  /**
   * Get all products created by the vendor
   */
  async getVendorProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      if (req.user.role !== 'VENDOR') {
        throw new ApiError(403, 'Only vendors can access this endpoint');
      }

      const queryParams = vendorProductQuerySchema.parse(req.query);
      const { products, totalCount } = await productService.getProviderProducts(req.user.id, queryParams);
      const totalPages = Math.ceil(totalCount / queryParams.limit);

      res.status(200).json({
        status: 'success',
        results: products.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: products,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to fetch vendor products: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while fetching vendor products'));
      }
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      const { id } = req.params;

      await productService.deleteProduct(id, req.user.id);

      res.status(204).send();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to delete product: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while deleting product'));
      }
    }
  }

  /**
   * Update product status (admin only)
   */
  async updateProductStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(ProductStatus).includes(status)) {
        throw new ApiError(400, 'Invalid status');
      }

      const product = await productService.updateProductStatus(id, status, req.user.id);

      res.status(200).json({
        status: 'success',
        data: product,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to update product status: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while updating product status'));
      }
    }
  }

  /**
   * Upload product images
   */
  async uploadProductImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Not authenticated');
      }

      const { id } = req.params;
      const { imageUrls } = req.body;

      if (!Array.isArray(imageUrls) || imageUrls.some(url => typeof url !== 'string')) {
        throw new ApiError(400, 'imageUrls must be an array of strings');
      }

      const product = await productService.uploadProductImages(id, imageUrls, req.user.id);

      res.status(200).json({
        status: 'success',
        data: product,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
      } else if (error instanceof Error) {
        next(new ApiError(500, `Failed to upload product images: ${error.message}`));
      } else {
        next(new ApiError(500, 'Unknown error occurred while uploading product images'));
      }
    }
  }
}