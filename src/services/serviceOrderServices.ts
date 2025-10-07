import { ServiceOrder, ServiceOrderStatus, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../utils/logger";
import { ApiError } from "../errors/ApiError";
import { ErrorCodes } from "../errors/errorCodes";
import { ServiceOrderRepository } from "../repositories/serviceOrderRepository";

// Define the expected return type for calculateServiceOrderTotal to match the repository
interface OrderTotal {
  servicePricePerUnit: number;
  serviceSubtotal: Decimal;
  serviceFee: number;
  deliveryFee: Decimal;
  additionalFee: number;
  discountAmount: Decimal;
  subtotal: Decimal;
  vatAmount: Decimal;
  petroleumTax: number;
  totalAmount: Decimal;
  vatRate: Decimal;
}

export class ServiceOrderService {
  private repository: ServiceOrderRepository;

  constructor() {
    this.repository = new ServiceOrderRepository();
  }

  /**
   * Creates a new service order
   * @param userId - The ID of the user placing the order
   * @param addressId - The ID of the address where the service will be delivered
   * @param serviceId - The ID of the service being ordered
   * @param unitQuantity - The quantity of the service being ordered
   * @param paymentMethod - The payment method used for the order
   * @param voucherCode - The voucher code applied to the order (if any)
   * @param clientIp - The client IP address for fraud detection (optional)
   * @param cardDetails - Card details for CARD payment method (required for CARD)
   * @param destinationBankCode - Bank code for electricity payments (required for electricity non-wallet payments)
   * @param destinationAccountNumber - Account number for electricity payments (required for electricity non-wallet payments)
   * @returns The created service order with payment result and additional metadata
   */
  async createServiceOrder(
    userId: string,
    addressId: string,
    serviceId: string,
    unitQuantity: number = 1,
    paymentMethod: PaymentMethod,
    voucherCode?: string,
    clientIp?: string,
    cardDetails?: {
      cardno: string;
      cvv: string;
      expirymonth: string;
      expiryyear: string;
      pin?: string;
      suggested_auth?: string;
      billingzip?: string;
      billingcity?: string;
      billingaddress?: string;
      billingstate?: string;
      billingcountry?: string;
    },
    destinationBankCode?: string,
    destinationAccountNumber?: string
  ): Promise<{
    serviceOrder: ServiceOrder;
    paymentResult?: any;
    suggestedServices?: any[];
    distanceKm?: number;
    serviceRadiusKm?: number;
  }> {
    try {
      return await this.repository.createServiceOrder(
        userId,
        addressId,
        serviceId,
        unitQuantity,
        paymentMethod,
        voucherCode,
        clientIp,
        cardDetails,
        destinationBankCode,
        destinationAccountNumber
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error creating service order: ${error}`);
      throw new ApiError(500, "Failed to create service order", ErrorCodes.ORDER_CREATION_FAILED);
    }
  }

  /**
   * Calculate service order totals without creating an order
   * @param serviceId - The ID of the service
   * @param addressId - The ID of the delivery address
   * @param unitQuantity - The quantity of units
   * @param voucherCode - Optional voucher code for discounts
   * @param userId - User ID for voucher validation
   * @returns Object with all price details
   */
  async calculateServiceOrderTotal(
    serviceId: string,
    addressId: string,
    unitQuantity: number = 1,
    voucherCode?: string,
    userId?: string
  ): Promise<OrderTotal> {
    try {
      return await this.repository.calculateServiceOrderTotal(serviceId, addressId, unitQuantity, voucherCode, userId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error calculating order total: ${error}`);
      throw new ApiError(500, "Failed to calculate order total", ErrorCodes.CALCULATION_FAILED);
    }
  }

  /**
   * Updates the status of a service order
   * @param serviceOrderId - The ID of the service order to update
   * @param newStatus - The new status to set
   * @param updatedBy - The ID of the user updating the status
   * @param notes - Optional notes about the status update
   * @returns The updated service order
   */
  async updateServiceOrderStatus(
    serviceOrderId: string,
    newStatus: ServiceOrderStatus,
    updatedBy: string,
    notes?: string
  ): Promise<ServiceOrder> {
    try {
      return await this.repository.updateServiceOrderStatus(serviceOrderId, newStatus, updatedBy, notes);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error updating order status: ${error}`);
      throw new ApiError(500, "Failed to update order status", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Handles the approval of a service order by a provider
   * @param serviceOrderId - The ID of the service order to approve
   * @param providerId - The ID of the provider approving the order
   * @returns The updated service order
   */
  async approveServiceOrder(serviceOrderId: string, providerId: string): Promise<ServiceOrder> {
    try {
      return await this.repository.approveServiceOrder(serviceOrderId, providerId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error approving order: ${error}`);
      throw new ApiError(500, "Failed to approve order", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Handles the rejection of a service order by a provider
   * @param serviceOrderId - The ID of the service order to reject
   * @param providerId - The ID of the provider rejecting the order
   * @param reason - The reason for rejection
   * @returns The updated service order
   */
  async rejectServiceOrder(serviceOrderId: string, providerId: string, reason: string): Promise<ServiceOrder> {
    try {
      return await this.repository.rejectServiceOrder(serviceOrderId, providerId, reason);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error rejecting order: ${error}`);
      throw new ApiError(500, "Failed to reject order", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Marks a service order as out for delivery
   * @param serviceOrderId - The ID of the service order to mark as out for delivery
   * @param providerId - The ID of the provider updating the status
   * @returns The updated service order
   */
  async markOrderAsOutForDelivery(serviceOrderId: string, providerId: string): Promise<ServiceOrder> {
    try {
      return await this.repository.markOrderAsOutForDelivery(serviceOrderId, providerId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error marking order as out for delivery: ${error}`);
      throw new ApiError(500, "Failed to update order delivery status", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Completes the delivery of a service order
   * @param serviceOrderId - The ID of the service order to mark as delivered
   * @param providerId - The ID of the provider completing the delivery
   * @param confirmationCode - The confirmation code provided by the customer
   * @param disputeReason - Optional reason for dispute with the delivery
   * @returns The updated service order
   */
  async completeServiceOrderDelivery(
    serviceOrderId: string,
    providerId: string,
    confirmationCode: string,
    disputeReason?: string
  ): Promise<ServiceOrder> {
    try {
      return await this.repository.completeServiceOrderDelivery(
        serviceOrderId,
        providerId,
        confirmationCode,
        disputeReason
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error completing order delivery: ${error}`);
      throw new ApiError(500, "Failed to complete order delivery", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets all service orders for a provider, optionally filtered by status
   * @param providerId - The ID of the provider
   * @param status - Optional status to filter orders by
   * @returns An array of service orders
   */
  async getProviderServiceOrders(providerId: string, status?: ServiceOrderStatus): Promise<ServiceOrder[]> {
    try {
      return await this.repository.getProviderServiceOrders(providerId, status);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting provider orders: ${error}`);
      throw new ApiError(500, "Failed to get provider orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets all pending orders for a provider
   * @param providerId - The ID of the provider
   * @returns An array of pending service orders
   */
  async getProviderPendingOrders(providerId: string): Promise<ServiceOrder[]> {
    try {
      return await this.repository.getProviderPendingOrders(providerId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting provider pending orders: ${error}`);
      throw new ApiError(500, "Failed to get provider pending orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets all completed orders for a provider
   * @param providerId - The ID of the provider
   * @returns An array of completed service orders
   */
  async getProviderCompletedOrders(providerId: string): Promise<ServiceOrder[]> {
    try {
      return await this.repository.getProviderCompletedOrders(providerId);
    } catch(error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting provider completed orders: ${error}`);
      throw new ApiError(500, "Failed to get provider completed orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets all cancelled orders for a provider
   * @param providerId - The ID of the provider
   * @returns An array of cancelled service orders
   */
  async getProviderCancelledOrders(providerId: string): Promise<ServiceOrder[]> {
    try {
      return await this.repository.getProviderCancelledOrders(providerId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting provider cancelled orders: ${error}`);
      throw new ApiError(500, "Failed to get provider cancelled orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets all orders for a user, optionally filtered by status
   * @param userId - The ID of the user
   * @param status - Optional status to filter orders by
   * @param providerId - Optional provider ID for authorization check
   * @returns An array of service orders
   */
  async getUserOrders(userId: string, status?: ServiceOrderStatus, providerId?: string): Promise<ServiceOrder[]> {
    try {
      return await this.repository.getUserOrders(userId, status, providerId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting user orders: ${error}`);
      throw new ApiError(500, "Failed to get user orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets detailed information about a service order, including customer data
   * @param serviceOrderId - The ID of the service order
   * @returns Detailed service order information
   */
  async getServiceOrderWithDetails(serviceOrderId: string): Promise<any> {
    try {
      return await this.repository.getServiceOrderWithDetails(serviceOrderId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting order details: ${error}`);
      throw new ApiError(500, "Failed to get order details", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Adds a rating and feedback for a completed service order
   * @param serviceOrderId - The ID of the service order to rate
   * @param userId - The ID of the user submitting the rating
   * @param rating - The numerical rating (1-5)
   * @param comment - Optional comment or feedback
   * @returns The rating submission result
   */
  async addServiceOrderRating(
    serviceOrderId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await this.repository.addServiceOrderRating(serviceOrderId, userId, rating, comment);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error adding order rating: ${error}`);
      throw new ApiError(500, "Failed to add order rating", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Cancels a service order
   * @param serviceOrderId - The ID of the service order to cancel
   * @param userId - The ID of the user cancelling the order
   * @param reason - The reason for cancellation
   * @returns The updated service order
   */
  async cancelServiceOrder(serviceOrderId: string, userId: string, reason: string): Promise<ServiceOrder> {
    try {
      return await this.repository.cancelServiceOrder(serviceOrderId, userId, reason);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error cancelling order: ${error}`);
      throw new ApiError(500, "Failed to cancel order", ErrorCodes.ORDER_CANCELLATION_FAILED);
    }
  }

  /**
   * Validates a delivery confirmation code
   * @param serviceOrderId - The ID of the service order
   * @param providedCode - The confirmation code provided by the customer
   * @returns Boolean indicating if the code is valid
   */
  async validateDeliveryConfirmationCode(serviceOrderId: string, providedCode: string): Promise<boolean> {
    try {
      return await this.repository.validateDeliveryConfirmationCode(serviceOrderId, providedCode);
    } catch (error) {
      logger.error(`Service layer error validating confirmation code: ${error}`);
      throw new ApiError(500, "Failed to validate confirmation code", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Updates the pickup location for a service order
   * @param serviceOrderId - The ID of the service order
   * @param latitude - The latitude of the pickup location
   * @param longitude - The longitude of the pickup location
   * @returns The updated service order
   */
  async updateOrderPickupLocation(
    serviceOrderId: string,
    latitude: number,
    longitude: number
  ): Promise<ServiceOrder> {
    try {
      return await this.repository.updateOrderPickupLocation(serviceOrderId, latitude, longitude);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error updating pickup location: ${error}`);
      throw new ApiError(500, "Failed to update pickup location", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Gets dashboard statistics for a provider
   * @param providerId - The ID of the provider
   * @returns Dashboard statistics including orders and revenue
   */
  async getProviderDashboardStats(providerId: string): Promise<any> {
    try {
      return await this.repository.getProviderDashboardStats(providerId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Service layer error getting provider dashboard stats: ${error}`);
      throw new ApiError(500, "Failed to get dashboard statistics", ErrorCodes.INTERNAL_ERROR);
    }
  }
}