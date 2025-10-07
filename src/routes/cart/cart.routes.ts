import { Router } from 'express';
import { CartController } from '../../controllers/cart/cart.controller';
import { authenticationMiddleware } from '../../middlewares/authentication';

const CartRouter = Router();
const cartController = new CartController();

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Cart-related endpoints for managing user cart
 */

// All cart routes require authentication
CartRouter.use(authenticationMiddleware);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cart retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID of the user who owns the cart
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             description: ID of the product
 *                           quantity:
 *                             type: integer
 *                             description: Quantity of the product in cart
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               salePrice:
 *                                 type: number
 *                               images:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items in cart
 *                     subtotal:
 *                       type: number
 *                       description: Total price before discounts
 *                     total:
 *                       type: number
 *                       description: Final price after discounts
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
CartRouter.get('/', (req, res, next) => cartController.getCart(req, res, next));

/**
 * @swagger
 * /api/cart/items:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *                 example: "61a1c7b382e2a2d8470096d4"
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 2
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Item added to cart successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID of the user who owns the cart
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             description: ID of the product
 *                           quantity:
 *                             type: integer
 *                             description: Quantity of the product in cart
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               salePrice:
 *                                 type: number
 *                               images:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items in cart
 *                     subtotal:
 *                       type: number
 *                       description: Total price before discounts
 *                     total:
 *                       type: number
 *                       description: Final price after discounts
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Product not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
CartRouter.post('/items', (req, res, next) => cartController.addToCart(req, res, next));

/**
 * @swagger
 * /api/cart/items/{productId}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the product to update in cart
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 3
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cart item updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID of the user who owns the cart
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             description: ID of the product
 *                           quantity:
 *                             type: integer
 *                             description: Quantity of the product in cart
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               salePrice:
 *                                 type: number
 *                               images:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items in cart
 *                     subtotal:
 *                       type: number
 *                       description: Total price before discounts
 *                     total:
 *                       type: number
 *                       description: Final price after discounts
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Item not found in cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Item not found in cart"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
CartRouter.put('/items/:productId', (req, res, next) => cartController.updateCartItem(req, res, next));

/**
 * @swagger
 * /api/cart/items/{productId}:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the product to remove from cart
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Item removed from cart successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID of the user who owns the cart
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             description: ID of the product
 *                           quantity:
 *                             type: integer
 *                             description: Quantity of the product in cart
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               salePrice:
 *                                 type: number
 *                               images:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items in cart
 *                     subtotal:
 *                       type: number
 *                       description: Total price before discounts
 *                     total:
 *                       type: number
 *                       description: Final price after discounts
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Item not found in cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Item not found in cart"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
CartRouter.delete('/items/:productId', (req, res, next) => cartController.removeFromCart(req, res, next));

/**
 * @swagger
 * /api/cart/items:
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Cart cleared successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: ID of the user who owns the cart
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             description: ID of the product
 *                           quantity:
 *                             type: integer
 *                             description: Quantity of the product in cart
 *                           product:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 *                               salePrice:
 *                                 type: number
 *                               images:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                     totalItems:
 *                       type: integer
 *                       description: Total number of items in cart
 *                     subtotal:
 *                       type: number
 *                       description: Total price before discounts
 *                     total:
 *                       type: number
 *                       description: Final price after discounts
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
CartRouter.delete('/items', (req, res, next) => cartController.clearCart(req, res, next));

export default CartRouter;