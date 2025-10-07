// src/services/cart.service.ts
import { PrismaClient, Cart, CartItem, ProductStatus, Prisma } from '@prisma/client';
import { AddToCartInput, UpdateCartItemInput } from '../schemas/cart.schema';
import { ApiError } from '../lib/utils/errors/appError';
import { cacheService, cacheKeys, CACHE_TTL } from '../utils/cacheUtils';

const prisma = new PrismaClient();

export class CartService {
  /**
   * Get user's cart with items
   * If no cart exists, create a new one
   * Filter out cart items with non-approved products
   * @param userId - User ID
   * @returns Cart with items
   * @throws ApiError
   * @async
   * @function getUserCart
   * @memberof CartService
   * @instance
   * @inner
   * @public
   * @this CartService
   * @variation 1
   * @param userId
   * @returns Cart & { items: (CartItem & { product: any })[] }
   */
  async getUserCart(userId: string): Promise<Cart & { items: (CartItem & { product: any })[] }> {
    try {
      // Try to get from cache first
      const cacheKey = cacheKeys.cart.byUserId(userId);
      const cachedCart = await cacheService.get<Cart & { items: (CartItem & { product: any })[] }>(cacheKey);
      if (cachedCart) {
        return cachedCart;
      }

      // Find existing cart or create new one
      let cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
      });

      // If no cart exists, create one
      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId,
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        });
      }

      // Filter out cart items with non-approved products
      cart.items = cart.items.filter((item: CartItem & { product: { status: ProductStatus } }) => 
        item.product.status === ProductStatus.APPROVED
      );

      // Cache the cart
      await cacheService.set(cacheKey, cart, { ttl: CACHE_TTL.CART });

      return cart;
    } catch (error) {
      throw new ApiError(500, "Failed to fetch cart");
    }
  }

  /**
   * Add item to cart
   * If item already exists, update quantity
   * @param userId - User ID
   * @param data - AddToCartInput
   * @returns CartItem
   * @throws ApiError
   */
  async addToCart(userId: string, data: AddToCartInput): Promise<CartItem> {
    try {
      // Check if product exists and is approved
      const product = await prisma.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      if (product.status !== ProductStatus.APPROVED) {
        throw new ApiError(400, "Product is not available for purchase");
      }

      // Check if product has sufficient stock
      if (product.stock < data.quantity) {
        throw new ApiError(400, `Not enough stock available. Only ${product.stock} units available.`);
      }

      // Find or create user's cart
      let cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId,
          },
        });
      }

      // Check if item already exists in cart
      const existingCartItem = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: data.productId,
          },
        },
      });

      let updatedCartItem: CartItem;

      // If item exists, update quantity
      if (existingCartItem) {
        const newQuantity = existingCartItem.quantity + data.quantity;
        
        // Check if new quantity exceeds stock
        if (newQuantity > product.stock) {
          throw new ApiError(400, `Cannot add ${data.quantity} more units. Only ${product.stock - existingCartItem.quantity} additional units available.`);
        }

        updatedCartItem = await prisma.cartItem.update({
          where: {
            id: existingCartItem.id,
          },
          data: {
            quantity: newQuantity,
          },
          include: {
            product: true,
          },
        });
      } else {
        // Otherwise, create new cart item
        updatedCartItem = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: data.productId,
            quantity: data.quantity,
          },
          include: {
            product: true,
          },
        });
      }

      // Invalidate cart cache
      await cacheService.invalidateCartCache(userId);

      return updatedCartItem;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to add item to cart");
    }
  }

  /**
   * Update cart item quantity
   * @param userId - User ID
   * @param productId - Product ID
   * @param data - UpdateCartItemInput
   * @returns CartItem
   * @throws ApiError
   */
  async updateCartItem(userId: string, productId: string, data: UpdateCartItemInput): Promise<CartItem> {
    try {
      // Find user's cart
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new ApiError(404, "Cart not found");
      }

      // Find cart item
      const cartItem = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId,
          },
        },
      });

      if (!cartItem) {
        throw new ApiError(404, "Item not found in cart");
      }

      // Check product stock
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new ApiError(404, "Product not found");
      }

      if (product.status !== ProductStatus.APPROVED) {
        throw new ApiError(400, "Product is not available for purchase");
      }

      if (data.quantity > product.stock) {
        throw new ApiError(400, `Not enough stock available. Only ${product.stock} units available.`);
      }

      // Update cart item
      const updatedCartItem = await prisma.cartItem.update({
        where: {
          id: cartItem.id,
        },
        data: {
          quantity: data.quantity,
        },
        include: {
          product: true,
        },
      });

      // Invalidate cart cache
      await cacheService.invalidateCartCache(userId);

      return updatedCartItem;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to update cart item");
    }
  }

  /**
   * Remove item from cart
   * @param userId - User ID
   * @param productId - Product ID
   * @throws ApiError
   */
  async removeFromCart(userId: string, productId: string): Promise<void> {
    try {
      // Find user's cart
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new ApiError(404, "Cart not found");
      }

      // Find cart item
      const cartItem = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId,
          },
        },
      });

      if (!cartItem) {
        throw new ApiError(404, "Item not found in cart");
      }

      // Delete cart item
      await prisma.cartItem.delete({
        where: {
          id: cartItem.id,
        },
      });

      // Invalidate cart cache
      await cacheService.invalidateCartCache(userId);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to remove item from cart");
    }
  }

  /**
   * Clear cart
   * @param userId - User ID
   * @throws ApiError
   */
  async clearCart(userId: string): Promise<void> {
    try {
      // Find user's cart
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: true,
        },
      });

      if (!cart || cart.items.length === 0) {
        return; // Cart is already empty
      }

      // Delete all cart items
      await prisma.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      // Invalidate cart cache
      await cacheService.invalidateCartCache(userId);
    } catch (error) {
      throw new ApiError(500, "Failed to clear cart");
    }
  }

  /**
   * Calculate cart totals
   * @param userId - User ID
   * @returns Subtotal, itemCount, productCount
   * @throws ApiError
   */
  async getCartTotals(userId: string): Promise<{
    subtotal: number;
    itemCount: number;
    productCount: number;
  }> {
    try {
      // Try to get from cache first
      const cacheKey = cacheKeys.cart.totals(userId);
      const cachedTotals = await cacheService.get<{
        subtotal: number;
        itemCount: number;
        productCount: number;
      }>(cacheKey);
      if (cachedTotals) {
        return cachedTotals;
      }

      const cart = await this.getUserCart(userId);

      if (!cart || cart.items.length === 0) {
        const emptyTotals = {
          subtotal: 0,
          itemCount: 0,
          productCount: 0,
        };
        
        // Cache empty totals
        await cacheService.set(cacheKey, emptyTotals, { ttl: CACHE_TTL.CART });
        
        return emptyTotals;
      }

      // Calculate totals using Decimal for precision
      let subtotal = new Prisma.Decimal(0);
      let itemCount = 0;

      cart.items.forEach(item => {
        // Use the effective price (salePrice if available, otherwise regular price)
        const effectivePrice = item.product.salePrice || item.product.price;
        subtotal = subtotal.add(effectivePrice.mul(item.quantity));
        itemCount += item.quantity;
      });

      const totals = {
        subtotal: parseFloat(subtotal.toString()),
        itemCount,
        productCount: cart.items.length,
      };

      // Cache the totals
      await cacheService.set(cacheKey, totals, { ttl: CACHE_TTL.CART });

      return totals;
    } catch (error) {
      throw new ApiError(500, "Failed to calculate cart totals");
    }
  }
}