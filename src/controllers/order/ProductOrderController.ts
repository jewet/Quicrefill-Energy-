import { Request, Response, NextFunction } from "express";
import { ProductOrderService } from "../../services/productOrderService";
import { PrismaClient, TransactionStatus, OrderStatus, ProductOrder, OrderReview } from '@prisma/client';
import { ApiError } from "../../lib/utils/errors/appError";
import { 
  createOrderSchema, 
  orderQuerySchema, 
  updateOrderStatusSchema, 
  updatePaymentStatusSchema 
} from "../../schemas/order.schema";
import logger from '../../config/logger';

// Export the prisma instance
export const prisma = new PrismaClient();

const productOrderService = new ProductOrderService();

interface OrderWithReviews extends ProductOrder {
  reviews?: OrderReview[];
  timeline?: { time: string; status: string; description: string; actor: string }[];
}

export class ProductOrderController {
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const validatedData = createOrderSchema.parse(req.body);

      const orders = await productOrderService.createProductOrder(
        userId,
        validatedData.deliveryAddressId,
        validatedData.paymentMethod,
        validatedData.notes,
        validatedData.voucherCode,
        validatedData.cardDetails
      );

      logger.info(`Order created successfully for user ${userId}`, {
        orderIds: orders.map(order => order.id),
        paymentMethod: validatedData.paymentMethod,
        cardDetails: validatedData.cardDetails ? {
          cardno: validatedData.cardDetails.cardno.slice(-4).padStart(validatedData.cardDetails.cardno.length, '*'),
          cvv: '***',
          expirymonth: validatedData.cardDetails.expirymonth,
          expiryyear: validatedData.cardDetails.expiryyear,
        } : undefined,
      });
      res.status(201).json({
        status: 'success',
        message: 'Order created successfully',
        data: orders,
      });
    } catch (error: any) {
      logger.error("Error creating order:", {
        error: error.message,
        userId: req.user?.id,
        body: {
          ...req.body,
          cardDetails: req.body.cardDetails ? {
            cardno: req.body.cardDetails.cardno?.slice(-4).padStart(req.body.cardDetails.cardno?.length || 16, '*'),
            cvv: '***',
            expirymonth: req.body.cardDetails.expirymonth,
            expiryyear: req.body.cardDetails.expiryyear,
          } : undefined,
        },
      });
      next(error);
    }
  }

  async processPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.error('User not authenticated');
        throw new ApiError(401, 'User not authenticated');
      }

      const { orderIds, paymentMethod, cardDetails } = req.body;
      if (!orderIds || !paymentMethod) {
        logger.error('Missing required fields', { orderIds, paymentMethod });
        throw new ApiError(400, 'Missing required fields: orderIds or paymentMethod');
      }

      if (!Array.isArray(orderIds)) {
        logger.error('Invalid orderIds format', { orderIds });
        throw new ApiError(400, 'orderIds must be an array');
      }

      if (paymentMethod === 'CARD' && !cardDetails) {
        logger.error('Card details required for CARD payment', { userId });
        throw new ApiError(400, 'Card details required for CARD payment');
      }

      const userOrders = await prisma.productOrder.count({
        where: {
          userId,
          orderStatus: OrderStatus.DELIVERED,
        },
      });
      const isNewCustomer = userOrders === 0;

      const result = await productOrderService.processPaymentForExistingOrders(
        userId,
        orderIds,
        paymentMethod,
        isNewCustomer,
        cardDetails
      );

      logger.info(`Payment processed successfully for user ${userId}`, { orderIds, paymentMethod });
      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error processing payment:', { error: error.message, userId: req.user?.id, body: req.body });
      next(error);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const { orderIds, transactionRef } = req.body;
      if (!orderIds || !transactionRef) {
        logger.error("Missing orderIds or transactionRef", { orderIds, transactionRef });
        throw new ApiError(400, "Missing orderIds or transactionRef");
      }

      if (!Array.isArray(orderIds)) {
        logger.error("Invalid orderIds format", { orderIds });
        throw new ApiError(400, "orderIds must be an array");
      }

      const result = await productOrderService.verifyPayment(orderIds, transactionRef);

      logger.info(`Payment verified successfully for user ${userId}`, { orderIds, transactionRef });
      res.status(result.success ? 200 : 400).json({
        status: result.success ? 'success' : 'error',
        message: result.message,
        redirectUrl: result.redirectUrl,
      });
    } catch (error: any) {
      logger.error("Error verifying payment:", { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  async getUserOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const queryParams = orderQuerySchema.parse(req.query);

      const { orders, totalCount } = await productOrderService.getOrderHistory(userId, queryParams);

      const totalPages = Math.ceil(totalCount / queryParams.limit);

      logger.info(`Fetched user orders for user ${userId}`, { totalCount, page: queryParams.page });
      res.status(200).json({
        status: 'success',
        results: orders.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: orders,
      });
    } catch (error: any) {
      logger.error("Error fetching orders:", { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  async getAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const queryParams = orderQuerySchema.parse(req.query);

      // Fetch role dynamically
      const userRole = await prisma.role.findUnique({ where: { id: user.role } });
      if (!userRole) {
        logger.error("User role not found", { userId: user.id });
        throw new ApiError(403, "User role not found");
      }

      if (userRole.name !== 'ADMIN' && userRole.name !== 'VENDOR') {
        logger.error("Insufficient permissions", { userId: user.id, role: userRole.name });
        throw new ApiError(403, "Insufficient permissions");
      }

      const { orders, totalCount } = await productOrderService.getAllOrders(
        userRole.id,
        user.id,
        queryParams
      );

      const totalPages = Math.ceil(totalCount / queryParams.limit);

      logger.info(`Fetched all orders for ${userRole.name} ${user.id}`, { totalCount, page: queryParams.page });
      res.status(200).json({
        status: 'success',
        results: orders.length,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          totalResults: totalCount,
          totalPages,
        },
        data: orders,
      });
    } catch (error: any) {
      logger.error("Error fetching all orders:", { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const { id } = req.params;

      const order = await productOrderService.updateOrderStatus(
        id,
        OrderStatus.CANCELLED,
        user.id,
        "Order cancelled by user"
      );

      logger.info(`Order ${id} cancelled by user ${user.id}`);
      res.status(200).json({
        status: 'success',
        message: 'Order cancelled successfully',
        data: order,
      });
    } catch (error: any) {
      logger.error("Error cancelling order:", { error: error.message, orderId: req.params.id, userId: req.user?.id });
      next(error);
    }
  }

  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const userRole = await prisma.role.findUnique({ where: { id: user.role } });
      if (!userRole) {
        logger.error("User role not found", { userId: user.id });
        throw new ApiError(403, "User role not found");
      }

      if (
        userRole.name !== 'ADMIN' &&
        userRole.name !== 'VENDOR' &&
        userRole.name !== 'DELIVERY_AGENT'
      ) {
        logger.error("Insufficient permissions to update order status", { userId: user.id, role: userRole.name });
        throw new ApiError(403, "Insufficient permissions to update order status");
      }

      const { id } = req.params;
      const validatedData = updateOrderStatusSchema.parse(req.body);

      const order = await productOrderService.updateOrderStatus(
        id,
        validatedData.status,
        user.id,
        validatedData.notes
      );

      logger.info(`Order ${id} status updated to ${validatedData.status} by user ${user.id}`);
      res.status(200).json({
        status: 'success',
        message: `Order status updated to ${validatedData.status}`,
        data: order,
      });
    } catch (error: any) {
      logger.error("Error updating order status:", { error: error.message, orderId: req.params.id, userId: req.user?.id });
      next(error);
    }
  }

  async updatePaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const userRole = await prisma.role.findUnique({ where: { id: user.role } });
      if (!userRole) {
        logger.error("User role not found", { userId: user.id });
        throw new ApiError(403, "User role not found");
      }

      if (userRole.name !== 'ADMIN') {
        logger.error("Only admins can update payment status", { userId: user.id, role: userRole.name });
        throw new ApiError(403, "Only admins can update payment status");
      }

      const { id } = req.params;
      const validatedData = updatePaymentStatusSchema.parse(req.body);

      if (!Object.values(TransactionStatus).includes(validatedData.status)) {
        logger.error("Invalid payment status", { status: validatedData.status });
        throw new ApiError(400, `Invalid payment status: ${validatedData.status}`);
      }

      const order = await productOrderService.updatePaymentStatus(
        id,
        validatedData.status,
        user.id
      );

      logger.info(`Payment status updated to ${validatedData.status} for order ${id} by user ${user.id}`);
      res.status(200).json({
        status: 'success',
        message: `Payment status updated to ${validatedData.status}`,
        data: order,
      });
    } catch (error: any) {
      logger.error("Error updating payment status:", { error: error.message, orderId: req.params.id, userId: req.user?.id });
      next(error);
    }
  }

  async verifyConfirmationCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const userRole = await prisma.role.findUnique({ where: { id: user.role } });
      if (!userRole) {
        logger.error("User role not found", { userId: user.id });
        throw new ApiError(403, "User role not found");
      }

      if (userRole.name !== 'DELIVERY_AGENT') {
        logger.error("Only delivery agents can verify confirmation codes", { userId: user.id, role: userRole.name });
        throw new ApiError(403, "Only delivery agents can verify confirmation codes");
      }

      const { id } = req.params;
      const { code } = req.body;

      if (!code) {
        logger.error("Confirmation code is required", { orderId: id });
        throw new ApiError(400, "Confirmation code is required");
      }

      const order = await productOrderService.verifyConfirmationCode(id, code, user.id);

      logger.info(`Delivery confirmed for order ${id} by user ${user.id}`);
      res.status(200).json({
        status: 'success',
        message: 'Delivery confirmed successfully',
        data: order,
      });
    } catch (error: any) {
      logger.error("Error verifying confirmation code:", { error: error.message, orderId: req.params.id, userId: req.user?.id });
      next(error);
    }
  }

  async assignDeliveryAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const userRole = await prisma.role.findUnique({ where: { id: user.role } });
      if (!userRole) {
        logger.error("User role not found", { userId: user.id });
        throw new ApiError(403, "User role not found");
      }

      if (userRole.name !== 'ADMIN' && userRole.name !== 'VENDOR') {
        logger.error("Only admins or vendors can assign delivery agents", { userId: user.id, role: userRole.name });
        throw new ApiError(403, "Only admins or vendors can assign delivery agents");
      }

      const { id } = req.params;
      const { agentId } = req.body;

      if (!agentId) {
        logger.error("Delivery agent ID is required", { orderId: id });
        throw new ApiError(400, "Delivery agent ID is required");
      }

      const order = await productOrderService.assignDeliveryAgent(id, agentId, user.id);

      logger.info(`Delivery agent ${agentId} assigned to order ${id} by user ${user.id}`);
      res.status(200).json({
        status: 'success',
        message: 'Delivery agent assigned successfully',
        data: order,
      });
    } catch (error: any) {
      logger.error("Error assigning delivery agent:", { error: error.message, orderId: req.params.id, userId: req.user?.id });
      next(error);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        logger.error("User not authenticated");
        throw new ApiError(401, "User not authenticated");
      }

      const { id } = req.params;

      const order = await productOrderService.getOrderById(id, user.id, user.role);

      if (!order) {
        logger.error(`Order ${id} not found for user ${user.id}`);
        throw new ApiError(404, "Order not found");
      }

      const orderWithReviews = order as OrderWithReviews;
      const averageRating = this.calculateAverageRating(orderWithReviews.reviews);

      logger.info(`Fetched order ${id} for user ${user.id}`);
      res.status(200).json({
        status: 'success',
        data: {
          ...orderWithReviews,
          averageRating,
        },
      });
    } catch (error: any) {
      logger.error("Error fetching order details:", {
        error: error.message,
        orderId: req.params.id,
        userId: req.user?.id,
      });
      next(error);
    }
  }

  private calculateAverageRating(reviews: OrderReview[] | undefined): number {
    if (!reviews || reviews.length === 0) {
      return 0;
    }

    const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return Number((totalRating / reviews.length).toFixed(1));
  }
}

export default new ProductOrderController();