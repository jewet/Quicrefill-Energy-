import { PrismaClient, Prisma , ServiceOrder, ServiceOrderStatus, TransactionStatus, PaymentMethod, VoucherType,  TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import crypto from "crypto";
import { logger } from "../utils/logger";
import { ApiError } from "../errors/ApiError";
import { ErrorCodes } from "../errors/errorCodes";
import { ServiceService } from "../services/serviceService";
import PaymentService from "../services/paymentService";
import WalletService from "../services/walletService"; 

import axios from "axios";

const prisma = new PrismaClient();

// Define the Voucher type according to expected structure
type Voucher = {
  id: string;
  code: string;
  type: VoucherType;
  discount: number;
  maxUses?: number | null;
  maxUsesPerUser?: number | null;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
};

// Define WalletTransaction interface to match WalletService
interface WalletTransaction {
  id: string;
  userId: string;
  walletId: string;
  amount: Decimal;
  transactionType: TransactionType | null;
  status: TransactionStatus;
  paymentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Prisma.JsonValue | null;
  serviceOrderId?: string | null;
  productOrderId?: string | null;
  electricityProviderId?: number | null;
  billerCode?: string | null;
  transactionRef?: string | null;
  vendorId?: string | null;
}

// Define PaymentResult interface to type paymentResult
interface PaymentResult {
  transactionId: string;
  paymentDetails?: {
    paymentType?: string;
    baseAmount?: number;
    serviceFee?: number;
    topupCharge?: number;
    vat?: number;
    totalAmount?: number;
    auth_url?: string;
    paymentReference?: string;
    transactionStatus?: string;
    authorization?: any;
    tokenId?: string;
    secure3dData?: { id: string; redirectUrl: string };
    virtualAccount?: { accountNumber: string; bankName: string; accountReference: string; expiryDate?: string; note?: string; amount?: string };
    bankTransfer?: { accountReference: string; accountNumber: string; bankName: string; accountExpiration: string; narration: string; transferAmount: string };
    recipient?: string;
    recipientDetails?: {
      vendorId?: string;
      itemAccount?: { accountNumber: string; bankName: string };
      deliveryAccount?: { accountNumber: string; bankName: string };
      merchantAccount?: { accountNumber: string; bankName: string };
    };
    refundReference?: string;
    refundStatus?: string;
    voucherCode?: string;
    voucherDiscount?: number;
    transactions?: { type: string; amount: number; status: TransactionStatus; reference: string }[];
    electricityToken?: string;
  };
  redirectUrl?: string;
  status: string;
  electricityToken?: string;
}

// Define interface for PaymentService to match its public methods
interface IPaymentService {
  checkPaymentMethodStatus(
    paymentMethod: PaymentMethod
  ): Promise<{
    paymentMethod: string;
    isEnabled: boolean;
    gateway: string | null;
    lastUpdated: Date | null;
    updatedBy: string | null;
  }>;
  processPayment(
    userId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    productType?: string,
    serviceType?: string,
    itemId?: string,
    transactionRef?: string,
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
      httpBrowserLanguage?: string;
      httpBrowserJavaEnabled?: boolean;
      httpBrowserJavaScriptEnabled?: boolean;
      httpBrowserColorDepth?: number;
      httpBrowserScreenHeight?: number;
      httpBrowserScreenWidth?: number;
      httpBrowserTimeDifference?: string;
      userAgentBrowserValue?: string;
    },
    isWalletTopUp?: boolean,
    meterNumber?: string,
    voucherCode?: string
  ): Promise<PaymentResult>;
  processBillPayment(
    userId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    meterNumber: string,
    destinationBankCode: string,
    destinationAccountNumber: string,
    transactionRef?: string,
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
    },
    clientIp?: string,
    voucherCode?: string
  ): Promise<PaymentResult>;
  processRefund(
    transactionRef: string,
    userId: string,
    amount: number,
    paymentReference?: string
  ): Promise<void>;
}

// Update WalletService interface to match the actual WalletService class
interface WalletService {
  payWithWallet(
    userId: string,
    amount: number,
    orderId: string,
    serviceType: string | null,
    productType: string | null,
    serviceCharge: number,
    vatRate: number,
    petroleumTax: number,
    voucherCode?: string
  ): Promise<WalletTransaction>;
}

// Inline utility functions
const generateUUID = () => crypto.randomUUID();

const generateTransactionReference = (): string => `SER-${crypto.randomUUID()}-${Date.now()}`;

const generateCustomerReference = (): string => `ORD-${crypto.randomUUID()}-${Date.now()}`;

export class ServiceOrderRepository {
  private readonly serviceService: ServiceService;
  private readonly paymentService: IPaymentService; 
  private readonly walletService: WalletService;

  constructor() {
    this.serviceService = new ServiceService(); // Assuming ServiceService needs instantiation
    this.paymentService = PaymentService; // Use the imported singleton instance
    this.walletService = WalletService; // Use the imported singleton instance
  }

  /**
   * Fetch the admin-defined petroleum tax rate from AdminSettings.
   * Falls back to a default value (0.05 or 5%) if no setting exists.
   * @returns A promise resolving to the petroleum tax rate (as a decimal, e.g., 0.05 for 5%).
   * @private
   */
  private async getPetroleumTaxRate(): Promise<number> {
    try {
      const adminSettings = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultPetroleumTaxRate === null || adminSettings.defaultPetroleumTaxRate === undefined) {
        logger.warn("No AdminSettings found or defaultPetroleumTaxRate not set. Falling back to default: 0.05 (5%)");
        return 0.05; // Default 5% petroleum tax
      }
      return adminSettings.defaultPetroleumTaxRate;
    } catch (error: any) {
      logger.error("Error fetching petroleum tax rate from AdminSettings:", error.message);
      return 0.05;
    }
  }


  /**
   * Fetch the admin-defined service charge from AdminSettings
   * Falls back to a default value if no setting exists.
   * @returns A promise resolving to the service fee.
   * @private
   */
  private async getServiceCharge(): Promise<number> {
    try {
      const adminSettings = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultServiceCharge === null) {
        logger.warn("No AdminSettings found or defaultServiceCharge not set. Falling back to default: 700");
        return 700;
      }
      return adminSettings.defaultServiceCharge;
    } catch (error: any) {
      logger.error("Error fetching service charge from AdminSettings:", error.message);
      return 700;
    }
  }

  /**
   * Fetches the admin-defined VAT rate from AdminSettings.
   * Falls back to a default value (0.075 or 7.5%) if no setting exists.
   * @returns A promise resolving to the VAT rate (as a decimal, e.g., 0.075 for 7.5%).
   * @private
   */
  private async getVatRate(): Promise<number> {
    try {
      const adminSettings = await prisma.adminSettings.findFirst();
      if (!adminSettings || adminSettings.defaultVatRate === null) {
        logger.warn("No AdminSettings found or defaultVatRate not set. Falling back to default: 0.075 (7.5%)");
        return 0.075;
      }
      return adminSettings.defaultVatRate;
    } catch (error: any) {
      logger.error("Error fetching VAT rate from AdminSettings:", error.message);
      return 0.075;
    }
  }

  /**
   * Calculates the distance between two points using PostGIS and Google Maps Distance Matrix API.
   * @param originLat Latitude of the origin (service location)
   * @param originLng Longitude of the origin (service location)
   * @param destLat Latitude of the destination (delivery address)
   * @param destLng Longitude of the destination (delivery address)
   * @returns Object containing straight-line distance, road distance, and estimated travel time
   */
  private async calculateDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<{
    straightLineDistanceKm: number;
    roadDistanceKm: number | null;
    travelTimeSeconds: number | null;
  }> {
    try {
      // PostGIS straight-line distance
      const distanceResult = await prisma.$queryRaw<[{ distance: number }]>`
        SELECT 
          ST_Distance(
            ST_SetSRID(ST_MakePoint(${originLng}, ${originLat}), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326)::geography
          ) / 1000 as distance
      `;
      if (!distanceResult || !distanceResult[0]) {
        throw new ApiError(500, "Failed to calculate distance with PostGIS", ErrorCodes.GEOSPATIAL_CALCULATION_FAILED);
      }
      const straightLineDistanceKm = distanceResult[0].distance;

      // Google Maps Distance Matrix API
      let roadDistanceKm: number | null = null;
      let travelTimeSeconds: number | null = null;
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          logger.warn("Google Maps API key not found, skipping road distance calculation");
          return { straightLineDistanceKm, roadDistanceKm: null, travelTimeSeconds: null };
        }

        const response = await axios.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
          params: {
            origins: `${originLat},${originLng}`,
            destinations: `${destLat},${destLng}`,
            key: apiKey,
            mode: "driving",
          },
        });

        const result = response.data.rows[0]?.elements[0];
        if (result?.status === "OK") {
          roadDistanceKm = result.distance.value / 1000; // Convert meters to kilometers
          travelTimeSeconds = result.duration.value; // Duration in seconds
        } else {
          logger.warn(`Google Maps API returned non-OK status: ${result?.status}`);
        }
      } catch (error) {
        logger.error(`Error calling Google Maps API: ${error}`);
      }

      return { straightLineDistanceKm, roadDistanceKm, travelTimeSeconds };
    } catch (error) {
      logger.error(`Error calculating distance: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to calculate distance", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Checks if the service is within the provider's radius or suggests nearby services.
   * @param serviceId The ID of the requested service
   * @param addressId The ID of the delivery address
   * @returns Object containing availability, additional fee, suggested services, and distance info
   */
  private async checkServiceAvailability(
    serviceId: string,
    addressId: string
  ): Promise<{
    isAvailable: boolean;
    additionalFee: number;
    suggestedServices: any[];
    distanceKm: number;
    serviceRadiusKm: number;
  }> {
    try {
      if (!serviceId) {
        throw new ApiError(400, "Service ID is required", ErrorCodes.INVALID_INPUT);
      }

      const address = await prisma.customerAddress.findUnique({
        where: { id: addressId },
        select: { latitude: true, longitude: true },
      });
      if (!address || address.latitude === null || address.longitude === null) {
        throw new ApiError(404, "Delivery address location not found", ErrorCodes.ADDRESS_LOCATION_NOT_FOUND);
      }

      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { latitude: true, longitude: true, serviceRadius: true, serviceTypeId: true, deliveryCost: true },
      });
      if (!service || service.latitude === null || service.longitude === null || service.serviceRadius === null) {
        throw new ApiError(404, "Service or service location not found", ErrorCodes.SERVICE_LOCATION_NOT_FOUND);
      }

      // Calculate distance
      const { straightLineDistanceKm, roadDistanceKm } = await this.calculateDistance(
        service.latitude,
        service.longitude,
        address.latitude,
        address.longitude
      );
      const distanceKm = roadDistanceKm ?? straightLineDistanceKm; // Prefer road distance if available
      const serviceRadiusKm = service.serviceRadius;
      const maxRadiusWithFee = serviceRadiusKm * 1.5; // Allow 50% extra radius with additional fee
      let additionalFee = 0;

      if (distanceKm <= serviceRadiusKm) {
        return { isAvailable: true, additionalFee: 0, suggestedServices: [], distanceKm, serviceRadiusKm };
      } else if (distanceKm <= maxRadiusWithFee) {
        // Use deliveryCost as the per-kilometer cost for additional distance
        const deliveryCostPerKm = service.deliveryCost ? service.deliveryCost.toNumber() : 0;
        additionalFee = (distanceKm - serviceRadiusKm) * deliveryCostPerKm;
        return { isAvailable: true, additionalFee, suggestedServices: [], distanceKm, serviceRadiusKm };
      } else {
        // Service is too far; suggest nearby services
        const nearbyServices = await this.serviceService.getNearbyServices(
          address.latitude,
          address.longitude,
          serviceRadiusKm,
          service.serviceTypeId,
          true, // isOpen
          1, // page
          5 // pageSize
        );
        return {
          isAvailable: false,
          additionalFee: 0,
          suggestedServices: nearbyServices.data || [],
          distanceKm,
          serviceRadiusKm,
        };
      }
    } catch (error) {
      logger.error(`Error checking service availability: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to check service availability", ErrorCodes.INTERNAL_ERROR);
    }
  }

/**
   * Process non-electricity payment using PaymentService.processPayment.
   * @param userId User ID
   * @param orderTotals Order totals from calculateServiceOrderTotal
   * @param serviceType Service type name
   * @param serviceId Service ID
   * @param paymentMethod Payment method
   * @param clientIp Client IP for fraud detection
   * @param cardDetails Card details for CARD payments
   * @param voucherCode Optional voucher code
   * @returns Payment result
   * @private
   */
 private async processPayment(
    userId: string,
    orderTotals: {
      totalAmount: Decimal;
      serviceSubtotal: Decimal;
      serviceFee: number;
      vatRate: Decimal;
      petroleumTax: number;
    },
    serviceType: string | undefined,
    serviceId: string,
    paymentMethod: PaymentMethod,
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
    voucherCode?: string
  ): Promise<PaymentResult> {
    try {
      const paymentMethodStatus = await this.paymentService.checkPaymentMethodStatus(paymentMethod);
      if (!paymentMethodStatus.isEnabled) {
        throw new ApiError(400, `Payment method ${paymentMethod} is currently disabled`, ErrorCodes.PAYMENT_METHOD_NOT_AVAILABLE);
      }

      return await this.paymentService.processPayment(
        userId,
        orderTotals.totalAmount.toNumber(),
        paymentMethod,
        undefined,
        serviceType,
        serviceId,
        generateTransactionReference(),
        clientIp,
        cardDetails,
        false,
        undefined,
        voucherCode
      );
    } catch (error) {
      logger.error(`Error processing payment: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to process payment", ErrorCodes.PAYMENT_PROCESSING_FAILED);
    }
  }

  /**
   * Process electricity bill payment using PaymentService.processBillPayment.
   * @param userId User ID
   * @param orderTotals Order totals from calculateServiceOrderTotal
   * @param serviceType Service type name
   * @param serviceId Service ID
   * @param paymentMethod Payment method
   * @param meterNumber Meter number for electricity
   * @param destinationBankCode Bank code for electricity payment
   * @param destinationAccountNumber Account number for electricity payment
   * @param clientIp Client IP for fraud detection
   * @param cardDetails Card details for CARD payments
   * @param voucherCode Optional voucher code
   * @returns Payment result
   * @private
   */
  private async processBillPayment(
    userId: string,
    orderTotals: {
      totalAmount: Decimal;
      serviceSubtotal: Decimal;
      serviceFee: number;
      vatRate: Decimal;
      petroleumTax: number;
    },
    serviceType: string | undefined,
    serviceId: string,
    paymentMethod: PaymentMethod,
    meterNumber: string,
    destinationBankCode: string,
    destinationAccountNumber: string,
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
    voucherCode?: string
  ): Promise<PaymentResult> {
    try {
      const paymentMethodStatus = await this.paymentService.checkPaymentMethodStatus(paymentMethod);
      if (!paymentMethodStatus.isEnabled) {
        throw new ApiError(400, `Payment method ${paymentMethod} is currently disabled`, ErrorCodes.PAYMENT_METHOD_NOT_AVAILABLE);
      }

      return await this.paymentService.processBillPayment(
        userId,
        orderTotals.totalAmount.toNumber(),
        paymentMethod,
        meterNumber,
        destinationBankCode,
        destinationAccountNumber,
        generateTransactionReference(),
        cardDetails,
        clientIp,
        voucherCode
      );
    } catch (error) {
      logger.error(`Error processing bill payment: ${error}`);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "Failed to process bill payment", ErrorCodes.PAYMENT_PROCESSING_FAILED);
    }
  }

  /**
   * Creates a new service order in the database.
   * @param userId The ID of the user placing the order.
   * @param addressId The ID of the address where the service will be delivered.
   * @param serviceId The ID of the service being ordered.
   * @param unitQuantity The quantity of the service being ordered.
   * @param paymentMethod The payment method used for the order.
   * @param voucherCode The voucher code applied to the order (if any).
   * @param clientIp The client IP address for fraud detection (optional).
   * @param cardDetails Card details for CARD payment method (required for CARD).
   * @param destinationBankCode Bank code for electricity payments (required for electricity non-wallet payments).
   * @param destinationAccountNumber Account number for electricity payments (required for electricity non-wallet payments).
   * @returns A promise resolving to the created ServiceOrder object, payment result, and suggested services if unavailable.
   * @throws ApiError if the order creation fails or service is unavailable.
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
): Promise<{ serviceOrder: ServiceOrder; paymentResult?: PaymentResult; suggestedServices?: any[]; distanceKm?: number; serviceRadiusKm?: number }> {
  try {
    // Input validation
    if (unitQuantity <= 0) {
      throw new ApiError(400, "Unit quantity must be greater than 0", ErrorCodes.INVALID_INPUT);
    }
    if (!serviceId) {
      throw new ApiError(400, "Service ID is required", ErrorCodes.INVALID_INPUT);
    }
    if (paymentMethod === PaymentMethod.CARD && !cardDetails) {
      throw new ApiError(400, "Card details are required for CARD payment method", ErrorCodes.INVALID_INPUT);
    }

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      logger.error(`User not found: ${userId}`);
      throw new ApiError(404, "User not found", ErrorCodes.USER_NOT_FOUND);
    }

    // Validate address exists
    const address = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });
    if (!address) {
      logger.error(`Address not found: ${addressId}`);
      throw new ApiError(404, "Address not found", ErrorCodes.ADDRESS_NOT_FOUND);
    }

    // Fetch service from Prisma
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { serviceType: true },
    });
    if (!service) {
      logger.error(`Service not found: ${serviceId}`);
      throw new ApiError(404, "Service not found", ErrorCodes.SERVICE_NOT_FOUND);
    }

    if (service.status !== "ACTIVE") {
      logger.error(`Service is not active: ${serviceId}`);
      throw new ApiError(400, "Service is not active", ErrorCodes.SERVICE_INVALID_STATUS);
    }

    // Validate service type dynamically
    const serviceTypes = await prisma.serviceType.findMany({
      select: { name: true },
    });
    const validServiceTypes = serviceTypes.map((st) => st.name.toLowerCase());
    const serviceTypeName = service.serviceType?.name?.toLowerCase() || "";
    if (!validServiceTypes.includes(serviceTypeName)) {
      throw new ApiError(400, `Invalid service type: ${serviceTypeName}. Must be one of ${validServiceTypes.join(", ")}`, ErrorCodes.INVALID_INPUT);
    }

    // Validate electricity payment requirements
    if (serviceTypeName === "electricity" && paymentMethod !== PaymentMethod.WALLET && paymentMethod !== PaymentMethod.PAY_ON_DELIVERY) {
      if (!destinationBankCode || !destinationAccountNumber) {
        throw new ApiError(400, "destinationBankCode and destinationAccountNumber are required for electricity payments", ErrorCodes.INVALID_INPUT);
      }
    }

    // Check service availability
    const availability = await this.checkServiceAvailability(serviceId, addressId);
    if (!availability.isAvailable) {
      throw new ApiError(
        400,
        `Service is not available in your location. Distance: ${availability.distanceKm}km, Service Radius: ${availability.serviceRadiusKm}km`,
        ErrorCodes.SERVICE_UNAVAILABLE
      );
    }

    // Calculate order totals
    const orderTotals = await this.calculateServiceOrderTotal(serviceId, addressId, unitQuantity, voucherCode, userId);

    let voucherId: string | null = null;
    if (voucherCode && orderTotals.discountAmount.toNumber() > 0) {
      const voucher = await prisma.voucher.findUnique({
        where: { code: voucherCode },
      });
      if (voucher) {
        voucherId = voucher.id;
      }
    }

    const serviceOrder = await prisma.$transaction(async (tx) => {
      const customerReference = generateCustomerReference();
      const confirmationCode = await this.generateConfirmationCode(serviceId);

      // Create the order
      const order = await tx.serviceOrder.create({
        data: {
          id: generateUUID(),
          userId,
          deliveryAddressId: addressId,
          serviceId,
          orderQuantity: new Decimal(unitQuantity),
          customerReference,
          serviceFee: orderTotals.serviceFee,
          deliveryFee: new Decimal(orderTotals.deliveryFee.toNumber() + orderTotals.additionalFee),
          vat: orderTotals.vatAmount.toNumber(),
          paymentMethod,
          confirmationCode,
          paymentStatus: TransactionStatus.PENDING,
          status: ServiceOrderStatus.PENDING,
          voucherId,
          amountDue: orderTotals.totalAmount.toNumber(),
          deliveryDistance: availability.distanceKm,
        },
      });

      // Create initial status history entry
      await tx.serviceOrderStatusHistory.create({
        data: {
          id: generateUUID(),
          serviceOrderId: order.id,
          status: ServiceOrderStatus.PENDING,
          updatedBy: userId,
          notes: "Order created",
        },
      });

      return order;
    });

    // Process payment based on payment method
    let paymentResult: PaymentResult | undefined;
    if (paymentMethod === PaymentMethod.WALLET) {
      const petroleumTax = orderTotals.petroleumTax;

      // Process wallet payment using WalletService
      const walletTransaction = await this.walletService.payWithWallet(
        userId,
        orderTotals.serviceSubtotal.toNumber(),
        serviceOrder.id,
        service.serviceType?.name,
        null,
        orderTotals.serviceFee,
        orderTotals.vatRate.toNumber(),
        petroleumTax,
        voucherCode
      );

      // Transform WalletTransaction to PaymentResult
      paymentResult = {
        transactionId: walletTransaction.id,
        status: walletTransaction.status,
        paymentDetails: {
          paymentType: service.serviceType?.name || "wallet",
          baseAmount: orderTotals.serviceSubtotal.toNumber(),
          serviceFee: orderTotals.serviceFee,
          vat: orderTotals.vatAmount.toNumber(),
          totalAmount: orderTotals.totalAmount.toNumber(),
          voucherCode,
          voucherDiscount: orderTotals.discountAmount.toNumber(),
          transactions: [
            {
              type: walletTransaction.transactionType || "DEBIT",
              amount: walletTransaction.amount.toNumber(),
              status: walletTransaction.status,
              reference: walletTransaction.transactionRef || generateTransactionReference(),
            },
          ],
        },
      };

      // Update order status after wallet payment
      if (paymentResult.status === TransactionStatus.COMPLETED) {
        await prisma.$transaction(async (tx) => {
          await tx.serviceOrder.update({
            where: { id: serviceOrder.id },
            data: {
              paymentStatus: TransactionStatus.COMPLETED,
              status: ServiceOrderStatus.PROCESSING,
              updatedAt: new Date(),
            },
          });

          await tx.serviceOrderStatusHistory.create({
            data: {
              id: generateUUID(),
              serviceOrderId: serviceOrder.id,
              status: ServiceOrderStatus.PROCESSING,
              updatedBy: userId,
              notes: `Payment completed via ${paymentMethod}`,
            },
          });

          await this.updateServiceRevenue(serviceOrder, tx);
        });
      }
    } else if (paymentMethod !== PaymentMethod.PAY_ON_DELIVERY) {
      if (serviceTypeName === "electricity") {
        const meterNumber = serviceOrder.customerReference || generateCustomerReference();
        paymentResult = await this.processBillPayment(
          userId,
          orderTotals,
          service.serviceType?.name,
          serviceId,
          paymentMethod,
          meterNumber,
          destinationBankCode!,
          destinationAccountNumber!,
          clientIp,
          cardDetails,
          voucherCode
        );
      } else {
        paymentResult = await this.processPayment(
          userId,
          orderTotals,
          service.serviceType?.name,
          serviceId,
          paymentMethod,
          clientIp,
          cardDetails,
          voucherCode
        );
      }

      // Update order status after payment
      if (paymentResult && paymentResult.status === TransactionStatus.COMPLETED) {
        await prisma.$transaction(async (tx) => {
          const updateData: any = {
            paymentStatus: TransactionStatus.COMPLETED,
            status: ServiceOrderStatus.PROCESSING,
            updatedAt: new Date(),
          };

          if (paymentResult && serviceTypeName === "electricity" && paymentResult.electricityToken) {
            updateData.electricityToken = paymentResult.electricityToken;
          }

          await tx.serviceOrder.update({
            where: { id: serviceOrder.id },
            data: updateData,
          });

          await tx.serviceOrderStatusHistory.create({
            data: {
              id: generateUUID(),
              serviceOrderId: serviceOrder.id,
              status: ServiceOrderStatus.PROCESSING,
              updatedBy: userId,
              notes: `Payment completed via ${paymentMethod}${serviceTypeName === "electricity" ? " with electricity token" : ""}`,
            },
          });

          await this.updateServiceRevenue(serviceOrder, tx);
        });
      }
    }

    return {
      serviceOrder,
      paymentResult,
      suggestedServices: availability.suggestedServices,
      distanceKm: availability.distanceKm,
      serviceRadiusKm: availability.serviceRadiusKm,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Error creating service order: ${error}`);
    throw new ApiError(500, "Failed to create service order", ErrorCodes.ORDER_CREATION_FAILED);
  }
}


/**
   * Calculate service order totals without creating an order.
   * @param serviceId The ID of the service
   * @param addressId The ID of the delivery address
   * @param unitQuantity The quantity of units
   * @param voucherCode Optional voucher code for discounts
   * @param userId User ID for voucher validation
   * @returns Object with all price details, including petroleum tax for applicable services
   */
  async calculateServiceOrderTotal(
    serviceId: string,
    addressId: string,
    unitQuantity: number = 1,
    voucherCode?: string,
    userId?: string
  ): Promise<{
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
  }> {
    try {
      // Input validation
      if (unitQuantity <= 0) {
        throw new ApiError(400, "Unit quantity must be greater than 0", ErrorCodes.INVALID_INPUT);
      }
      if (!serviceId) {
        throw new ApiError(400, "Service ID is required", ErrorCodes.INVALID_INPUT);
      }
      if (!addressId) {
        throw new ApiError(400, "Address ID is required", ErrorCodes.INVALID_INPUT);
      }

      // Fetch service from Prisma with serviceType included
      const service = await prisma.service.findUnique({
        where: { id: serviceId as string },
        select: {
          pricePerUnit: true,
          deliveryCost: true,
          status: true,
          latitude: true,
          longitude: true,
          serviceRadius: true,
          serviceType: { select: { name: true } },
        },
      });
      if (!service || service.latitude === null || service.longitude === null || service.serviceRadius === null) {
        throw new ApiError(404, "Service not found or missing location data", ErrorCodes.SERVICE_NOT_FOUND);
      }

      if (service.status !== "ACTIVE") {
        throw new ApiError(400, "Service is not active", ErrorCodes.SERVICE_INVALID_STATUS);
      }

      // Fetch address for distance calculation
      const address = await prisma.customerAddress.findUnique({
        where: { id: addressId },
        select: { latitude: true, longitude: true },
      });
      if (!address || address.latitude === null || address.longitude === null) {
        throw new ApiError(404, "Delivery address location not found", ErrorCodes.ADDRESS_LOCATION_NOT_FOUND);
      }

      // Calculate distance
      const { straightLineDistanceKm, roadDistanceKm } = await this.calculateDistance(
        service.latitude,
        service.longitude,
        address.latitude,
        address.longitude
      );
      const distanceKm = roadDistanceKm ?? straightLineDistanceKm; // Prefer road distance if available

      // Calculate additional fee using deliveryCost as per-kilometer cost
      let additionalFee = 0;
      if (distanceKm > service.serviceRadius) {
        const deliveryCostPerKm = service.deliveryCost ? service.deliveryCost.toNumber() : 0;
        additionalFee = (distanceKm - service.serviceRadius) * deliveryCostPerKm;
      }

      // Get configuration values
      const serviceFee = await this.getServiceCharge();
      const vatRate = await this.getVatRate();

      // Calculate service price
      const servicePricePerUnit = service.pricePerUnit.toNumber();
      const serviceSubtotal = new Decimal(servicePricePerUnit).mul(unitQuantity);
      const deliveryFee = new Decimal(service.deliveryCost?.toNumber() || 0);

      // Fetch all service types dynamically
      const serviceTypes = await prisma.serviceType.findMany({
        select: { name: true },
      });
      const validServiceTypes = serviceTypes.map((st) => st.name.toLowerCase());

      // Validate service type
      const serviceTypeName = service.serviceType?.name?.toLowerCase() || "";
      if (!validServiceTypes.includes(serviceTypeName)) {
        throw new ApiError(400, `Invalid service type: ${serviceTypeName}. Must be one of ${validServiceTypes.join(", ")}`, ErrorCodes.INVALID_INPUT);
      }

      // Calculate petroleum tax for petroleum-related services only (petrol, diesel)
      const petroleumServiceTypes = ["petrol", "diesel"];
      const isPetroleumService = petroleumServiceTypes.includes(serviceTypeName);
      const petroleumTaxRate = isPetroleumService ? await this.getPetroleumTaxRate() : 0;
      const petroleumTax = isPetroleumService ? serviceSubtotal.mul(petroleumTaxRate).toNumber() : 0;

      // Calculate discount if voucher provided
      let discountAmount = new Decimal(0);
      if (voucherCode && userId) {
        const voucher = await this.validateVoucher(voucherCode, userId);
        if (voucher) {
          const discountValue = this.calculateDiscount(voucher, serviceSubtotal.toNumber());
          discountAmount = new Decimal(discountValue);
        }
      }

      // Calculate subtotal: service fee + service cost + delivery fee + additional fee + petroleum tax - discount
      const subtotalDecimal = new Decimal(serviceFee)
        .add(serviceSubtotal)
        .add(deliveryFee)
        .add(additionalFee)
        .add(petroleumTax)
        .sub(discountAmount);

      // Calculate VAT
      const vatAmountDecimal = subtotalDecimal.mul(vatRate);
      const totalAmountDecimal = subtotalDecimal.add(vatAmountDecimal);

      return {
        servicePricePerUnit,
        serviceSubtotal,
        serviceFee,
        deliveryFee,
        additionalFee,
        discountAmount,
        subtotal: subtotalDecimal,
        vatAmount: vatAmountDecimal,
        petroleumTax,
        totalAmount: totalAmountDecimal,
        vatRate: new Decimal(vatRate),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error calculating service order total: ${error}`);
      throw new ApiError(500, "Failed to calculate order total", ErrorCodes.CALCULATION_FAILED);
    }
  }


  /**
   * Updates service revenue analytics after a successful order
   * @param serviceOrder The newly created service order
   * @param tx The Prisma transaction to use (optional)
   */
  private async updateServiceRevenue(serviceOrder: ServiceOrder, tx?: any): Promise<void> {
    try {
      const prismaClient = tx || prisma;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const totalRevenue = serviceOrder.amountDue.toNumber();

      const existingRevenue = await prismaClient.serviceRevenue.findUnique({
        where: {
          serviceId_date: {
            serviceId: serviceOrder.serviceId!,
            date: today,
          },
        },
      });

      if (existingRevenue) {
        await prismaClient.serviceRevenue.update({
          where: { id: existingRevenue.id },
          data: {
            totalOrders: { increment: 1 },
            totalRevenue: { increment: totalRevenue },
            deliveryFees: { increment: serviceOrder.deliveryFee?.toNumber() || 0 },
            updatedAt: new Date(),
          },
        });
      } else {
        await prismaClient.serviceRevenue.create({
          data: {
            id: generateUUID(),
            serviceId: serviceOrder.serviceId!,
            date: today,
            totalOrders: 1,
            totalRevenue,
            deliveryFees: serviceOrder.deliveryFee?.toNumber() || 0,
            updatedAt: new Date(),
          },
        });
      }

      logger.info(`Updated service revenue for service ${serviceOrder.serviceId}`);
    } catch (error) {
      logger.error(`Failed to update service revenue: ${error}`);
    }
  }

  /**
   * Validates a voucher code for a specific user
   * @param voucherCode The voucher code to validate
   * @param userId The user ID for which to validate the voucher
   * @returns The validated voucher object or null if invalid
   */
  private async validateVoucher(voucherCode: string, userId: string): Promise<Voucher | null> {
    try {
      const voucher = await prisma.voucher.findUnique({
        where: { code: voucherCode },
        include: { restrictedToRoles: true },
      });

      if (!voucher || !voucher.isActive) {
        logger.info(`Invalid or inactive voucher code: ${voucherCode}`);
        return null;
      }

      if (voucher.validUntil < new Date()) {
        logger.info(`Expired voucher: ${voucherCode}`);
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user || !user.roleId) {
        logger.info(`User or role not found for voucher validation: ${userId}`);
        return null;
      }

      if (voucher.restrictedToRoles.length > 0) {
        const isRestricted = voucher.restrictedToRoles.some((role) => role.id === user.roleId);
        if (!isRestricted) {
          logger.info(`Voucher restricted to specific roles, user role not allowed: ${userId}`);
          return null;
        }
      }

      if (voucher.maxUses !== null && voucher.maxUses !== undefined) {
        const usageCount = await prisma.voucherUsage.count({
          where: { voucherId: voucher.id },
        });
        if (usageCount >= voucher.maxUses) {
          logger.info(`Voucher max uses exceeded: ${voucherCode}`);
          return null;
        }
      }

      if (voucher.maxUsesPerUser !== null && voucher.maxUsesPerUser !== undefined) {
        const userUsageCount = await prisma.voucherUsage.count({
          where: { voucherId: voucher.id, userId },
        });
        if (userUsageCount >= voucher.maxUsesPerUser) {
          logger.info(`Voucher max uses per user exceeded: ${voucherCode}`);
          return null;
        }
      }

      return {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        discount: voucher.discount.toNumber(),
        maxUses: voucher.maxUses,
        maxUsesPerUser: voucher.maxUsesPerUser,
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        isActive: voucher.isActive,
      };
    } catch (error) {
      logger.error(`Error validating voucher: ${error}`);
      return null;
    }
  }

  /**
   * Update service order status
   */
  async updateServiceOrderStatus(
    serviceOrderId: string,
    newStatus: ServiceOrderStatus,
    updatedBy: string,
    notes?: string
  ): Promise<ServiceOrder> {
    return await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      await tx.serviceOrderStatusHistory.create({
        data: {
          id: generateUUID(),
          serviceOrderId,
          status: newStatus,
          updatedBy,
          notes: notes || `Status updated to ${newStatus}`,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Handle service order approval by provider
   */
  async approveServiceOrder(serviceOrderId: string, providerId: string): Promise<ServiceOrder> {
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { service: true },
    });

    if (!serviceOrder) {
      throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
    }

    if (!serviceOrder.service || serviceOrder.service.providerId !== providerId) {
      throw new ApiError(403, "You are not authorized to approve this order", ErrorCodes.UNAUTHORIZED);
    }

    return this.updateServiceOrderStatus(
      serviceOrderId,
      ServiceOrderStatus.PROCESSING,
      providerId,
      "Order approved by service provider"
    );
  }

  /**
   * Handle service order rejection by provider
   */
  async rejectServiceOrder(serviceOrderId: string, providerId: string, reason: string): Promise<ServiceOrder> {
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { service: true },
    });

    if (!serviceOrder) {
      throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
    }

    if (!serviceOrder.service || serviceOrder.service.providerId !== providerId) {
      throw new ApiError(403, "You are not authorized to reject this order", ErrorCodes.UNAUTHORIZED);
    }

    return this.updateServiceOrderStatus(
      serviceOrderId,
      ServiceOrderStatus.REJECTED,
      providerId,
      `Order rejected by service provider. Reason: ${reason}`
    );
  }

  /**
   * Mark order as out for delivery
   */
  async markOrderAsOutForDelivery(serviceOrderId: string, providerId: string): Promise<ServiceOrder> {
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { service: true },
    });

    if (!serviceOrder) {
      throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
    }

    if (!serviceOrder.service || serviceOrder.service.providerId !== providerId) {
      throw new ApiError(403, "You are not authorized to update this order", ErrorCodes.UNAUTHORIZED);
    }

    return this.updateServiceOrderStatus(
      serviceOrderId,
      ServiceOrderStatus.OUT_FOR_DELIVERY,
      providerId,
      "Order is out for delivery"
    );
  }

  /**
   * Complete service order delivery
   */
  async completeServiceOrderDelivery(
    serviceOrderId: string,
    providerId: string,
    confirmationCode: string,
    disputeReason?: string
  ): Promise<ServiceOrder> {
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: { service: true },
    });

    if (!serviceOrder) {
      throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
    }

    if (!serviceOrder.service || serviceOrder.service.providerId !== providerId) {
      throw new ApiError(403, "You are not authorized to complete this order", ErrorCodes.UNAUTHORIZED);
    }

    if (!(await this.validateConfirmationCode(serviceOrderId, confirmationCode))) {
      throw new ApiError(400, "Invalid confirmation code", ErrorCodes.INVALID_CONFIRMATION_CODE);
    }

    return await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          status: ServiceOrderStatus.DELIVERED,
          updatedAt: new Date(),
        },
      });

      await tx.serviceOrderStatusHistory.create({
        data: {
          id: generateUUID(),
          serviceOrderId,
          status: ServiceOrderStatus.DELIVERED,
          updatedBy: providerId,
          notes: disputeReason ? "Completed with dispute" : "Delivered successfully",
        },
      });

      // Create dispute if disputeReason is provided
      if (disputeReason) {
        await tx.dispute.create({
          data: {
            id: generateUUID(),
            serviceOrderId,
            serviceId: serviceOrder.serviceId!,
            reason: disputeReason,
            status: "PENDING",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      if (serviceOrder.paymentMethod === PaymentMethod.PAY_ON_DELIVERY && !disputeReason) {
        await tx.serviceOrder.update({
          where: { id: serviceOrderId },
          data: {
            paymentStatus: TransactionStatus.COMPLETED,
          },
        });

        await tx.payOnDeliveryOrder.updateMany({
          where: { serviceOrderId },
          data: {
            status: TransactionStatus.COMPLETED,
          },
        });
      }

      if (!disputeReason) {
        await this.updateServiceRevenue(updatedOrder, tx);
      }

      return updatedOrder;
    });
  }

  /**
   * Validate delivery confirmation code
   */
  private async validateConfirmationCode(serviceOrderId: string, confirmationCode: string): Promise<boolean> {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { confirmationCode: true },
    });
    return order !== null && order.confirmationCode === confirmationCode;
  }

  /**
   * Get service orders by status for provider
   */
  async getProviderServiceOrders(providerId: string, status?: ServiceOrderStatus): Promise<ServiceOrder[]> {
    try {
      const services = await prisma.service.findMany({
        where: { providerId },
        select: { id: true },
      });

      const serviceIds = services.map((service) => service.id).filter((id): id is string => id !== null);

      if (serviceIds.length === 0) {
        return [];
      }

      const orders = await prisma.serviceOrder.findMany({
        where: {
          serviceId: { in: serviceIds },
          ...(status ? { status } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return orders;
    } catch (error) {
      logger.error(`Error getting provider service orders: ${error}`);
      throw new ApiError(500, "Failed to get provider service orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Get pending orders for a provider
   */
  async getProviderPendingOrders(providerId: string): Promise<ServiceOrder[]> {
    return this.getProviderServiceOrders(providerId, ServiceOrderStatus.PENDING);
  }

  /**
   * Get completed orders for a provider
   */
  async getProviderCompletedOrders(providerId: string): Promise<ServiceOrder[]> {
    return this.getProviderServiceOrders(providerId, ServiceOrderStatus.DELIVERED);
  }

  /**
   * Get cancelled orders for a provider
   */
  async getProviderCancelledOrders(providerId: string): Promise<ServiceOrder[]> {
    return this.getProviderServiceOrders(providerId, ServiceOrderStatus.CANCELLED);
  }

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string, status?: ServiceOrderStatus, providerId?: string): Promise<ServiceOrder[]> {
    try {
      const orders = await prisma.serviceOrder.findMany({
        where: {
          userId,
          ...(status ? { status } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (providerId) {
        for (const order of orders) {
          const service = await prisma.service.findUnique({
            where: { id: order.serviceId! },
          });
          if (!service || service.providerId !== providerId) {
            logger.error("Provider not authorized to access these orders");
            throw new ApiError(403, "Provider not authorized to access these orders", ErrorCodes.FORBIDDEN);
          }
        }
      }

      return orders;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error getting user orders: ${error}`);
      throw new ApiError(500, "Failed to get user orders", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Get detailed order information with customer data
   */
  async getServiceOrderWithDetails(serviceOrderId: string): Promise<any> {
    try {
      const serviceOrder = await prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: {
          user: true,
          deliveryAddress: true,
          service: true,
          statusHistory: true,
        },
      });

      if (!serviceOrder) {
        throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
      }

      return {
        ...serviceOrder,
        customer: serviceOrder.user,
        deliveryAddress: serviceOrder.deliveryAddress,
        service: serviceOrder.service,
        statusHistory: serviceOrder.statusHistory,
        estimatedInfo: {
          distance: serviceOrder.deliveryDistance,
          estimatedDeliveryTimeMinutes: null, // ETA handled elsewhere
          formattedETA: null, // ETA handled elsewhere
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error getting service order details: ${error}`);
      throw new ApiError(500, "Failed to get order details", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Add rating and feedback for a completed service order
   */
  async addServiceOrderRating(
    serviceOrderId: string,
    userId: string,
    rating: number,
    comment?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be between 1 and 5", ErrorCodes.INVALID_INPUT);
      }

      const serviceOrder = await prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        include: { service: true },
      });

      if (!serviceOrder) {
        throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
      }

      if (serviceOrder.userId !== userId) {
        throw new ApiError(403, "You are not authorized to rate this order", ErrorCodes.UNAUTHORIZED);
      }

      if (serviceOrder.status !== ServiceOrderStatus.DELIVERED) {
        throw new ApiError(400, "Can only rate completed orders", ErrorCodes.INVALID_ORDER_STATUS);
      }

      await prisma.$transaction(async (tx) => {
        await tx.orderReview.create({
          data: {
            id: generateUUID(),
            serviceOrderId,
            serviceId: serviceOrder.serviceId!,
            userId,
            rating,
            comment: comment || "",
            createdAt: new Date(),
          },
        });

        const reviews = await tx.orderReview.findMany({
          where: { serviceId: serviceOrder.serviceId! },
        });

        const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

        await tx.service.update({
          where: { id: serviceOrder.serviceId! },
          data: {
            avgRating,
            ratingCount: reviews.length,
          },
        });
      });

      return {
        success: true,
        message: "Rating submitted successfully",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error adding service order rating: ${error}`);
      throw new ApiError(500, "Failed to add rating", ErrorCodes.INTERNAL_ERROR);
    }
  }


  /**
   * Cancel a service order
   */
  async cancelServiceOrder(serviceOrderId: string, userId: string, reason: string): Promise<ServiceOrder> {
    try {
      const serviceOrder = await prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
      });

      if (!serviceOrder) {
        throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
      }

      if (serviceOrder.userId !== userId) {
        throw new ApiError(403, "You are not authorized to cancel this order", ErrorCodes.UNAUTHORIZED);
      }

      const cancellableStatuses: ServiceOrderStatus[] = [ServiceOrderStatus.PENDING, ServiceOrderStatus.PROCESSING];

      if (!cancellableStatuses.includes(serviceOrder.status)) {
        throw new ApiError(400, "Order cannot be cancelled in its current state", ErrorCodes.INVALID_ORDER_STATUS);
      }

      return await prisma.$transaction(async (tx) => {
        if (serviceOrder.paymentStatus === TransactionStatus.COMPLETED) {
          if (serviceOrder.paymentMethod === PaymentMethod.WALLET) {
            // Refund wallet payment
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
              throw new ApiError(404, "User wallet not found", ErrorCodes.WALLET_NOT_FOUND);
            }

            await tx.wallet.update({
              where: { userId },
              data: {
                balance: { increment: serviceOrder.amountDue },
                updatedAt: new Date(),
              },
            });

            await tx.walletTransaction.create({
              data: {
                id: generateUUID(),
                userId,
                walletId: wallet.id,
                transactionType: "REFUND",
                amount: serviceOrder.amountDue,
                serviceOrderId,
                status: TransactionStatus.COMPLETED,
                transactionRef: generateTransactionReference(),
              },
            });
          } else if (serviceOrder.paymentMethod !== PaymentMethod.PAY_ON_DELIVERY) {
            // Refund direct payment (CARD, TRANSFER, VIRTUAL_ACCOUNT)
            await this.paymentService.processRefund(
              serviceOrder.customerReference || generateTransactionReference(),
              userId,
              serviceOrder.amountDue.toNumber()
            );
          }
        }

        const updatedOrder = await tx.serviceOrder.update({
          where: { id: serviceOrderId },
          data: {
            status: ServiceOrderStatus.CANCELLED,
            updatedAt: new Date(),
          },
        });

        await tx.serviceOrderStatusHistory.create({
          data: {
            id: generateUUID(),
            serviceOrderId,
            status: ServiceOrderStatus.CANCELLED,
            updatedBy: userId,
            notes: `Order cancelled by customer. Reason: ${reason}`,
          },
        });

        return updatedOrder;
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error cancelling service order: ${error}`);
      throw new ApiError(500, "Failed to cancel order", ErrorCodes.ORDER_CANCELLATION_FAILED);
    }
  }

  /**
   * Generate confirmation code for order delivery
   */
  private async generateConfirmationCode(_serviceOrderId: string): Promise<string> {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Validate delivery confirmation code
   */
  async validateDeliveryConfirmationCode(serviceOrderId: string, providedCode: string): Promise<boolean> {
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { confirmationCode: true },
    });

    if (!serviceOrder || !serviceOrder.confirmationCode) {
      return false;
    }

    return serviceOrder.confirmationCode === providedCode;
  }

  /**
   * Update order pickup location with PostGIS
   */
  async updateOrderPickupLocation(serviceOrderId: string, latitude: number, longitude: number): Promise<ServiceOrder> {
    try {
      if (latitude < -90 || latitude > 90) {
        throw new ApiError(400, "Invalid latitude value", ErrorCodes.INVALID_INPUT);
      }
      if (longitude < -180 || longitude > 180) {
        throw new ApiError(400, "Invalid longitude value", ErrorCodes.INVALID_INPUT);
      }

      const serviceOrder = await prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
      });

      if (!serviceOrder) {
        throw new ApiError(404, "Service order not found", ErrorCodes.ORDER_NOT_FOUND);
      }

      const updatedOrder = await prisma.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          latitude,
          longitude,
          updatedAt: new Date(),
        },
      });

      return updatedOrder;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`Error updating order pickup location: ${error}`);
      throw new ApiError(500, "Failed to update pickup location", ErrorCodes.INTERNAL_ERROR);
    }
  }

  /**
   * Get dashboard statistics for a provider
   */
/**
 * Get dashboard statistics for a provider
 */
async getProviderDashboardStats(providerId: string): Promise<any> {
  try {
    const services = await prisma.service.findMany({
      where: { providerId },
      select: { id: true },
    });

    const serviceIds = services.map((service) => service.id).filter((id): id is string => id !== null);

    if (serviceIds.length === 0) {
      return {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        revenueToday: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      revenueToday,
    ] = await Promise.all([
      prisma.serviceOrder.count({
        where: { serviceId: { in: serviceIds } },
      }),
      prisma.serviceOrder.count({
        where: {
          serviceId: { in: serviceIds },
          status: ServiceOrderStatus.PENDING,
        },
      }),
      prisma.serviceOrder.count({
        where: {
          serviceId: { in: serviceIds },
          status: {
            in: [ServiceOrderStatus.PROCESSING, ServiceOrderStatus.AGENT_ASSIGNED, ServiceOrderStatus.OUT_FOR_DELIVERY],
          },
        },
      }),
      prisma.serviceOrder.count({
        where: {
          serviceId: { in: serviceIds },
          status: ServiceOrderStatus.DELIVERED,
        },
      }),
      prisma.serviceOrder.count({
        where: {
          serviceId: { in: serviceIds },
          status: {
            in: [ServiceOrderStatus.CANCELLED, ServiceOrderStatus.REJECTED],
          },
        },
      }),
      prisma.serviceOrder.aggregate({
        where: {
          serviceId: { in: serviceIds },
          status: ServiceOrderStatus.DELIVERED,
          paymentStatus: TransactionStatus.COMPLETED,
        },
        _sum: {
          amountDue: true,
          vat: true,
        },
      }),
      prisma.serviceOrder.aggregate({
        where: {
          serviceId: { in: serviceIds },
          status: ServiceOrderStatus.DELIVERED,
          paymentStatus: TransactionStatus.COMPLETED,
          createdAt: {
            gte: today,
          },
        },
        _sum: {
          amountDue: true,
          vat: true,
        },
      }),
    ]);

    const totalRevenueAmount = 
      (totalRevenue._sum.amountDue ? Number(totalRevenue._sum.amountDue) : 0) +
      (totalRevenue._sum.vat ? Number(totalRevenue._sum.vat) : 0);

    const revenueTodayAmount =
      (revenueToday._sum.amountDue ? Number(revenueToday._sum.amountDue) : 0) +
      (revenueToday._sum.vat ? Number(revenueToday._sum.vat) : 0);

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue: totalRevenueAmount,
      revenueToday: revenueTodayAmount,
    };
  } catch (error) {
    logger.error(`Error getting provider dashboard stats: ${error}`);
    throw new ApiError(500, "Failed to get dashboard statistics", ErrorCodes.INTERNAL_ERROR);
  }
}

  /**
   * Calculates the discount amount based on a voucher
   * @param voucher The validated voucher object
   * @param subtotal The subtotal to apply percentage discounts to
   * @returns The calculated discount amount
   */
  calculateDiscount(voucher: Voucher, subtotal: number = 0): number {
    if (!voucher) return 0;

    switch (voucher.type) {
      case VoucherType.FIXED:
        return Math.max(0, voucher.discount);
      case VoucherType.PERCENTAGE:
        if (subtotal <= 0) {
          logger.warn("Cannot calculate percentage discount with zero or negative subtotal");
          return 0;
        }
        const percentage = Math.min(Math.max(0, voucher.discount), 100);
        return (percentage / 100) * subtotal;
      default:
        logger.warn(`Unknown voucher type: ${voucher.type}`);
        return 0;
    }
  }
}