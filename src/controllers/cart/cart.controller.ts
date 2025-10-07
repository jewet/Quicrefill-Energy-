// src/controllers/cart.controller.ts
import { Request, Response, NextFunction } from 'express';
import { CartService } from '../../services/cart.service';
import { addToCartSchema, updateCartItemSchema } from '../../schemas/cart.schema';
import { ApiError } from '../../lib/utils/errors/appError';

const cartService = new CartService();

export class CartController {
  /**
   * Get user's cart
   * @param req - Request
   * @param res - Response
   * @param next - Next function
   * @returns Cart with items
   */
  async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      const cart = await cartService.getUserCart(req.user.id);
      const totals = await cartService.getCartTotals(req.user.id);
      
      res.status(200).json({
        status: 'success',
        data: {
          cart,
          totals,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add item to cart
   * @param req - Request
   * @param res - Response
   * @param next - Next function
   * @body productId - Product ID
   * @body quantity - Quantity
   * @returns Cart item and updated totals
   */
  async addToCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      // Validate request body
      const validatedData = addToCartSchema.parse(req.body);
      
      const cartItem = await cartService.addToCart(req.user.id, validatedData);
      const totals = await cartService.getCartTotals(req.user.id);
      
      res.status(200).json({
        status: 'success',
        data: {
          cartItem,
          totals,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cart item quantity
   * @param req - Request
   * @param res - Response
   * @param next - Next function
   * @param productId - Product ID
   * @body quantity - Quantity
   * @returns Updated cart item and updated totals
   */
  async updateCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      const { productId } = req.params;
      
      // Validate request body
      const validatedData = updateCartItemSchema.parse(req.body);
      
      const cartItem = await cartService.updateCartItem(req.user.id, productId, validatedData);
      const totals = await cartService.getCartTotals(req.user.id);
      
      res.status(200).json({
        status: 'success',
        data: {
          cartItem,
          totals,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove item from cart
   * @param req - Request
   * @param res - Response
   * @param next - Next function
   * @param productId - Product ID
   * @returns Success message and updated totals
   */
  async removeFromCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      const { productId } = req.params;
      
      await cartService.removeFromCart(req.user.id, productId);
      const totals = await cartService.getCartTotals(req.user.id);
      
      res.status(200).json({
        status: 'success',
        message: 'Item removed from cart',
        data: {
          totals,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear cart
   * @param req - Request
   * @param res - Response
   * @param next - Next function
   * @returns Success message and updated totals
   */
  async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated");
      }

      await cartService.clearCart(req.user.id);
      
      res.status(200).json({
        status: 'success',
        message: 'Cart cleared',
        data: {
          totals: {
            subtotal: 0,
            itemCount: 0,
            productCount: 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}