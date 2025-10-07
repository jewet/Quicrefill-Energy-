import { Request } from "express";
import { PaymentMethod, TransactionStatus, TransactionType } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import MonnifyPaymentInitiation from "../modules/PaymentModule/MonnifyPaymentInitiation";
import PaymentVerification from "../modules/PaymentModule/paymentVerification";
import PaymentManagement from "../modules/PaymentModule/paymentManagement";
import { PrismaClient, Prisma } from "@prisma/client";
import winston from "winston";
import GatewayFactory from "../modules/PaymentModule/GatewayFactory";

// Interface for payment details (aligned with Prisma schema and JSON-serializable)
interface PaymentDetails {
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
  secure3dData?: {
    id: string;
    redirectUrl: string;
  };
  virtualAccount?: {
    accountNumber: string;
    bankName: string;
    accountReference: string;
    expiryDate?: string;
    note?: string;
    amount?: string;
  };
  bankTransfer?: {
    accountReference: string;
    accountNumber: string;
    bankName: string;
    accountExpiration: string;
    narration: string;
    transferAmount: string;
  };
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
  transactions?: {
    type: string;
    amount: number;
    status: TransactionStatus;
    reference: string;
  }[];
  electricityToken?: string;
}

interface VendorDetails {
  vendorId: string;
  itemAccount: { accountNumber: string; bankName: string };
  deliveryAccount: { accountNumber: string; bankName: string };
}

interface AdminDetails {
  merchantAccount: { accountNumber: string; bankName: string };
}

class PaymentService {
  private paymentVerification: PaymentVerification;
  private paymentManagement: PaymentManagement;
  private prisma: PrismaClient;
  private logger: winston.Logger;
  private gatewayFactory: GatewayFactory;
  private monnify: MonnifyPaymentInitiation;

  constructor() {
    this.paymentVerification = new PaymentVerification();
    this.paymentManagement = new PaymentManagement();
    this.prisma = new PrismaClient();
    this.gatewayFactory = new GatewayFactory();
    this.monnify = new MonnifyPaymentInitiation();
    this.logger = winston.createLogger({
      level: "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ["message", "level", "timestamp"] })
      ),
      transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console(),
      ],
    });
  }

  // Check available payment methods and select fallback if none are enabled
  private async selectPaymentMethod(preferredMethod: PaymentMethod): Promise<PaymentMethod> {
    const config = await this.prisma.paymentConfig.findUnique({
      where: { paymentMethod: preferredMethod },
    });

    if (config && config.isEnabled) {
      return preferredMethod;
    }

    // Fallback to prioritized payment methods
    const fallbackMethods: PaymentMethod[] = [
      PaymentMethod.PAY_ON_DELIVERY,
      PaymentMethod.TRANSFER,
      PaymentMethod.VIRTUAL_ACCOUNT,
      PaymentMethod.CARD,
      PaymentMethod.MONNIFY,
    ];

    for (const method of fallbackMethods) {
      const fallbackConfig = await this.prisma.paymentConfig.findUnique({
        where: { paymentMethod: method },
      });
      if (fallbackConfig && fallbackConfig.isEnabled) {
        this.logger.info(`Falling back to payment method: ${method}`);
        return method;
      }
    }

    throw new Error("No payment methods are currently available");
  }

  // Fetch vendor or admin details based on item
  private async getRecipientDetails(
    productType?: string,
    serviceType?: string,
    itemId?: string
  ): Promise<{ isVendor: boolean; details: VendorDetails | AdminDetails }> {
    if (!itemId && (productType || serviceType)) {
      // Admin-listed product/service
      try {
        const adminAccount = await this.monnify.getMerchantAccount();
        if (!adminAccount?.accountNumber || !adminAccount?.bankName) {
          throw new Error("Failed to retrieve admin merchant account details from Monnify");
        }
        return {
          isVendor: false,
          details: {
            merchantAccount: {
              accountNumber: adminAccount.accountNumber,
              bankName: adminAccount.bankName,
            },
          },
        };
      } catch (error: any) {
        this.logger.error("Error fetching admin account from Monnify", { error: error.message });
        throw new Error("Admin merchant account retrieval failed");
      }
    }

    if (!itemId) {
      throw new Error("Item ID required for vendor lookup");
    }

    // Fetch item (Product or Service) and its associated vendor
    let vendorWallet: { id: string; vendorLinkedAccount1: string | null; vendorBankName: string | null; vendorLinkedAccount2: string | null } | null = null;

    if (productType) {
      const product = await this.prisma.product.findUnique({
        where: { id: itemId },
        include: { productOwner: { include: { wallet: true } } },
      });
      if (!product || !product.productOwner?.wallet) {
        throw new Error("Product or vendor wallet not found");
      }
      vendorWallet = product.productOwner.wallet;
    } else if (serviceType) {
      const service = await this.prisma.service.findUnique({
        where: { id: itemId },
        include: { provider: { include: { wallet: true } } },
      });
      if (!service || !service.provider?.wallet) {
        throw new Error("Service or vendor wallet not found");
      }
      vendorWallet = service.provider.wallet;
    }

    if (!vendorWallet || !vendorWallet.vendorLinkedAccount1 || !vendorWallet.vendorBankName || !vendorWallet.vendorLinkedAccount2) {
      throw new Error("Vendor account details incomplete in Wallet");
    }

    // Fetch vendor account details from Monnify using account references
    try {
      const itemAccount = await this.monnify.getReservedAccountDetails(vendorWallet.vendorLinkedAccount1);
      const deliveryAccount = await this.monnify.getReservedAccountDetails(vendorWallet.vendorLinkedAccount2);
      if (!itemAccount?.accountNumber || !itemAccount?.bankName || !deliveryAccount?.accountNumber || !deliveryAccount?.bankName) {
        throw new Error("Failed to retrieve vendor account details from Monnify");
      }
      return {
        isVendor: true,
        details: {
          vendorId: vendorWallet.id,
          itemAccount: {
            accountNumber: itemAccount.accountNumber,
            bankName: itemAccount.bankName,
          },
          deliveryAccount: {
            accountNumber: deliveryAccount.accountNumber,
            bankName: deliveryAccount.bankName,
          },
        },
      };
    } catch (error: any) {
      this.logger.error("Error fetching vendor accounts from Monnify", {
        error: error.message,
        vendorLinkedAccount1: vendorWallet.vendorLinkedAccount1,
        vendorLinkedAccount2: vendorWallet.vendorLinkedAccount2,
      });
      throw new Error("Vendor account retrieval failed");
    }
  }

  // Process payment with vendor/admin routing and voucher support
  async processPayment(
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
    isWalletTopUp: boolean = false,
    meterNumber?: string,
    voucherCode?: string
  ): Promise<{ transactionId: string; paymentDetails?: PaymentDetails; redirectUrl?: string; status: string }> {
    const ref = transactionRef || `TRX-${uuidv4()}-${Date.now()}`;
    let voucherDiscount = 0;

    try {
      this.logger.info(`Processing ${isWalletTopUp ? "wallet top-up" : productType || serviceType || "payment"}`, {
        userId,
        amount,
        paymentMethod,
        clientIp: clientIp || "not provided",
        isWalletTopUp,
        productType: productType || "none",
        serviceType: serviceType || "none",
        meterNumber: meterNumber || "none",
        voucherCode: voucherCode || "none",
        itemId: itemId || "none",
      });

      // Validate inputs
      if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
        throw new Error("Invalid user ID: must be a UUID");
      }
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid amount: must be a positive number");
      }
      if (paymentMethod === PaymentMethod.WALLET) {
        throw new Error("WALLET payment method is not supported");
      }

      // Check payment method availability
      const selectedMethod = await this.selectPaymentMethod(paymentMethod);
      if (!selectedMethod) {
        throw new Error(`Payment method ${paymentMethod} is currently disabled`);
      }

      // Validate productType and serviceType
      if (productType && serviceType) {
        throw new Error("Cannot specify both productType and serviceType");
      }
      const validProductTypes = ["product", "wallet_topup"];
      if (productType && !validProductTypes.includes(productType)) {
        throw new Error(`Invalid productType: ${productType}. Must be one of ${validProductTypes.join(", ")}`);
      }
      const validServiceTypes = ["gas", "petrol", "diesel", "electricity"];
      if (serviceType && !validServiceTypes.includes(serviceType)) {
        throw new Error(`Invalid serviceType: ${serviceType}. Must be one of ${validServiceTypes.join(", ")}`);
      }
      if (isWalletTopUp && productType && productType !== "wallet_topup") {
        throw new Error("Wallet top-up cannot have a product type other than wallet_topup");
      }
      if (serviceType === "electricity") {
        throw new Error("Electricity payments must be processed using processBillPayment method");
      }

      // Determine voucher context
      let voucherContext: "PRODUCT" | "SERVICE" | null = null;
      if (productType === "product") {
        voucherContext = "PRODUCT";
      } else if (serviceType) {
        voucherContext = "SERVICE";
      } else if (productType === "wallet_topup") {
        throw new Error("Vouchers cannot be applied to wallet top-up transactions");
      }

      // Validate and apply voucher if provided
      let voucher: any = null;
      if (voucherCode && voucherContext) {
        const { discount, valid, voucher: validatedVoucher } = await this.monnify.validateVoucher(
          userId,
          voucherCode,
          voucherContext,
          amount
        );
        if (!valid || !validatedVoucher) {
          throw new Error("Invalid or inapplicable voucher");
        }
        voucherDiscount = discount;
        voucher = validatedVoucher;
      }

      // Adjust base amount after voucher discount
      const adjustedAmount = Math.max(0, amount - voucherDiscount);

      // Fetch recipient (admin or vendor) details
      const recipient = await this.getRecipientDetails(productType, serviceType, itemId);

      // Calculate fees
      const adminSettings = await this.prisma.adminSettings.findFirst();
      const serviceFee = isWalletTopUp ? 0 : (adminSettings?.defaultServiceCharge ?? 0);
      const topupCharge = isWalletTopUp ? (adminSettings?.defaultTopupCharge ?? 0) : 0;
      const vatRate = adminSettings?.defaultVatRate ?? 0;
      const vat = adjustedAmount * vatRate;
      const totalAmount = adjustedAmount + (isWalletTopUp ? topupCharge : serviceFee) + vat;

      // Determine transaction type
      const transactionType = isWalletTopUp ? TransactionType.DEPOSIT : TransactionType.DEDUCTION;

      // Create payment record and related transactions in a Prisma transaction
      const payment = await this.prisma.$transaction(async (tx) => {
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            id: uuidv4(),
            userId,
            amount: totalAmount,
            paymentMethod: selectedMethod,
            status: TransactionStatus.PENDING,
            transactionRef: ref,
            productType,
            serviceType,
            meterNumber,
            paymentDetails: {
              paymentType: productType || serviceType || "wallet_topup",
              baseAmount: amount,
              serviceFee: isWalletTopUp ? undefined : serviceFee,
              topupCharge: isWalletTopUp ? topupCharge : undefined,
              vat,
              totalAmount,
              recipient: recipient.isVendor ? "vendor" : "admin",
              recipientDetails: recipient.isVendor
                ? {
                    vendorId: (recipient.details as VendorDetails).vendorId,
                    itemAccount: (recipient.details as VendorDetails).itemAccount,
                    deliveryAccount: (recipient.details as VendorDetails).deliveryAccount,
                  }
                : {
                    merchantAccount: (recipient.details as AdminDetails).merchantAccount,
                  },
              voucherCode: voucherCode || undefined,
              voucherDiscount: voucherDiscount || undefined,
            } as Prisma.InputJsonValue,
            requestedAmount: amount,
          },
        });

        // Record voucher usage if applied
        if (voucher && voucherDiscount > 0) {
          await tx.voucherUsage.create({
            data: {
              voucherId: voucher.id,
              userId,
              usedAt: new Date(),
            },
          });
          await tx.voucher.update({
            where: { id: voucher.id },
            data: { uses: { increment: 1 } },
          });
        }

        // Create wallet transaction for tracking
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new Error("User wallet not found");
        }

        await tx.walletTransaction.create({
          data: {
            id: uuidv4(),
            userId,
            walletId: wallet.id,
            transactionType,
            amount: totalAmount,
            status: TransactionStatus.PENDING,
            transactionRef: ref,
            paymentId: payment.id,
            metadata: { isWalletTopUp, productType, serviceType, voucherCode, voucherDiscount },
          },
        });

        // Store transaction data in paymentDetails
        const paymentDetails: PaymentDetails = {
          paymentType: productType || serviceType || "wallet_topup",
          baseAmount: amount,
          serviceFee: isWalletTopUp ? undefined : serviceFee,
          topupCharge: isWalletTopUp ? topupCharge : undefined,
          vat,
          totalAmount,
          recipient: recipient.isVendor ? "vendor" : "admin",
          recipientDetails: recipient.isVendor
            ? {
                vendorId: (recipient.details as VendorDetails).vendorId,
                itemAccount: (recipient.details as VendorDetails).itemAccount,
                deliveryAccount: (recipient.details as VendorDetails).deliveryAccount,
              }
            : {
                merchantAccount: (recipient.details as AdminDetails).merchantAccount,
              },
          voucherCode: voucherCode || undefined,
          voucherDiscount: voucherDiscount || undefined,
          transactions: recipient.isVendor
            ? [
                {
                  type: "item",
                  amount: adjustedAmount,
                  status: TransactionStatus.PENDING,
                  reference: ref,
                },
                ...(serviceFee > 0
                  ? [
                      {
                        type: "service_fee",
                        amount: serviceFee,
                        status: TransactionStatus.PENDING,
                        reference: ref,
                      },
                    ]
                  : []),
                ...(vat > 0
                  ? [
                      {
                        type: "vat",
                        amount: vat,
                        status: TransactionStatus.PENDING,
                        reference: ref,
                      },
                    ]
                  : []),
              ]
            : [
                {
                  type: "admin",
                  amount: totalAmount,
                  status: TransactionStatus.PENDING,
                  reference: ref,
                },
              ],
        };

        // Update payment record with enriched paymentDetails
        await tx.payment.update({
          where: { id: payment.id },
          data: { paymentDetails: paymentDetails as Prisma.InputJsonValue },
        });

        return payment;
      });

      // Select gateway dynamically
      const gateway = await this.gatewayFactory.getGateway(selectedMethod);

      // Initiate payment with selected method
      const result = await gateway.processPayment(
        userId,
        totalAmount,
        selectedMethod,
        productType,
        serviceType,
        ref,
        clientIp,
        cardDetails,
        isWalletTopUp,
        meterNumber,
        voucherCode
      );

      // Log audit trail
      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId,
          action: "PAYMENT_INITIATED",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            transactionRef: ref,
            baseAmount: amount,
            voucherCode: voucherCode || undefined,
            voucherDiscount: voucherDiscount || undefined,
            serviceFee: isWalletTopUp ? undefined : serviceFee,
            topupCharge: isWalletTopUp ? topupCharge : undefined,
            vat,
            totalAmount,
            paymentMethod: selectedMethod,
            productType,
            serviceType,
            meterNumber,
            recipient: recipient.isVendor ? "vendor" : "admin",
          },
        },
      });

      // Handle spread operation with type guard
      const paymentDetails = payment.paymentDetails
        ? { ...(payment.paymentDetails as object), ...result.paymentDetails }
        : result.paymentDetails;

      return {
        transactionId: payment.id,
        paymentDetails,
        redirectUrl: result.redirectUrl,
        status: result.status,
      };
    } catch (error: any) {
      this.logger.error("Payment Processing Error", {
        message: error.message,
        userId,
        paymentMethod,
        productType,
        serviceType,
        itemId,
        voucherCode,
        voucherDiscount,
        stack: error.stack,
      });

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId,
          action: "PAYMENT_FAILED",
          entityType: "Payment",
          entityId: null,
          details: {
            error: error.message,
            transactionRef: ref,
            baseAmount: amount,
            voucherCode: voucherCode || undefined,
            voucherDiscount: voucherDiscount || undefined,
            paymentMethod,
            productType,
            serviceType,
            isWalletTopUp,
            meterNumber,
            itemId,
          },
        },
      });

      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }

  // Process bill payment for electricity with voucher support
  async processBillPayment(
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
  ): Promise<{
    transactionId: string;
    paymentDetails?: PaymentDetails;
    redirectUrl?: string;
    status: string;
    electricityToken?: string;
  }> {
    const ref = transactionRef || `BILL-${uuidv4()}-${Date.now()}`;
    let voucherDiscount = 0;

    try {
      this.logger.info("Processing electricity bill payment", {
        userId,
        amount,
        paymentMethod,
        meterNumber,
        destinationBankCode,
        destinationAccountNumber,
        clientIp: clientIp || "not provided",
        voucherCode: voucherCode || "none",
      });

      // Validate inputs
      if (!/^[0-9a-fA-F-]{36}$/.test(userId)) throw new Error("Invalid user ID: must be a UUID");
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount: must be a positive number");
      if (!meterNumber) throw new Error("meterNumber is required for electricity bill payment");
      if (!destinationBankCode || !destinationAccountNumber) {
        throw new Error("destinationBankCode and destinationAccountNumber are required");
      }
      if (paymentMethod === PaymentMethod.WALLET) throw new Error("WALLET payment method is not supported");
      if (paymentMethod === PaymentMethod.PAY_ON_DELIVERY) {
        throw new Error("PAY_ON_DELIVERY is not supported for bill payments");
      }

      // Check payment method availability
      const selectedMethod = await this.selectPaymentMethod(paymentMethod);
      if (!selectedMethod) {
        throw new Error(`Payment method ${paymentMethod} is currently disabled`);
      }

      // Validate and apply voucher
      let voucher: any = null;
      if (voucherCode) {
        const { discount, valid, voucher: validatedVoucher } = await this.monnify.validateVoucher(
          userId,
          voucherCode,
          "SERVICE",
          amount
        );
        if (!valid || !validatedVoucher) {
          throw new Error("Invalid or inapplicable voucher");
        }
        voucherDiscount = discount;
        voucher = validatedVoucher;
      }

      // Adjust amount after voucher discount
      const adjustedAmount = Math.max(0, amount - voucherDiscount);

      // Calculate fees
      const adminSettings = await this.prisma.adminSettings.findFirst();
      const serviceFee = adminSettings?.defaultServiceCharge ?? 0;
      const vat = adjustedAmount * (adminSettings?.defaultVatRate ?? 0);
      const totalAmount = adjustedAmount + serviceFee + vat;

      // Create payment record
      const payment = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            id: uuidv4(),
            userId,
            amount: totalAmount,
            paymentMethod: selectedMethod,
            status: TransactionStatus.PENDING,
            transactionRef: ref,
            serviceType: "electricity",
            meterNumber,
            paymentDetails: {
              paymentType: "electricity",
              baseAmount: amount,
              serviceFee,
              vat,
              totalAmount,
              voucherCode: voucherCode || undefined,
              voucherDiscount: voucherDiscount || undefined,
            } as Prisma.InputJsonValue,
            requestedAmount: amount,
          },
        });

        // Record voucher usage if applied
        if (voucher && voucherDiscount > 0) {
          await tx.voucherUsage.create({
            data: {
              voucherId: voucher.id,
              userId,
              usedAt: new Date(),
            },
          });
          await tx.voucher.update({
            where: { id: voucher.id },
            data: { uses: { increment: 1 } },
          });
        }

        // Create wallet transaction for tracking
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) {
          throw new Error("User wallet not found");
        }

        await tx.walletTransaction.create({
          data: {
            id: uuidv4(),
            userId,
            walletId: wallet.id,
            transactionType: TransactionType.DEDUCTION,
            amount: totalAmount,
            status: TransactionStatus.PENDING,
            transactionRef: ref,
            paymentId: payment.id,
            metadata: { serviceType: "electricity", meterNumber, voucherCode, voucherDiscount },
          },
        });

        return payment;
      });

      // Select gateway dynamically
      const gateway = await this.gatewayFactory.getGateway(selectedMethod);

      // Initiate bill payment
      const result = await gateway.processBillPayment(
        userId,
        totalAmount,
        selectedMethod,
        meterNumber,
        destinationBankCode,
        destinationAccountNumber,
        ref,
        cardDetails,
        clientIp,
        voucherCode
      );

      // Log audit trail
      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId,
          action: "BILL_PAYMENT_INITIATED",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            transactionRef: ref,
            baseAmount: amount,
            voucherCode: voucherCode || undefined,
            voucherDiscount: voucherDiscount || undefined,
            serviceFee,
            vat,
            totalAmount,
            paymentMethod: selectedMethod,
            serviceType: "electricity",
            meterNumber,
            destinationBankCode,
            destinationAccountNumber,
          },
        },
      });

      // Handle spread operation with type guard
      const paymentDetails = payment.paymentDetails
        ? { ...(payment.paymentDetails as object), ...result.paymentDetails }
        : result.paymentDetails;

      return {
        transactionId: payment.id,
        paymentDetails,
        redirectUrl: result.redirectUrl,
        status: result.status,
        electricityToken: result.electricityToken,
      };
    } catch (error: any) {
      this.logger.error("Bill Payment Processing Error", {
        message: error.message,
        userId,
        paymentMethod,
        meterNumber,
        destinationBankCode,
        destinationAccountNumber,
        voucherCode,
        stack: error.stack,
      });

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId,
          action: "BILL_PAYMENT_FAILED",
          entityType: "Payment",
          entityId: null,
          details: {
            error: error.message,
            transactionRef: ref,
            baseAmount: amount,
            voucherCode: voucherCode || undefined,
            voucherDiscount: voucherDiscount || undefined,
            paymentMethod,
            serviceType: "electricity",
            meterNumber,
            destinationBankCode,
            destinationAccountNumber,
          },
        },
      });

      throw new Error(`Bill payment processing failed: ${error.message}`);
    }
  }

  // Validate card payment using OTP or token
  async validateCardPayment(
    transactionRef: string,
    paymentReference: string,
    tokenId: string,
    token: string
  ): Promise<{ transactionId: string; status: string }> {
    try {
      this.logger.info(`Validating card payment for transaction: ${transactionRef}, paymentReference: ${paymentReference}`);
      return await this.monnify.validateCardPayment(transactionRef, paymentReference, tokenId, token);
    } catch (error: any) {
      this.logger.error("Card Payment Validation Error", {
        message: error.message,
        transactionRef,
        paymentReference,
        stack: error.stack,
      });
      throw new Error(`Card payment validation failed: ${error.message}`);
    }
  }

  // Authorize 3DS card payment
  async authorize3DSCardPayment(
    transactionRef: string,
    paymentReference: string | undefined,
    cardDetails: {
      cardno: string;
      cvv: string;
      expirymonth: string;
      expiryyear: string;
      pin?: string;
    }
  ): Promise<{ transactionId: string; status: string; paymentDetails?: PaymentDetails }> {
    try {
      this.logger.info(`Authorizing 3DS card payment for transaction: ${transactionRef}`);
      return await this.monnify.authorize3DSCardPayment(transactionRef, paymentReference, {
        cardno: cardDetails.cardno,
        cvv: cardDetails.cvv,
        expirymonth: cardDetails.expirymonth,
        expiryyear: cardDetails.expiryyear,
        pin: cardDetails.pin,
      });
    } catch (error: any) {
      this.logger.error("3DS Card Authorization Error", {
        message: error.message,
        transactionRef,
        paymentReference,
        stack: error.stack,
      });
      throw new Error(`3DS card authorization failed: ${error.message}`);
    }
  }

  // Verify payment status
  async verifyPayment(
    transactionId: string
  ): Promise<{ status: TransactionStatus; transactionId: string; amount?: number; paymentMethod?: PaymentMethod }> {
    try {
      this.logger.info(`Verifying payment for transactionId: ${transactionId}`);
      return await this.paymentVerification.verifyPayment(transactionId);
    } catch (error: any) {
      this.logger.error("Payment Verification Error", {
        message: error.message,
        transactionId,
        stack: error.stack,
      });
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  // Verify webhook from payment gateway
  async verifyWebhook(req: Request): Promise<void> {
    try {
      this.logger.info("Verifying webhook");
      await this.paymentVerification.verifyWebhook(req);
    } catch (error: any) {
      this.logger.error("Webhook Verification Error", {
        message: error.message,
        stack: error.stack,
      });
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  // Process refund for a transaction
  async processRefund(
    transactionRef: string,
    userId: string,
    amount: number,
    paymentReference?: string
  ): Promise<void> {
    try {
      this.logger.info(`Processing refund for transactionRef: ${transactionRef}, userId: ${userId}, amount: ${amount}`);
      await this.paymentManagement.processRefund(transactionRef, userId, amount, paymentReference);
    } catch (error: any) {
      this.logger.error("Refund Processing Error", {
        message: error.message,
        transactionRef,
        userId,
        amount,
        stack: error.stack,
      });
      throw new Error(`Refund processing failed: ${error.message}`);
    }
  }

  // Verify BVN for bank account linking
  async verifyBVN(
    userId: string,
    bvn: string,
    bankName: string,
    accountNumber: string,
    transactionRef: string
  ): Promise<{
    transactionId: string;
    status: string;
    verificationDetails: any;
    bankAccountLinked: boolean;
  }> {
    try {
      this.logger.info(`Verifying BVN for userId: ${userId}, transactionRef: ${transactionRef}`);
      return await this.paymentManagement.verifyBVN(userId, bvn, bankName, accountNumber, transactionRef);
    } catch (error: any) {
      this.logger.error("BVN Verification Error", {
        message: error.message,
        userId,
        transactionRef,
        stack: error.stack,
      });
      throw new Error(`BVN verification failed: ${error.message}`);
    }
  }

  // Get transaction history for a user
  async getTransactionHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      status?: TransactionStatus;
      paymentMethod?: PaymentMethod;
    } = {}
  ): Promise<{
    transactions: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      this.logger.info(`Fetching transaction history for userId: ${userId}`, { options });
      return await this.paymentManagement.getTransactionHistory(userId, options);
    } catch (error: any) {
      this.logger.error("Transaction History Fetch Error", {
        message: error.message,
        userId,
        options,
        stack: error.stack,
      });
      throw new Error(`Failed to fetch transaction history: ${error.message}`);
    }
  }

  // Cancel a pending payment
  async cancelPayment(transactionRef: string, userId: string): Promise<void> {
    try {
      this.logger.info(`Cancelling payment for transactionRef: ${transactionRef}, userId: ${userId}`);
      await this.paymentManagement.cancelPayment(transactionRef, userId);
    } catch (error: any) {
      this.logger.error("Payment Cancellation Error", {
        message: error.message,
        transactionRef,
        userId,
        stack: error.stack,
      });
      throw new Error(`Payment cancellation failed: ${error.message}`);
    }
  }

  // Check payment method status
  async checkPaymentMethodStatus(
    paymentMethod: PaymentMethod
  ): Promise<{
    paymentMethod: string;
    isEnabled: boolean;
    gateway: string | null;
    lastUpdated: Date | null;
    updatedBy: string | null;
  }> {
    try {
      this.logger.info(`Checking payment method status for: ${paymentMethod}`);
      return await this.paymentManagement.checkPaymentMethodStatus(paymentMethod);
    } catch (error: any) {
      this.logger.error("Payment Method Status Check Error", {
        message: error.message,
        paymentMethod,
        stack: error.stack,
      });
      throw new Error(`Failed to check payment method status: ${error.message}`);
    }
  }
}

// Export an instance of PaymentService
export default new PaymentService();