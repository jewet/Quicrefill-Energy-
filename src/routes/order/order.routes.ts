// import { Router } from 'express';
// import { OrderController } from '../../controllers/order/ProductOrderController';
// import { authenticationMiddleware } from '../../middlewares/authentication';
// import { authorize } from '../../middlewares/permissions';
// import { Role } from '@prisma/client';

// const OrderRouter = Router();
// const orderController = new OrderController();

// /**
//  * @swagger
//  * tags:
//  *   name: Orders
//  *   description: Order management endpoints
//  */

// // All order routes require authentication
// OrderRouter.use(authenticationMiddleware);

// /**
//  * @swagger
//  * /api/order:
//  *   get:
//  *     summary: Get current user's orders
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *         description: Page number
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *         description: Number of items per page
//  *       - in: query
//  *         name: status
//  *         schema:
//  *           type: string
//  *           enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *         description: Filter by order status
//  *     responses:
//  *       200:
//  *         description: List of user's orders retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Orders retrieved successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     orders:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           id:
//  *                             type: string
//  *                             description: Order unique identifier
//  *                           userId:
//  *                             type: string
//  *                             description: ID of the user who placed the order
//  *                           orderNumber:
//  *                             type: string
//  *                             description: Unique order number
//  *                           status:
//  *                             type: string
//  *                             enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                             description: Current status of the order
//  *                           paymentStatus:
//  *                             type: string
//  *                             enum: [PENDING, PAID, FAILED]
//  *                             description: Payment status
//  *                           paymentMethod:
//  *                             type: string
//  *                             description: Method of payment
//  *                           deliveryAddress:
//  *                             type: object
//  *                             description: Delivery address details
//  *                           items:
//  *                             type: array
//  *                             items:
//  *                               type: object
//  *                               properties:
//  *                                 productId:
//  *                                   type: string
//  *                                 quantity:
//  *                                   type: integer
//  *                                 price:
//  *                                   type: number
//  *                           subtotal:
//  *                             type: number
//  *                             description: Total price of items before tax and shipping
//  *                           shippingFee:
//  *                             type: number
//  *                             description: Shipping cost
//  *                           tax:
//  *                             type: number
//  *                             description: Tax amount
//  *                           total:
//  *                             type: number
//  *                             description: Final order total
//  *                           riderId:
//  *                             type: string
//  *                             description: ID of the assigned delivery representative
//  *                           confirmationCode:
//  *                             type: string
//  *                             description: Code for verifying delivery
//  *                           createdAt:
//  *                             type: string
//  *                             format: date-time
//  *                           updatedAt:
//  *                             type: string
//  *                             format: date-time
//  *                     total:
//  *                       type: integer
//  *                     page:
//  *                       type: integer
//  *                     limit:
//  *                       type: integer
//  *                     pages:
//  *                       type: integer
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.get('/', (req, res, next) => orderController.getUserOrders(req, res, next));

// /**
//  * @swagger
//  * /api/order:
//  *   post:
//  *     summary: Create a new order
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - addressId
//  *               - paymentMethod
//  *             properties:
//  *               addressId:
//  *                 type: string
//  *                 example: "61a1c7b382e2a2d8470096d4"
//  *                 description: ID of the delivery address
//  *               paymentMethod:
//  *                 type: string
//  *                 example: "CARD"
//  *                 description: Payment method
//  *               notes:
//  *                 type: string
//  *                 example: "Please leave at front door"
//  *                 description: Order notes
//  *     responses:
//  *       201:
//  *         description: Order created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Order created successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       400:
//  *         description: Invalid input or empty cart
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Invalid input or empty cart"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.post('/', (req, res, next) => orderController.createOrder(req, res, next));

// /**
//  * @swagger
//  * /api/order/{id}:
//  *   get:
//  *     summary: Get order details by ID
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Order ID
//  *     responses:
//  *       200:
//  *         description: Order retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Order retrieved successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Not authorized to view this order
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Not authorized to view this order"
//  *       404:
//  *         description: Order not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.get('/:id', (req, res, next) => orderController.getOrderById(req, res, next));

// /**
//  * @swagger
//  * /api/order/{id}/cancel:
//  *   put:
//  *     summary: Cancel an order
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Order ID
//  *     responses:
//  *       200:
//  *         description: Order cancelled successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Order cancelled successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       400:
//  *         description: Order cannot be cancelled
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order cannot be cancelled"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Not authorized to cancel this order
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Not authorized to cancel this order"
//  *       404:
//  *         description: Order not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.put('/:id/cancel', (req, res, next) => orderController.cancelOrder(req, res, next));

// /**
//  * @swagger
//  * /api/order/admin/all:
//  *   get:
//  *     summary: Get all orders (admin only)
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *         description: Page number
//  *       - in: query
//  *         name: limit
//  *         schema:
//  *           type: integer
//  *           minimum: 1
//  *         description: Number of items per page
//  *       - in: query
//  *         name: status
//  *         schema:
//  *           type: string
//  *           enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *         description: Filter by order status
//  *       - in: query
//  *         name: paymentStatus
//  *         schema:
//  *           type: string
//  *           enum: [PENDING, PAID, FAILED]
//  *         description: Filter by payment status
//  *       - in: query
//  *         name: startDate
//  *         schema:
//  *           type: string
//  *           format: date
//  *         description: Filter orders created on or after this date
//  *       - in: query
//  *         name: endDate
//  *         schema:
//  *           type: string
//  *           format: date
//  *         description: Filter orders created before this date
//  *     responses:
//  *       200:
//  *         description: List of all orders retrieved successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Orders retrieved successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     orders:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           id:
//  *                             type: string
//  *                             description: Order unique identifier
//  *                           userId:
//  *                             type: string
//  *                             description: ID of the user who placed the order
//  *                           orderNumber:
//  *                             type: string
//  *                             description: Unique order number
//  *                           status:
//  *                             type: string
//  *                             enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                             description: Current status of the order
//  *                           paymentStatus:
//  *                             type: string
//  *                             enum: [PENDING, PAID, FAILED]
//  *                             description: Payment status
//  *                           paymentMethod:
//  *                             type: string
//  *                             description: Method of payment
//  *                           deliveryAddress:
//  *                             type: object
//  *                             description: Delivery address details
//  *                           items:
//  *                             type: array
//  *                             items:
//  *                               type: object
//  *                               properties:
//  *                                 productId:
//  *                                   type: string
//  *                                 quantity:
//  *                                   type: integer
//  *                                 price:
//  *                                   type: number
//  *                           subtotal:
//  *                             type: number
//  *                             description: Total price of items before tax and shipping
//  *                           shippingFee:
//  *                             type: number
//  *                             description: Shipping cost
//  *                           tax:
//  *                             type: number
//  *                             description: Tax amount
//  *                           total:
//  *                             type: number
//  *                             description: Final order total
//  *                           riderId:
//  *                             type: string
//  *                             description: ID of the assigned delivery representative
//  *                           confirmationCode:
//  *                             type: string
//  *                             description: Code for verifying delivery
//  *                           createdAt:
//  *                             type: string
//  *                             format: date-time
//  *                           updatedAt:
//  *                             type: string
//  *                             format: date-time
//  *                     total:
//  *                       type: integer
//  *                     page:
//  *                       type: integer
//  *                     limit:
//  *                       type: integer
//  *                     pages:
//  *                       type: integer
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Admin access required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Admin access required"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.get(
//   '/admin/all',
//   authorize([Role.ADMIN]),
//   (req, res, next) => orderController.getAllOrders(req, res, next)
// );

// /**
//  * @swagger
//  * /api/order/{id}/payment-status:
//  *   patch:
//  *     summary: Update order payment status (admin only)
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Order ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - paymentStatus
//  *             properties:
//  *               paymentStatus:
//  *                 type: string
//  *                 enum: [PENDING, PAID, FAILED]
//  *                 example: "PAID"
//  *     responses:
//  *       200:
//  *         description: Payment status updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Payment status updated successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       400:
//  *         description: Invalid payment status
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Invalid payment status"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Admin access required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Admin access required"
//  *       404:
//  *         description: Order not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.patch(
//   '/:id/payment-status',
//   authorize([Role.ADMIN]),
//   (req, res, next) => orderController.updatePaymentStatus(req, res, next)
// );

// /**
//  * @swagger
//  * /api/order/{id}/assign-rider:
//  *   patch:
//  *     summary: Assign a delivery rider to an order (admin or vendor)
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Order ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - riderId
//  *             properties:
//  *               riderId:
//  *                 type: string
//  *                 example: "61a1c7b382e2a2d8470096e5"
//  *     responses:
//  *       200:
//  *         description: Rider assigned successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Rider assigned successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       400:
//  *         description: Invalid rider ID
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Invalid rider ID"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Admin or Vendor access required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Admin or Vendor access required"
//  *       404:
//  *         description: Order or rider not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order or rider not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.patch(
//   '/:id/assign-rider',
//   authorize([Role.ADMIN, Role.VENDOR]),
//   (req, res, next) => orderController.assignRider(req, res, next)
// );

// /**
//  * @swagger
//  * /api/order/{id}/status:
//  *   patch:
//  *     summary: Update order status (admin or delivery rep)
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Order ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - status
//  *             properties:
//  *               status:
//  *                 type: string
//  *                 enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                 example: "SHIPPED"
//  *     responses:
//  *       200:
//  *         description: Order status updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Order status updated successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       400:
//  *         description: Invalid status update
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Invalid status update"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Admin or Delivery Rep access required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Admin or Delivery Rep access required"
//  *       404:
//  *         description: Order not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.patch(
//   '/:id/status',
//   authorize([Role.ADMIN, Role.DELIVERY_REP]),
//   (req, res, next) => orderController.updateOrderStatus(req, res, next)
// );

// /**
//  * @swagger
//  * /api/order/{id}/verify-delivery:
//  *   post:
//  *     summary: Verify delivery confirmation code (delivery rep only)
//  *     tags: [Orders]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: Order ID
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - code
//  *             properties:
//  *               code:
//  *                 type: string
//  *                 example: "123456"
//  *     responses:
//  *       200:
//  *         description: Delivery confirmed successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Delivery confirmed successfully"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                       description: Order unique identifier
//  *                     userId:
//  *                       type: string
//  *                       description: ID of the user who placed the order
//  *                     orderNumber:
//  *                       type: string
//  *                       description: Unique order number
//  *                     status:
//  *                       type: string
//  *                       enum: [PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
//  *                       description: Current status of the order
//  *                     paymentStatus:
//  *                       type: string
//  *                       enum: [PENDING, PAID, FAILED]
//  *                       description: Payment status
//  *                     paymentMethod:
//  *                       type: string
//  *                       description: Method of payment
//  *                     deliveryAddress:
//  *                       type: object
//  *                       description: Delivery address details
//  *                     items:
//  *                       type: array
//  *                       items:
//  *                         type: object
//  *                         properties:
//  *                           productId:
//  *                             type: string
//  *                           quantity:
//  *                             type: integer
//  *                           price:
//  *                             type: number
//  *                     subtotal:
//  *                       type: number
//  *                       description: Total price of items before tax and shipping
//  *                     shippingFee:
//  *                       type: number
//  *                       description: Shipping cost
//  *                     tax:
//  *                       type: number
//  *                       description: Tax amount
//  *                     total:
//  *                       type: number
//  *                       description: Final order total
//  *                     riderId:
//  *                       type: string
//  *                       description: ID of the assigned delivery representative
//  *                     confirmationCode:
//  *                       type: string
//  *                       description: Code for verifying delivery
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                     updatedAt:
//  *                       type: string
//  *                       format: date-time
//  *       400:
//  *         description: Invalid confirmation code
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Invalid confirmation code"
//  *       401:
//  *         description: Unauthorized
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Unauthorized"
//  *       403:
//  *         description: Forbidden - Delivery Rep access required
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Forbidden - Delivery Rep access required"
//  *       404:
//  *         description: Order not found
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Order not found"
//  *       500:
//  *         description: Server error
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: false
//  *                 message:
//  *                   type: string
//  *                   example: "Internal server error"
//  */
// OrderRouter.post(
//   '/:id/verify-delivery',
//   authorize([Role.DELIVERY_REP]),
//   (req, res, next) => orderController.verifyConfirmationCode(req, res, next)
// );

// export default OrderRouter;