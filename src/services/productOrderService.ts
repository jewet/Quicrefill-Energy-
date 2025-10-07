import {
  PrismaClient,
  ProductOrder,
  OrderItem,
  TransactionStatus,
  OrderStatus,
  Voucher,
  PaymentMethod,
  VoucherType,
} from '@prisma/client';
import { generateTransactionReference } from '../utils/productOrderUtils';
import walletService from './walletService';
import paymentService from './paymentService';
import { ApiError } from '../lib/utils/errors/appError';
import { Decimal } from '@prisma/client/runtime/library';
import { cacheService, cacheKeys, CACHE_TTL } from '../utils/cacheUtils';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface CheckoutRequest {
  deliveryAddressId: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  voucherCode?: string;
  isNewCustomer?: boolean;
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
    httpBrowserLanguage?: string;
    httpBrowserJavaEnabled?: boolean;
    httpBrowserJavaScriptEnabled?: boolean;
    httpBrowserColorDepth?: number;
    httpBrowserScreenHeight?: number;
    httpBrowserScreenWidth?: number;
    httpBrowserTimeDifference?: string;
    userAgentBrowserValue?: string;
  };
}

export interface CheckoutResponse {
  orders: ProductOrder[];
  paymentDetails?: any;
  redirectUrl?: string;
  message?: string;
}

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    status: string;
    stock: number;
    price: Decimal;
    salePrice?: Decimal | null;
    productOwnerId: string;
    productTypeId?: string | null;
    category: { id: string; name: string } | null;
    orderCount: number;
  };
  vendor?: { id: string; userId: string; defaultDeliveryFee?: number | null };
}

export class ProductOrderService {
  /**
   * Fetches the admin-defined service charge from AdminSettings.
   */
  private async getServiceCharge(): Promise<Decimal> {
    try {
      const adminSettings = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultServiceCharge === null) {
        logger.warn('No AdminSettings found or defaultServiceCharge not set. Falling back to default: 0');
        return new Decimal(0);
      }
      return new Decimal(adminSettings.defaultServiceCharge);
    } catch (error: any) {
      logger.error('Error fetching service charge from AdminSettings:', { error: error.message });
      return new Decimal(0);
    }
  }

  /**
   * Fetches the admin-defined VAT rate from AdminSettings.
   */
  private async getVatRate(): Promise<Decimal> {
    try {
      const adminSettings = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultVatRate === null) {
        logger.warn('No AdminSettings found or defaultVatRate not set. Falling back to default: 0.075 (7.5%)');
        return new Decimal(0.075);
      }
      return new Decimal(adminSettings.defaultVatRate);
    } catch (error: any) {
      logger.error('Error fetching VAT rate from AdminSettings:', { error: error.message });
      return new Decimal(0.075);
    }
  }

  /**
   * Complete checkout process with payment
   */
  async checkoutWithPayment(userId: string, checkoutData: CheckoutRequest): Promise<CheckoutResponse> {
    return await prisma.$transaction(async (tx) => {
      try {
        logger.info(`Starting checkout process for user ${userId}`, { checkoutData });

        // Validate user exists
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) {
          logger.error('User not found', { userId });
          throw new ApiError(404, 'User not found');
        }

        // Validate delivery address
        const deliveryAddress = await tx.customerAddress.findFirst({
          where: { id: checkoutData.deliveryAddressId, userId: userId },
        });
        if (!deliveryAddress) {
          logger.error('Delivery address not found', {
            deliveryAddressId: checkoutData.deliveryAddressId,
            userId,
          });
          throw new ApiError(404, 'Delivery address not found');
        }

        // Validate card details for CARD payment
        if (checkoutData.paymentMethod === PaymentMethod.CARD) {
          this.validateCardDetails(checkoutData.cardDetails, userId);
        }

        // Get user's cart
        const cart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    productType: true,
                  },
                },
              },
            },
          },
        });

        if (!cart) {
          logger.error('No cart found for user', { userId });
          throw new ApiError(400, 'Cart not found');
        }
        if (cart.items.length === 0) {
          logger.error('Cart is empty', { userId, cartId: cart.id });
          throw new ApiError(400, 'Cart is empty');
        }

        // Validate cart items and group by vendor
        const itemsByVendor = await this.validateAndGroupCartItems(tx, cart.items);

        // Create orders for each vendor
        const createdOrders: ProductOrder[] = [];

        for (const [vendorId, items] of Object.entries(itemsByVendor)) {
          const order = await this.createOrderForVendor(tx, {
            userId,
            vendorId,
            items,
            deliveryAddressId: checkoutData.deliveryAddressId,
            paymentMethod: checkoutData.paymentMethod,
            notes: checkoutData.notes,
            voucherCode: checkoutData.voucherCode,
          });
          createdOrders.push(order);
        }

        // Process payment based on method
        const paymentResult = await this.processPaymentForOrders(
          tx,
          userId,
          createdOrders,
          checkoutData.paymentMethod,
          checkoutData.isNewCustomer || false,
          checkoutData.cardDetails
        );

        // Clear cart after successful order creation
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        // Invalidate cart cache
        await cacheService.set(cacheKeys.cart.byUserId(userId), null, { ttl: CACHE_TTL.CART });
        await cacheService.invalidateCartCache(userId);

        logger.info(`Checkout completed successfully for user ${userId}`, { orderCount: createdOrders.length });
        return {
          orders: createdOrders,
          ...paymentResult,
        };
      } catch (error: any) {
        logger.error('Checkout failed:', { error: error.message, userId, checkoutData });
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, 'Failed to process checkout', error.message);
      }
    });
  }

  /**
   * Validate cart items and group by vendor
   */
  private async validateAndGroupCartItems(
    tx: any,
    cartItems: CartItemWithProduct[]
  ): Promise<Record<string, CartItemWithProduct[]>> {
    const itemsByVendor: Record<string, CartItemWithProduct[]> = {};

    // Fetch VENDOR and ADMIN role IDs from the Role model
    const vendorRole = await tx.role.findFirst({ where: { name: 'VENDOR' } });
    const adminRole = await tx.role.findFirst({ where: { name: 'ADMIN' } });

    if (!vendorRole || !adminRole) {
      logger.error('VENDOR or ADMIN role not found in Role model');
      throw new ApiError(500, 'Required roles not found');
    }

    for (const item of cartItems) {
      if (!item.product) {
        logger.error('Product for cart item not found', { cartItemId: item.id });
        throw new ApiError(404, `Product for cart item not found`);
      }

      const product = item.product;

      if (product.status !== 'APPROVED') {
        logger.error('Product not available', { productId: product.id, productName: product.name });
        throw new ApiError(400, `Product ${product.name} is not available for purchase`);
      }

      if (product.stock < item.quantity) {
        logger.error('Insufficient stock', {
          productId: product.id,
          productName: product.name,
          stock: product.stock,
          requested: item.quantity,
        });
        throw new ApiError(400, `Not enough stock for ${product.name}. Only ${product.stock} units available.`);
      }

      const vendor = await tx.profile.findFirst({
        where: {
          userId: product.productOwnerId,
          roleId: { in: [vendorRole.id, adminRole.id] },
        },
      });

      if (!vendor) {
        logger.error('Vendor not found for product', { productId: product.id, productName: product.name });
        throw new ApiError(404, `Vendor for product ${product.name} not found`);
      }

      if (!itemsByVendor[vendor.id]) {
        itemsByVendor[vendor.id] = [];
      }
      itemsByVendor[vendor.id].push({
        ...item,
        vendor: { id: vendor.id, userId: vendor.userId, defaultDeliveryFee: vendor.defaultDeliveryFee },
      });
    }

    return itemsByVendor;
  }

  /**
   * Create order for a specific vendor
   */
  private async createOrderForVendor(
    tx: any,
    data: {
      userId: string;
      vendorId: string;
      items: CartItemWithProduct[];
      deliveryAddressId: string;
      paymentMethod: PaymentMethod;
      notes?: string;
      voucherCode?: string;
    }
  ): Promise<ProductOrder> {
    const { userId, vendorId, items, deliveryAddressId, paymentMethod, notes, voucherCode } = data;

    let subtotal = new Decimal(0);
    let deliveryFee = new Decimal(0);
    const orderItems: Omit<OrderItem, 'id' | 'orderId'>[] = [];

    const vendor = items[0].vendor;
    deliveryFee = new Decimal(vendor?.defaultDeliveryFee ?? 0);

    // Determine productTypeId
    const productTypeId = items[0].product.productTypeId || undefined;

    for (const item of items) {
      const product = item.product;
      const itemPrice = product.salePrice || product.price;
      const totalItemPrice = itemPrice.mul(item.quantity);
      subtotal = subtotal.add(totalItemPrice);

      orderItems.push({
        createdAt: new Date(),
        updatedAt: new Date(),
        productId: item.productId,
        quantity: item.quantity,
        accessoryId: null,
        price: itemPrice,
      });

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
          orderCount: { increment: 1 },
        },
      });
    }

    let voucherId: string | null = null;
    if (voucherCode) {
      const voucher = await tx.voucher.findUnique({ where: { code: voucherCode } });
      if (voucher && this.isVoucherValid(voucher)) {
        if (voucher.type === VoucherType.FIXED) {
          const discount = new Decimal(voucher.discount);
          deliveryFee = Decimal.max(new Decimal(0), deliveryFee.sub(discount));
        } else {
          const discountRate = new Decimal(voucher.discount).div(100);
          const discount = deliveryFee.mul(discountRate);
          deliveryFee = Decimal.max(new Decimal(0), deliveryFee.sub(discount));
        }
        voucherId = voucher.id;

        await tx.voucher.update({
          where: { id: voucher.id },
          data: { uses: { increment: 1 } },
        });
      }
    }

    const serviceCharge = await this.getServiceCharge();
    const preVatTotal = subtotal.add(deliveryFee).add(serviceCharge);
    const vatRate = await this.getVatRate();
    const vatAmount = preVatTotal.mul(vatRate);
    const total = preVatTotal.add(vatAmount);

    const customerReference = this.generateCustomerReference();

    const order = await tx.productOrder.create({
      data: {
        userId,
        vendorId,
        deliveryAddressId,
        subtotal,
        deliveryFee,
        serviceCharge,
        vatAmount,
        total,
        confirmationCode: this.generateConfirmationCode(),
        paymentMethod,
        paymentStatus: TransactionStatus.PENDING,
        orderStatus: OrderStatus.PENDING,
        notes,
        voucherId,
        customerReference,
        productTypeId,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        deliveryAddress: true,
        vendor: {
          include: { user: true },
        },
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PENDING,
        updatedBy: userId,
        entityType: 'PRODUCT_ORDER',
      },
    });

    logger.info(`Order created for vendor ${vendorId}`, { orderId: order.id, userId });
    return order;
  }

  /**
   * Process payment for orders
   */
  private async processPaymentForOrders(
    tx: any,
    userId: string,
    orders: ProductOrder[],
    paymentMethod: PaymentMethod,
    isNewCustomer: boolean,
    cardDetails?: CheckoutRequest['cardDetails']
  ): Promise<{ paymentDetails?: any; redirectUrl?: string; message?: string }> {
    const totalAmount = orders.reduce((sum: Decimal, order) => sum.add(order.total), new Decimal(0));

    if (paymentMethod === PaymentMethod.PAY_ON_DELIVERY && isNewCustomer) {
      logger.error('Pay on Delivery not available for new customers', { userId });
      throw new ApiError(403, 'Pay on Delivery is not available for new customers');
    }

    switch (paymentMethod) {
      case PaymentMethod.WALLET:
        return await this.processWalletPayment(tx, userId, totalAmount, orders);

      case PaymentMethod.TRANSFER:
        return await this.processTransferPayment(tx, userId, totalAmount, orders);

      case PaymentMethod.PAY_ON_DELIVERY:
        return await this.processPayOnDelivery(tx, userId, orders);

      case PaymentMethod.CARD:
      case PaymentMethod.MONNIFY:
        return await this.processOnlinePayment(tx, userId, totalAmount, orders, paymentMethod, cardDetails);

      default:
        logger.error('Unsupported payment method', { paymentMethod, userId });
        throw new ApiError(400, 'Unsupported payment method');
    }
  }

  /**
   * Process online payment (Card, Monnify)
   */
private async processOnlinePayment(
  tx: any,
  userId: string,
  totalAmount: Decimal,
  orders: ProductOrder[],
  paymentMethod: PaymentMethod,
  cardDetails?: CheckoutRequest['cardDetails']
): Promise<{ success: boolean; paymentDetails: any; redirectUrl?: string; message: string }> {
  const transactionRef = generateTransactionReference();

  // Validate card details for CARD payment
  if (paymentMethod === PaymentMethod.CARD) {
    this.validateCardDetails(cardDetails, userId, transactionRef);
  }

  // Transform cardDetails to match PaymentService's expected type
  const paymentServiceCardDetails = cardDetails
    ? {
        cardno: cardDetails.cardno,
        cvv: cardDetails.cvv,
        expirymonth: cardDetails.expirymonth,
        expiryyear: cardDetails.expiryyear,
        pin: cardDetails.pin,
        suggested_auth: cardDetails.suggested_auth,
        billingzip: cardDetails.billingzip,
        billingcity: cardDetails.billingcity,
        billingaddress: cardDetails.billingaddress,
        billingstate: cardDetails.billingstate,
        billingcountry: cardDetails.billingcountry,
        // Optional browser-related fields (omitted if undefined)
        httpBrowserLanguage: cardDetails.httpBrowserLanguage,
        httpBrowserJavaEnabled: cardDetails.httpBrowserJavaEnabled,
        httpBrowserJavaScriptEnabled: cardDetails.httpBrowserJavaScriptEnabled,
        httpBrowserColorDepth: cardDetails.httpBrowserColorDepth,
        httpBrowserScreenHeight: cardDetails.httpBrowserScreenHeight,
        httpBrowserScreenWidth: cardDetails.httpBrowserScreenWidth,
        httpBrowserTimeDifference: cardDetails.httpBrowserTimeDifference,
        userAgentBrowserValue: cardDetails.userAgentBrowserValue,
      }
    : undefined;

  try {
    // Process payment using PaymentService
    const paymentResult = await paymentService.processPayment(
      userId,
      parseFloat(totalAmount.toString()),
      paymentMethod,
      'product', // Assuming product purchase
      undefined, // serviceType
      orders[0]?.id, // itemId (using first order's ID, adjust if needed)
      transactionRef,
      undefined, // clientIp (could be passed if available)
      paymentServiceCardDetails
    );

    // Update orders based on payment result
    for (const order of orders) {
      await tx.productOrder.update({
        where: { id: order.id },
        data: {
          paymentMethod,
          paymentStatus: paymentResult.status === TransactionStatus.COMPLETED ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
          orderStatus: paymentResult.status === TransactionStatus.COMPLETED ? OrderStatus.PROCESSING : OrderStatus.PENDING,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: paymentResult.status === TransactionStatus.COMPLETED ? OrderStatus.PROCESSING : OrderStatus.PENDING,
          updatedBy: userId,
          entityType: 'PRODUCT_ORDER',
        },
      });
    }

    // Clear cart if payment is successful
    if (paymentResult.status === TransactionStatus.COMPLETED) {
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await cacheService.set(cacheKeys.cart.byUserId(userId), null, { ttl: CACHE_TTL.CART });
        await cacheService.invalidateCartCache(userId);
      }
    }

    logger.info(`${paymentMethod} payment initiated for user ${userId}`, {
      transactionRef,
      orderIds: orders.map((o) => o.id),
      paymentStatus: paymentResult.status,
    });

    return {
      success: paymentResult.status === TransactionStatus.COMPLETED,
      paymentDetails: paymentResult.paymentDetails,
      redirectUrl: paymentResult.redirectUrl,
      message: paymentResult.status === TransactionStatus.COMPLETED 
        ? `${paymentMethod} payment successful` 
        : `Please complete ${paymentMethod} payment`,
    };
  } catch (error: any) {
    logger.error(`Failed to process ${paymentMethod} payment for user ${userId}`, {
      error: error.message,
      transactionRef,
      orderIds: orders.map((o) => o.id),
    });
    throw new ApiError(500, `Failed to process ${paymentMethod} payment`, error.message);
  }
}
  /**
   * Process wallet payment
   */
  private async processWalletPayment(
    tx: any,
    userId: string,
    totalAmount: Decimal,
    orders: ProductOrder[]
  ): Promise<{ success: boolean; message: string; redirectUrl: string }> {
    const walletBalance = await walletService.getBalance(userId);

    if (walletBalance < parseFloat(totalAmount.toString())) {
      logger.error('Insufficient wallet balance', { userId, walletBalance, totalAmount: totalAmount.toString() });
      throw new ApiError(400, 'Insufficient wallet balance');
    }

    const vatRate = await this.getVatRate();

    for (const order of orders) {
      await walletService.payWithWallet(
        userId,
        parseFloat(order.total.toString()),
        order.id,
        null,
        'product',
        parseFloat(order.serviceCharge.toString()),
        parseFloat(vatRate.toString()),
        0,
        order.voucherId ? (await tx.voucher.findUnique({ where: { id: order.voucherId } }))?.code : undefined
      );

      await tx.productOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: TransactionStatus.COMPLETED,
          orderStatus: OrderStatus.PROCESSING,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PROCESSING,
          updatedBy: userId,
          entityType: 'PRODUCT_ORDER',
        },
      });
    }

    logger.info(`Wallet payment successful for user ${userId}`, { orderIds: orders.map((o) => o.id) });
    return {
      success: true,
      message: 'Wallet payment successful',
      redirectUrl: '/orders',
    };
  }

  /**
   * Process transfer payment
   */
  private async processTransferPayment(
    tx: any,
    userId: string,
    totalAmount: Decimal,
    orders: ProductOrder[]
  ): Promise<{ success: boolean; paymentDetails: any; message: string }> {
    const transactionRef = generateTransactionReference();

    const paymentResult = await paymentService.processPayment(
      userId,
      parseFloat(totalAmount.toString()),
      PaymentMethod.TRANSFER,
      'product',
      undefined,
      transactionRef
    );

    for (const order of orders) {
      await tx.productOrder.update({
        where: { id: order.id },
        data: {
          paymentMethod: PaymentMethod.TRANSFER,
          paymentStatus: TransactionStatus.PENDING,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PENDING,
          updatedBy: userId,
          entityType: 'PRODUCT_ORDER',
        },
      });
    }

    logger.info(`Transfer payment initiated for user ${userId}`, { transactionRef, orderIds: orders.map((o) => o.id) });
    return {
      success: true,
      paymentDetails: paymentResult.paymentDetails,
      message: 'Please transfer the amount to the provided bank details.',
    };
  }

  /**
   * Process pay on delivery
   */
  private async processPayOnDelivery(
    tx: any,
    userId: string,
    orders: ProductOrder[]
  ): Promise<{ success: boolean; message: string; redirectUrl: string }> {
    for (const order of orders) {
      await tx.productOrder.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.ORDER_RECEIVED,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.ORDER_RECEIVED,
          updatedBy: userId,
          entityType: 'PRODUCT_ORDER',
        },
      });
    }

    logger.info(`Pay on Delivery confirmed for user ${userId}`, { orderIds: orders.map((o) => o.id) });
    return {
      success: true,
      message: 'Pay on Delivery order confirmed',
      redirectUrl: '/orders',
    };
  }

  /**
   * Creates a new product order from cart items (legacy method)
   */
  async createProductOrder(
    userId: string,
    deliveryAddressId: string,
    paymentMethod: PaymentMethod,
    notes?: string,
    voucherCode?: string,
    cardDetails?: CheckoutRequest['cardDetails']
  ): Promise<ProductOrder[]> {
    const checkoutData: CheckoutRequest = {
      deliveryAddressId,
      paymentMethod,
      notes,
      voucherCode,
      cardDetails,
    };

    logger.info(`Creating product order for user ${userId}`, { deliveryAddressId, paymentMethod });
    const result = await this.checkoutWithPayment(userId, checkoutData);
    return result.orders;
  }

  /**
   * Process payment for existing orders
   */
  async processPaymentForExistingOrders(
    userId: string,
    orderIds: string[],
    paymentMethod: PaymentMethod,
    isNewCustomer: boolean = false,
    cardDetails?: CheckoutRequest['cardDetails']
  ): Promise<{ success: boolean; redirectUrl?: string; message?: string; paymentDetails?: any }> {
    return await prisma.$transaction(async (tx) => {
      try {
        const orders = await tx.productOrder.findMany({
          where: {
            id: { in: orderIds },
            userId,
          },
          include: {
            payments: true,
          },
        });

        if (orders.length !== orderIds.length) {
          logger.error('One or more orders not found', { userId, orderIds });
          throw new ApiError(404, 'One or more orders not found');
        }

        // Check for existing payments
        for (const order of orders) {
          if (order.paymentStatus === TransactionStatus.COMPLETED) {
            logger.warn('Payment already completed for order', { orderId: order.id, userId });
            throw new ApiError(400, 'Payment already completed for order');
          }
          if (order.paymentStatus === TransactionStatus.PENDING) {
            const payment = order.payments.find((p) => p.status === TransactionStatus.PENDING);
            if (payment) {
              logger.warn('Payment already initiated for order', { orderId: order.id, userId, transactionRef: payment.transactionRef });
              throw new ApiError(400, `Payment already initiated for order. Verify payment with transaction reference: ${payment.transactionRef}`);
            }
          }
        }

        // Validate card details for CARD payment
        if (paymentMethod === PaymentMethod.CARD) {
          this.validateCardDetails(cardDetails, userId);
        }

        if (paymentMethod === PaymentMethod.PAY_ON_DELIVERY && isNewCustomer) {
          logger.error('Pay on Delivery not available for new customers', { userId });
          throw new ApiError(403, 'Pay on Delivery is not available for new customers');
        }

        const totalAmount = orders.reduce((sum: Decimal, order) => sum.add(order.total), new Decimal(0));

        switch (paymentMethod) {
          case PaymentMethod.WALLET:
            return await this.processWalletPayment(tx, userId, totalAmount, orders);

          case PaymentMethod.TRANSFER:
            return await this.processTransferPayment(tx, userId, totalAmount, orders);

          case PaymentMethod.PAY_ON_DELIVERY:
            return await this.processPayOnDelivery(tx, userId, orders);

          case PaymentMethod.CARD:
          case PaymentMethod.MONNIFY:
            return await this.processOnlinePayment(tx, userId, totalAmount, orders, paymentMethod, cardDetails);

          default:
            logger.error('Unsupported payment method', { paymentMethod, userId });
            throw new ApiError(400, 'Unsupported payment method');
        }
      } catch (error: any) {
        logger.error('Payment processing failed:', { error: error.message, userId, orderIds });
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, 'Failed to process payment', error.message);
      }
    });
  }

  /**
   * Verify payment for transfer-based orders
   */
  async verifyPayment(
    orderIds: string[],
    transactionRef: string
  ): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
    return await prisma.$transaction(async (tx) => {
      try {
        const orders = await tx.productOrder.findMany({
          where: {
            id: { in: orderIds },
            paymentMethod: PaymentMethod.TRANSFER,
          },
        });

        if (orders.length !== orderIds.length) {
          logger.error('One or more orders not found or not transfer payments', { orderIds });
          throw new ApiError(404, 'One or more orders not found or not transfer payments');
        }

        const verificationResult = await paymentService.verifyPayment(transactionRef);

        if (verificationResult.status === TransactionStatus.COMPLETED) {
          for (const order of orders) {
            await tx.productOrder.update({
              where: { id: order.id },
              data: {
                paymentStatus: TransactionStatus.COMPLETED,
                orderStatus: OrderStatus.PROCESSING,
              },
            });

            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                status: OrderStatus.PROCESSING,
                updatedBy: order.userId,
                entityType: 'PRODUCT_ORDER',
              },
            });
          }

          logger.info('Payment verified successfully', { orderIds, transactionRef });
          return {
            success: true,
            message: 'Payment verified successfully',
            redirectUrl: '/orders',
          };
        } else {
          for (const order of orders) {
            await tx.productOrder.update({
              where: { id: order.id },
              data: {
                paymentStatus: TransactionStatus.FAILED,
              },
            });
          }

          logger.error('Payment verification failed', { orderIds, transactionRef });
          return {
            success: false,
            message: 'Payment verification failed',
          };
        }
      } catch (error: any) {
        logger.error('Payment verification failed:', { error: error.message, orderIds, transactionRef });
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, 'Failed to verify payment', error.message);
      }
    });
  }

  private validateCardDetails(cardDetails: CheckoutRequest['cardDetails'] | undefined, userId: string, transactionRef?: string): void {
    if (!cardDetails) {
      logger.error('Card details are required for CARD payment', { userId, transactionRef });
      throw new ApiError(400, 'Card details are required for CARD payment');
    }
    // Additional runtime checks
    if (!cardDetails.cardno || !cardDetails.cvv || !cardDetails.expirymonth || !cardDetails.expiryyear) {
      logger.error('Incomplete card details provided', { userId, transactionRef });
      throw new ApiError(400, 'Incomplete card details: cardno, cvv, expirymonth, and expiryyear are required');
    }
  }

  /**
   * Get order history for user
   */
  async getOrderHistory(
    userId: string,
    query: any = {}
  ): Promise<{ orders: ProductOrder[]; totalCount: number }> {
    try {
      const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = query;

      const where: any = { userId };
      if (status) {
        where.orderStatus = status;
      }

      const totalCount = await prisma.productOrder.count({ where });

      const orders = await prisma.productOrder.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveryAddress: true,
          vendor: {
            include: { user: true },
          },
          agent: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      logger.info(`Fetched order history for user ${userId}`, { totalCount, page, limit });
      return { orders, totalCount };
    } catch (error: any) {
      logger.error('Failed to get order history:', { error: error.message, userId, query });
      throw new ApiError(500, 'Failed to fetch order history');
    }
  }

  /**
   * Get all orders for admin/vendor
   */
  async getAllOrders(
    userRole: string,
    userId: string,
    query: any = {}
  ): Promise<{ orders: ProductOrder[]; totalCount: number }> {
    try {
      const { status, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = query;

      const where: any = {};

      // Fetch VENDOR role ID
      const vendorRole = await prisma.role.findFirst({ where: { name: 'VENDOR' } });
      if (!vendorRole) {
        logger.error('VENDOR role not found');
        throw new ApiError(500, 'VENDOR role not found');
      }

      if (userRole === vendorRole.id) {
        where.vendorId = userId;
      }

      if (status) {
        where.orderStatus = status;
      }

      const totalCount = await prisma.productOrder.count({ where });

      const orders = await prisma.productOrder.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          deliveryAddress: true,
          vendor: {
            include: { user: true },
          },
          agent: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      logger.info(`Fetched all orders for role ${userRole} user ${userId}`, { totalCount, page, limit });
      return { orders, totalCount };
    } catch (error: any) {
      logger.error('Failed to get all orders:', { error: error.message, userId, userRole, query });
      throw new ApiError(500, 'Failed to fetch orders');
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    userId: string,
    notes?: string
  ): Promise<ProductOrder> {
    return await prisma.$transaction(async (tx) => {
      try {
        const order = await tx.productOrder.findUnique({
          where: { id: orderId },
          include: {
            items: true,
          },
        });

        if (!order) {
          logger.error('Order not found', { orderId, userId });
          throw new ApiError(404, 'Order not found');
        }

        this.validateStatusTransition(order.orderStatus, status);

        if (status === OrderStatus.CANCELLED) {
          for (const item of order.items) {
            if (item.productId) {
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: { increment: item.quantity },
                  orderCount: { decrement: 1 },
                },
              });
            }
          }
        }

        const additionalData: any = {};
        if (status === OrderStatus.DELIVERED && !order.completedAt) {
          additionalData.completedAt = new Date();

          if (order.createdAt) {
            const deliveryTimeMinutes = Math.floor(
              (new Date().getTime() - order.createdAt.getTime()) / (1000 * 60)
            );
            additionalData.deliveryTime = this.formatDeliveryTime(deliveryTimeMinutes);
          }
        }

        const updatedOrder = await tx.productOrder.update({
          where: { id: orderId },
          data: {
            orderStatus: status,
            ...additionalData,
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            deliveryAddress: true,
            vendor: {
              include: { user: true },
            },
            agent: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
              },
            },
            statusHistory: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            status,
            updatedBy: userId,
            entityType: 'PRODUCT_ORDER',
            notes,
          },
        });

        logger.info(`Order ${orderId} status updated to ${status} by user ${userId}`, { notes });
        return updatedOrder;
      } catch (error: any) {
        logger.error('Failed to update order status:', { error: error.message, orderId, userId });
        if (error instanceof ApiError) throw error;
        throw new ApiError(500, 'Failed to update order status');
      }
    });
  }

  /**
   * Get order by ID with role-based access control
   */
  async getOrderById(
    orderId: string,
    userId?: string,
    roleId?: string
  ): Promise<ProductOrder & { timeline?: { time: string; status: string; description: string; actor: string }[] }> {
    try {
      const order = await prisma.productOrder.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          deliveryAddress: true,
          vendor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                },
              },
            },
          },
          agent: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  roleId: true,
                },
              },
            },
          },
          payments: true,
          reviews: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        logger.error('Order not found', { orderId, userId, roleId });
        throw new ApiError(404, 'Order not found');
      }

      if (userId && roleId) {
        const customerRole = await prisma.role.findFirst({ where: { name: 'CUSTOMER' } });
        const vendorRole = await prisma.role.findFirst({ where: { name: 'VENDOR' } });
        const deliveryAgentRole = await prisma.role.findFirst({ where: { name: 'DELIVERY_AGENT' } });

        if (!customerRole || !vendorRole || !deliveryAgentRole) {
          logger.error('Required roles not found');
          throw new ApiError(500, 'Required roles not found');
        }

        if (roleId === customerRole.id && order.userId !== userId) {
          logger.error('Invalid order access for customer', { orderId, userId });
          throw new ApiError(403, 'Invalid order');
        }

        if (roleId === vendorRole.id && order.vendorId !== userId) {
          logger.error('Invalid order access for vendor', { orderId, userId });
          throw new ApiError(403, "I don't have an order for this product");
        }

        if (roleId === deliveryAgentRole.id && order.agentId !== userId) {
          logger.error('Invalid order access for delivery agent', { orderId, userId });
          throw new ApiError(403, "You don't have permission to view this order");
        }
      }

      const timeline = this.generateOrderTimeline(order.statusHistory);

      logger.info(`Fetched order ${orderId} for user ${userId || 'anonymous'}`, { roleId });
      return { ...order, timeline };
    } catch (error: any) {
      logger.error('Failed to get order by ID:', { error: error.message, orderId, userId, roleId });
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to fetch order details');
    }
  }

  /**
   * Assign delivery agent to order
   */
  async assignDeliveryAgent(
    orderId: string,
    agentId: string,
    assignedById: string
  ): Promise<ProductOrder> {
    try {
      const order = await prisma.productOrder.findUnique({ where: { id: orderId } });
      if (!order) {
        logger.error('Order not found', { orderId, assignedById });
        throw new ApiError(404, 'Order not found');
      }

      const deliveryAgentRole = await prisma.role.findFirst({ where: { name: 'DELIVERY_AGENT' } });
      if (!deliveryAgentRole) {
        logger.error('DELIVERY_AGENT role not found');
        throw new ApiError(500, 'DELIVERY_AGENT role not found');
      }

      const agent = await prisma.user.findFirst({
        where: {
          id: agentId,
          roleId: deliveryAgentRole.id,
        },
      });

      if (!agent) {
        logger.error('Delivery agent not found', { agentId, assignedById });
        throw new ApiError(404, 'Delivery agent not found');
      }

      const updatedOrder = await prisma.productOrder.update({
        where: { id: orderId },
        data: {
          agentId,
          orderStatus: OrderStatus.AGENT_ASSIGNED,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveryAddress: true,
          vendor: {
            include: { user: true },
          },
          agent: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.AGENT_ASSIGNED,
          updatedBy: assignedById,
          entityType: 'PRODUCT_ORDER',
        },
      });

      logger.info(`Delivery agent ${agentId} assigned to order ${orderId} by user ${assignedById}`);
      return updatedOrder;
    } catch (error: any) {
      logger.error('Failed to assign delivery agent:', { error: error.message, orderId, agentId, assignedById });
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to assign delivery agent');
    }
  }

  /**
   * Verify delivery confirmation code
   */
  async verifyConfirmationCode(
    orderId: string,
    code: string,
    agentId: string
  ): Promise<ProductOrder> {
    try {
      const order = await prisma.productOrder.findUnique({ where: { id: orderId } });

      if (!order) {
        logger.error('Order not found', { orderId, agentId });
        throw new ApiError(404, 'Order not found');
      }

      if (order.agentId !== agentId) {
        logger.error('Agent not assigned to order', { orderId, agentId });
        throw new ApiError(403, 'You are not assigned to this order');
      }

      if (order.confirmationCode !== code) {
        logger.error('Invalid confirmation code', { orderId, agentId });
        throw new ApiError(400, 'Invalid confirmation code');
      }

      const updatedOrder = await this.updateOrderStatus(
        orderId,
        OrderStatus.DELIVERED,
        agentId,
        'Delivery confirmed with code'
      );

      logger.info(`Delivery confirmed for order ${orderId} by agent ${agentId}`);
      return updatedOrder;
    } catch (error: any) {
      logger.error('Failed to verify confirmation code:', { error: error.message, orderId, agentId });
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to verify confirmation code');
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    orderId: string,
    status: TransactionStatus,
    userId: string
  ): Promise<ProductOrder> {
    try {
      const order = await prisma.productOrder.findUnique({ where: { id: orderId } });

      if (!order) {
        logger.error('Order not found', { orderId, userId });
        throw new ApiError(404, 'Order not found');
      }

      const updatedOrder = await prisma.productOrder.update({
        where: { id: orderId },
        data: {
          paymentStatus: status,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveryAddress: true,
          agent: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
        },
      });

      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          status: order.orderStatus,
          updatedBy: userId,
          entityType: 'PRODUCT_ORDER',
        },
      });

      logger.info(`Payment status updated to ${status} for order ${orderId} by user ${userId}`);
      return updatedOrder;
    } catch (error: any) {
      logger.error('Failed to update payment status:', { error: error.message, orderId, userId });
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, 'Failed to update payment status');
    }
  }

  /**
   * Checks if a voucher is valid
   */
  private isVoucherValid(voucher: Voucher): boolean {
    const isValid =
      voucher.isActive &&
      voucher.validUntil > new Date() &&
      (voucher.maxUses === null || voucher.uses < voucher.maxUses);
    logger.info(`Voucher validation for ${voucher.code}`, { isValid, voucherId: voucher.id });
    return isValid;
  }

  /**
   * Generates a random 4-digit confirmation code
   */
  private generateConfirmationCode(): string {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    logger.debug(`Generated confirmation code: ${code}`);
    return code;
  }

  /**
   * Generates a unique customer reference
   */
  private generateCustomerReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reference = `ORD-${timestamp}-${random}`;
    logger.debug(`Generated customer reference: ${reference}`);
    return reference;
  }

  /**
   * Validates order status transitions
   */
  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.AGENT_ASSIGNED, OrderStatus.CANCELLED],
      [OrderStatus.AGENT_ASSIGNED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REJECTED]: [],
      [OrderStatus.OUT_OF_STOCK]: [],
      [OrderStatus.PAYMENT_RECEIVED]: [OrderStatus.PROCESSING],
      [OrderStatus.ORDER_RECEIVED]: [OrderStatus.PENDING],
      [OrderStatus.DISPUTED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      logger.error('Invalid status transition', { currentStatus, newStatus });
      throw new ApiError(400, `Cannot transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Formats delivery time from minutes to a readable string
   */
  private formatDeliveryTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
  }

  /**
   * Generates a timeline from order status history
   */
  private generateOrderTimeline(
    statusHistory: any[]
  ): Array<{ time: string; status: string; description: string; actor: string }> {
    if (!statusHistory || statusHistory.length === 0) {
      return [];
    }

    const timeline = statusHistory.map((entry) => ({
      time: new Date(entry.createdAt).toLocaleString(),
      status: entry.status,
      description: entry.notes || `Order status changed to ${entry.status}`,
      actor: entry.user ? entry.user.name : 'System',
    }));
    logger.debug(`Generated order timeline`, { timeline });
    return timeline;
  }
}

export default new ProductOrderService();