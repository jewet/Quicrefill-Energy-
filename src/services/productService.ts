import { PrismaClient, Product, ProductStatus, Prisma, VerificationStatus, DocumentStatus } from '@prisma/client';
import { CreateProductInput, UpdateProductInput, ProductQueryInput, VendorProductQueryInput } from '../schemas/product.schema';
import { ApiError } from '../lib/utils/errors/appError';
import { cacheService, cacheKeys, CACHE_TTL } from '../utils/cacheUtils';

const prisma = new PrismaClient();

export class ProductService {
   /**
   * Create a new product with verification checks
   * @param data - Product data
   * @param userId - User ID
   * @returns Created product
   */
  async createProduct(data: CreateProductInput, userId: string): Promise<Product> {
    try {
      // Fetch user with identity and business verification
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          identityVerification: true,
          businessVerification: true,
        },
      });

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Verification checks
      if (!user.identityVerified || !user.businessVerified) {
        throw new ApiError(403, "User must be fully verified to create products");
      }

      if (
        user.identityVerification?.status !== DocumentStatus.VERIFIED ||
        user.businessVerification?.status !== VerificationStatus.APPROVED
      ) {
        throw new ApiError(403, "Identity and business verification must be approved");
      }

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        throw new ApiError(404, "Category not found");
      }

      // Check if product type exists if provided
      if (data.productTypeId) {
        const productType = await prisma.productType.findUnique({
          where: { id: data.productTypeId },
        });
        if (!productType) {
          throw new ApiError(404, "Product type not found");
        }
      }

      // Check if user has appropriate role
      if (!user.roleId) {
        throw new ApiError(403, "User must have a role assigned");
      }

      const userRole = await prisma.role.findUnique({
        where: { id: user.roleId },
      });

      if (!userRole || (userRole.name !== 'ADMIN' && userRole.name !== 'VENDOR')) {
        throw new ApiError(403, "Only Admin and Vendor roles can create products");
      }

      // Set initial status based on role
      const initialStatus = userRole.name === 'ADMIN' ? ProductStatus.APPROVED : ProductStatus.PENDING;

      // Prepare data for creation
      const productData: any = {
        ...data,
        status: initialStatus,
        productOwnerId: userId,
        price: new Prisma.Decimal(data.price.toString()),
        images: data.images || [],
      };

      // Handle optional fields
      if (data.salePrice !== undefined) {
        productData.salePrice = new Prisma.Decimal(data.salePrice.toString());
      }

      if (data.featured !== undefined) {
        productData.featured = data.featured;
      }

      // Create product
      const product = await prisma.product.create({
        data: productData,
        include: {
          category: true,
          productType: true,
        },
      });

      // Invalidate relevant caches
      await cacheService.invalidateProductCache();
      await cacheService.invalidateVendorProductCache(userId);
      if (data.categoryId) {
        await cacheService.invalidateCategoryCache(data.categoryId);
      }

      return product;
    } catch (error) {
      console.error("Product creation error:", error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to create product");
    }
  }

  /**
   * Get all products with filtering, sorting, and pagination
   * @param queryParams - Query parameters
   * @param userId - User ID for verification
   * @returns List of products and total count
   */
  async getAllProducts(queryParams: ProductQueryInput, userId?: string): Promise<{ products: Product[]; totalCount: number }> {
    try {
      // Check user verification if provided
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { identityVerification: true, businessVerification: true },
        });
        if (!user?.identityVerified || !user?.businessVerified) {
          throw new ApiError(403, "User must be verified to view products");
        }
      }

      // Generate cache key based on query parameters
      const cacheKey = cacheKeys.product.list({ ...queryParams });

      // Try to get from cache first
      const cachedResult = await cacheService.get<{ products: Product[]; totalCount: number }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Build the where clause based on query parameters
      const where: any = {};

      // Only show approved products for non-admin/vendor users
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });
        if (!user?.roleId || (user.role?.name !== 'ADMIN' && user.role?.name !== 'VENDOR')) {
          where.status = ProductStatus.APPROVED;
        } else if (queryParams.status) {
          where.status = queryParams.status;
        }
      } else {
        where.status = ProductStatus.APPROVED;
      }

      if (queryParams.categoryId) {
        where.categoryId = queryParams.categoryId;
      }

      if (queryParams.search) {
        where.OR = [
          { name: { contains: queryParams.search, mode: 'insensitive' } },
          { description: { contains: queryParams.search, mode: 'insensitive' } },
        ];
      }

      if (queryParams.brand) {
        where.brand = queryParams.brand;
      }

      if (queryParams.productTypeId) {
        where.productTypeId = queryParams.productTypeId;
      }

      // Price range
      if (queryParams.minPrice || queryParams.maxPrice) {
        where.price = {};
        if (queryParams.minPrice) {
          where.price.gte = queryParams.minPrice;
        }
        if (queryParams.maxPrice) {
          where.price.lte = queryParams.maxPrice;
        }
      }

      // Get total count for pagination
      const totalCount = await prisma.product.count({ where });

      // Fetch products with pagination and sorting
      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
          productType: true,
        },
        take: queryParams.limit,
        skip: (queryParams.page - 1) * queryParams.limit,
        orderBy: {
          [queryParams.sortBy]: queryParams.order,
        },
      });

      const result = { products, totalCount };

      // Cache the result
      await cacheService.set(cacheKey, result, { ttl: CACHE_TTL.PRODUCT_LIST });

      return result;
    } catch (error) {
      console.error("Error details:", error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ApiError(500, `Database error: ${error.message}, code: ${error.code}`);
      }
      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new ApiError(500, `Validation error: ${error.message}`);
      }
      throw new ApiError(500, "Failed to fetch products");
    }
  }

  /**
   * Get product by ID
   * @param id - Product ID
   * @param userId - User ID for verification
   * @returns Product
   */
  async getProductById(id: string, userId?: string): Promise<Product> {
    try {
      // Check user verification if provided
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { identityVerification: true, businessVerification: true },
        });
        if (!user?.identityVerified || !user?.businessVerified) {
          throw new ApiError(403, "User must be verified to view product details");
        }
      }

      const cacheKey = cacheKeys.product.byId(id);
      const cachedProduct = await cacheService.get<Product>(cacheKey);
      if (cachedProduct) {
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true },
          });
          if (!user?.roleId || (user.role?.name !== 'ADMIN' && user.role?.name !== 'VENDOR')) {
            if (cachedProduct.status !== ProductStatus.APPROVED) {
              throw new ApiError(404, "Product not found");
            }
          }
        }
        return cachedProduct;
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          productType: true,
        },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      // If not admin or vendor and product is not approved, don't show it
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });
        if (!user?.roleId || (user.role?.name !== 'ADMIN' && user.role?.name !== 'VENDOR')) {
          if (product.status !== ProductStatus.APPROVED) {
            throw new ApiError(404, "Product not found");
          }
        }
      }

      await cacheService.set(cacheKey, product, { ttl: CACHE_TTL.PRODUCT_DETAIL });

      return product;
    } catch (error) {
      console.error('Error in getProductById:', error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to fetch product");
    }
  }

  /**
   * Get similar products
   * @param productId - Product ID
   * @param limit - Number of products to fetch
   * @returns List of similar products
   */
  async getSimilarProducts(productId: string, limit: number = 5): Promise<Product[]> {
    try {
      const cacheKey = cacheKeys.product.similar(productId, limit);
      const cachedProducts = await cacheService.get<Product[]>(cacheKey);
      if (cachedProducts) {
        return cachedProducts;
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { category: true, productType: true },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      const similarProducts = await prisma.product.findMany({
        where: {
          OR: [
            { categoryId: product.categoryId },
            { productTypeId: product.productTypeId },
          ],
          id: { not: productId },
          status: ProductStatus.APPROVED,
        },
        include: {
          category: true,
          productType: true,
        },
        take: limit,
      });

      await cacheService.set(cacheKey, similarProducts, { ttl: CACHE_TTL.PRODUCT });

      return similarProducts;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to fetch similar products");
    }
  }

  /**
   * Get featured products
   * @param limit - Number of products to fetch
   * @returns List of featured products
   */
  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    try {
      const cacheKey = cacheKeys.product.featured(limit);
      const cachedProducts = await cacheService.get<Product[]>(cacheKey);
      if (cachedProducts) {
        return cachedProducts;
      }

      const featuredProducts = await prisma.product.findMany({
        where: {
          status: ProductStatus.APPROVED,
          featured: true,
        },
        include: {
          category: true,
          productType: true,
        },
        orderBy: [
          { orderCount: 'desc' },
          { rating: 'desc' },
        ],
        take: limit,
      });

      await cacheService.set(cacheKey, featuredProducts, { ttl: CACHE_TTL.FEATURED });

      return featuredProducts;
    } catch (error) {
      throw new ApiError(500, "Failed to fetch featured products");
    }
  }

  /**
   * Get nearby provider products based on user location
   * @param userId - User ID
   * @param latitude - User's latitude
   * @param longitude - User's longitude
   * @param radius - Search radius in kilometers
   * @param queryParams - Query parameters
   * @returns List of nearby products and total count
   */
  async getNearbyProviderProducts(
    userId: string,
    latitude: number,
    longitude: number,
    radius: number,
    queryParams: ProductQueryInput
  ): Promise<{ products: Product[]; totalCount: number }> {
    try {
      // Verify user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { identityVerification: true, businessVerification: true },
      });
      if (!user?.identityVerified || !user?.businessVerified) {
        throw new ApiError(403, "User must be verified to view nearby products");
      }

      const cacheKey = cacheKeys.product.nearby(userId, latitude, longitude, radius, queryParams);
      const cachedResult = await cacheService.get<{ products: Product[]; totalCount: number }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Find nearby services using PostGIS query
      const nearbyServices = await prisma.$queryRaw<
        Array<{ id: string; providerId: string }>
      >`
        SELECT id, providerId
        FROM "Service"
        WHERE ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326),
          ${radius * 1000} -- Convert km to meters
        )
        AND status = 'ACTIVE';
      `;

      const providerIds = nearbyServices.map(service => service.providerId);

      const where: any = {
        status: ProductStatus.APPROVED,
        productOwnerId: { in: providerIds },
      };

      if (queryParams.categoryId) {
        where.categoryId = queryParams.categoryId;
      }

      if (queryParams.productTypeId) {
        where.productTypeId = queryParams.productTypeId;
      }

      if (queryParams.search) {
        where.OR = [
          { name: { contains: queryParams.search, mode: 'insensitive' } },
          { description: { contains: queryParams.search, mode: 'insensitive' } },
        ];
      }

      if (queryParams.brand) {
        where.brand = queryParams.brand;
      }

      if (queryParams.minPrice || queryParams.maxPrice) {
        where.price = {};
        if (queryParams.minPrice) {
          where.price.gte = queryParams.minPrice;
        }
        if (queryParams.maxPrice) {
          where.price.lte = queryParams.maxPrice;
        }
      }

      const totalCount = await prisma.product.count({ where });

      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
          productType: true,
        },
        take: queryParams.limit,
        skip: (queryParams.page - 1) * queryParams.limit,
        orderBy: {
          [queryParams.sortBy]: queryParams.order,
        },
      });

      const result = { products, totalCount };
      await cacheService.set(cacheKey, result, { ttl: CACHE_TTL.PRODUCT_LIST });

      return result;
    } catch (error) {
      console.error("Error in getNearbyProviderProducts:", error);
      throw new ApiError(500, "Failed to fetch nearby provider products");
    }
  }

  /**
   * Get products by zone and locality
   * @param zoneId - Zone ID
   * @param localityIds - Array of locality IDs (LGA/City)
   * @param queryParams - Query parameters
   * @returns List of products and total count
   */
  async getProductsByZoneAndLocality(
    zoneId: string,
    localityIds: { lgaId?: number; cityId?: number }[],
    queryParams: ProductQueryInput
  ): Promise<{ products: Product[]; totalCount: number }> {
    try {
      const cacheKey = cacheKeys.product.zoneAndLocality(zoneId, localityIds, queryParams);
      const cachedResult = await cacheService.get<{ products: Product[]; totalCount: number }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const where: any = {
        status: ProductStatus.APPROVED,
      };

      // Filter by zone
      const zone = await prisma.zone.findUnique({
        where: { id: zoneId },
      });
      if (!zone) {
        throw new ApiError(404, "Zone not found");
      }
      where.productOwnerId = zone.providerId;

      // Filter by localities
      if (localityIds.length > 0) {
        const lgaIds = localityIds.filter(loc => loc.lgaId).map(loc => loc.lgaId!);
        const cityIds = localityIds.filter(loc => loc.cityId).map(loc => loc.cityId!);

        where.OR = [
          ...(lgaIds.length > 0 ? [{ lgaId: { in: lgaIds } }] : []),
          ...(cityIds.length > 0 ? [{ cityId: { in: cityIds } }] : []),
        ];
      }

      if (queryParams.categoryId) {
        where.categoryId = queryParams.categoryId;
      }

      if (queryParams.productTypeId) {
        where.productTypeId = queryParams.productTypeId;
      }

      if (queryParams.search) {
        where.OR = [
          { name: { contains: queryParams.search, mode: 'insensitive' } },
          { description: { contains: queryParams.search, mode: 'insensitive' } },
        ];
      }

      if (queryParams.brand) {
        where.brand = queryParams.brand;
      }

      if (queryParams.minPrice || queryParams.maxPrice) {
        where.price = {};
        if (queryParams.minPrice) {
          where.price.gte = queryParams.minPrice;
        }
        if (queryParams.maxPrice) {
          where.price.lte = queryParams.maxPrice;
        }
      }

      const totalCount = await prisma.product.count({ where });

      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
          productType: true,
        },
        take: queryParams.limit,
        skip: (queryParams.page - 1) * queryParams.limit,
        orderBy: {
          [queryParams.sortBy]: queryParams.order,
        },
      });

      const result = { products, totalCount };
      await cacheService.set(cacheKey, result, { ttl: CACHE_TTL.PRODUCT_LIST });

      return result;
    } catch (error) {
      console.error("Error in getProductsByZoneAndLocality:", error);
      throw new ApiError(500, "Failed to fetch products by zone and locality");
    }
  }

  /**
   * Update product
   * @param id - Product ID
   * @param data - Updated product data
   * @param userId - User ID
   * @returns Updated product
   */
  async updateProduct(id: string, data: UpdateProductInput, userId: string): Promise<Product> {
    try {
      // Verify user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          identityVerification: true,
          businessVerification: true,
          role: true,
        },
      });
      if (!user?.identityVerified || !user?.businessVerified) {
        throw new ApiError(403, "User must be verified to update products");
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          productType: true,
        },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      // Only the vendor who created the product or an admin can update it
      if (!user.roleId || (user.role?.name !== 'ADMIN' && product.productOwnerId !== userId)) {
        throw new ApiError(403, "You don't have permission to update this product");
      }

      // Vendors cannot change the status directly
      if (user.role?.name !== 'ADMIN' && data.status) {
        throw new ApiError(403, "Only admins can change product status");
      }

      // If category is being updated, check if it exists
      if (data.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: data.categoryId },
        });
        if (!category) {
          throw new ApiError(404, "Category not found");
        }
      }

      // If product type is being updated, check if it exists
      if (data.productTypeId) {
        const productType = await prisma.productType.findUnique({
          where: { id: data.productTypeId },
        });
        if (!productType) {
          throw new ApiError(404, "Product type not found");
        }
      }

      // Prepare data for update
      const updateData: any = {
        ...data,
        images: data.images || product.images,
      };

      if (data.price !== undefined) {
        updateData.price = new Prisma.Decimal(data.price.toString());
      }

      if (data.salePrice !== undefined) {
        updateData.salePrice = new Prisma.Decimal(data.salePrice.toString());
      }

      if (user.role?.name === 'VENDOR' && !data.status) {
        updateData.status = ProductStatus.PENDING;
      }

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          productType: true,
        },
      });

      // Invalidate relevant caches
      await cacheService.invalidateProductCacheById(id);
      await cacheService.invalidateVendorProductCache(product.productOwnerId);
      if (product.categoryId) {
        await cacheService.invalidateCategoryCache(product.categoryId);
      }
      if (data.categoryId && data.categoryId !== product.categoryId) {
        await cacheService.invalidateCategoryCache(data.categoryId);
      }

      return updatedProduct;
    } catch (error) {
      console.error("Error in updateProduct:", error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to update product");
    }
  }

  /**
   * Get provider's products
   * @param providerId - Provider ID (Vendor or Admin)
   * @param queryParams - Query parameters
   * @returns List of products and total count
   */
  async getProviderProducts(providerId: string, queryParams: VendorProductQueryInput): Promise<{ products: Product[]; totalCount: number }> {
    try {
      // Verify provider
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        include: { identityVerification: true, businessVerification: true },
      });
      if (!provider?.identityVerified || !provider?.businessVerified) {
        throw new ApiError(403, "Provider must be verified to view their products");
      }

      const cacheKey = cacheKeys.product.vendor(providerId, queryParams);
      const cachedResult = await cacheService.get<{ products: Product[]; totalCount: number }>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const where: any = {
        productOwnerId: providerId,
      };

      if (queryParams.status && queryParams.status !== 'ALL') {
        where.status = queryParams.status;
      }

      if (queryParams.categoryId) {
        where.categoryId = queryParams.categoryId;
      }

      if (queryParams.productTypeId) {
        where.productTypeId = queryParams.productTypeId;
      }

      if (queryParams.search) {
        where.OR = [
          { name: { contains: queryParams.search, mode: 'insensitive' } },
          { description: { contains: queryParams.search, mode: 'insensitive' } },
        ];
      }

      if (queryParams.brand) {
        where.brand = queryParams.brand;
      }

      if (queryParams.minPrice || queryParams.maxPrice) {
        where.price = {};
        if (queryParams.minPrice) {
          where.price.gte = queryParams.minPrice;
        }
        if (queryParams.maxPrice) {
          where.price.lte = queryParams.maxPrice;
        }
      }

      const totalCount = await prisma.product.count({ where });

      const products = await prisma.product.findMany({
        where,
        include: {
          category: true,
          productType: true,
        },
        take: queryParams.limit,
        skip: (queryParams.page - 1) * queryParams.limit,
        orderBy: {
          [queryParams.sortBy]: queryParams.order,
        },
      });

      const result = { products, totalCount };
      await cacheService.set(cacheKey, result, { ttl: CACHE_TTL.PRODUCT_LIST });

      return result;
    } catch (error) {
      console.error("Error in getProviderProducts:", error);
      throw new ApiError(500, "Failed to fetch provider products");
    }
  }

  /**
   * Delete product
   * @param id - Product ID
   * @param userId - User ID
   * @returns Deleted product
   */
  async deleteProduct(id: string, userId: string): Promise<Product> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, identityVerification: true, businessVerification: true },
      });
      if (!user?.identityVerified || !user?.businessVerified) {
        throw new ApiError(403, "User must be verified to delete products");
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          cartItems: true,
          orderItems: true,
          category: true,
          productType: true,
        },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      if (!user.roleId || (user.role?.name !== 'ADMIN' && product.productOwnerId !== userId)) {
        throw new ApiError(403, "You don't have permission to delete this product");
      }

      if (product.orderItems.length > 0) {
        throw new ApiError(400, "Cannot delete product that has been ordered");
      }

      if (product.cartItems.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { productId: id },
        });
      }

      const deletedProduct = await prisma.product.delete({
        where: { id },
        include: {
          category: true,
          productType: true,
        },
      });

      await cacheService.invalidateProductCacheById(id);
      await cacheService.invalidateVendorProductCache(product.productOwnerId);
      if (product.categoryId) {
        await cacheService.invalidateCategoryCache(product.categoryId);
      }

      return deletedProduct;
    } catch (error) {
      console.error("Error in deleteProduct:", error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to delete product");
    }
  }

  /**
   * Update product status (admin only)
   * @param id - Product ID
   * @param status - New status
   * @param userId - User ID
   * @returns Updated product
   */
  async updateProductStatus(id: string, status: ProductStatus, userId: string): Promise<Product> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (!user?.roleId || user.role?.name !== 'ADMIN') {
        throw new ApiError(403, "Only admins can update product status");
      }

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          productType: true,
        },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: { status },
        include: {
          category: true,
          productType: true,
        },
      });

      await cacheService.invalidateProductCacheById(id);
      await cacheService.invalidateVendorProductCache(updatedProduct.productOwnerId);
      if (updatedProduct.categoryId) {
        await cacheService.invalidateCategoryCache(updatedProduct.categoryId);
      }

      return updatedProduct;
    } catch (error) {
      console.error("Error in updateProductStatus:", error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to update product status");
    }
  }

  /**
   * Upload product images
   * @param productId - Product ID
   * @param imageUrls - Array of image URLs to upload
   * @param userId - User ID
   * @returns Updated product
   */
  async uploadProductImages(productId: string, imageUrls: string[], userId: string): Promise<Product> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, identityVerification: true, businessVerification: true },
      });
      if (!user?.identityVerified || !user?.businessVerified) {
        throw new ApiError(403, "User must be verified to upload product images");
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { category: true, productType: true },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      if (!user.roleId || (user.role?.name !== 'ADMIN' && product.productOwnerId !== userId)) {
        throw new ApiError(403, "You don't have permission to update this product's images");
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          images: {
            push: imageUrls,
          },
          status: user.role?.name === 'VENDOR' ? ProductStatus.PENDING : product.status,
        },
        include: {
          category: true,
          productType: true,
        },
      });

      await cacheService.invalidateProductCacheById(productId);
      await cacheService.invalidateVendorProductCache(product.productOwnerId);
      if (product.categoryId) {
        await cacheService.invalidateCategoryCache(product.categoryId);
      }

      return updatedProduct;
    } catch (error) {
      console.error("Error in uploadProductImages:", error);
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to upload product images");
    }
  }
}