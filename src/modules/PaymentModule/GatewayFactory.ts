import { PaymentMethod, TransactionStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import MonnifyPaymentInitiation from "./MonnifyPaymentInitiation";
import winston from "winston";

// Interface for payment details, matching PaymentService.ts and MonnifyPaymentInitiation.ts
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

// Interface for payment gateways
interface PaymentGateway {
  processPayment(
    userId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    productType?: string,
    serviceType?: string,
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
  ): Promise<{
    transactionId: string;
    paymentDetails?: PaymentDetails;
    redirectUrl?: string;
    status: string;
  }>;
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
  ): Promise<{
    transactionId: string;
    paymentDetails?: PaymentDetails;
    redirectUrl?: string;
    status: string;
    electricityToken?: string;
  }>;
}

class GatewayFactory {
  private monnify: MonnifyPaymentInitiation;
  private logger: winston.Logger;

  constructor() {
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

  async getGateway(paymentMethod: PaymentMethod): Promise<PaymentGateway> {
    this.logger.info(`Selecting payment gateway for method: ${paymentMethod}`);

    switch (paymentMethod) {
      case PaymentMethod.CARD:
      case PaymentMethod.TRANSFER:
      case PaymentMethod.VIRTUAL_ACCOUNT:
      case PaymentMethod.MONNIFY:
        return {
          processPayment: async (
            userId: string,
            amount: number,
            paymentMethod: PaymentMethod,
            productType?: string,
            serviceType?: string,
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
          ) => {
            try {
              const result = await this.monnify.processPayment(
                userId,
                amount,
                paymentMethod,
                productType,
                serviceType,
                transactionRef,
                clientIp,
                cardDetails,
                isWalletTopUp,
                meterNumber,
                voucherCode
              );
              this.logger.info(`Monnify payment initiated for transaction: ${result.transactionId}`, {
                paymentMethod,
                userId,
                amount,
              });
              return result;
            } catch (error: any) {
              this.logger.error(`Monnify payment initiation failed`, {
                paymentMethod,
                userId,
                amount,
                error: error.message,
                stack: error.stack,
              });
              throw new Error(`Payment initiation failed: ${error.message}`);
            }
          },
          processBillPayment: async (
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
          ) => {
            try {
              const result = await this.monnify.processBillPayment(
                userId,
                amount,
                paymentMethod,
                meterNumber,
                destinationBankCode,
                destinationAccountNumber,
                transactionRef,
                cardDetails,
                clientIp,
                voucherCode
              );
              this.logger.info(`Monnify bill payment initiated for transaction: ${result.transactionId}`, {
                paymentMethod,
                userId,
                amount,
                meterNumber,
                destinationBankCode,
                destinationAccountNumber,
              });
              return result;
            } catch (error: any) {
              this.logger.error(`Monnify bill payment initiation failed`, {
                paymentMethod,
                userId,
                amount,
                meterNumber,
                destinationBankCode,
                destinationAccountNumber,
                error: error.message,
                stack: error.stack,
              });
              throw new Error(`Bill payment initiation failed: ${error.message}`);
            }
          },
        };

      case PaymentMethod.PAY_ON_DELIVERY:
        return {
          processPayment: async (
            userId: string,
            amount: number,
            paymentMethod: PaymentMethod,
            productType?: string,
            serviceType?: string,
            transactionRef?: string,
            clientIp?: string,
            cardDetails?: any,
            isWalletTopUp: boolean = false,
            meterNumber?: string,
            voucherCode?: string
          ) => {
            try {
              const ref = transactionRef || `COD-${uuidv4()}-${Date.now()}`;
              this.logger.info(`Processing pay on delivery for user: ${userId}`, {
                paymentMethod,
                amount,
                transactionRef: ref,
              });

              // Validate inputs
              if (serviceType === "electricity") {
                throw new Error("Pay on delivery is not supported for electricity payments");
              }
              if (isWalletTopUp) {
                throw new Error("Pay on delivery is not supported for wallet top-up");
              }

              // Handle voucher for pay on delivery if provided
              let voucherDiscount = 0;
              let voucher: any = null;
              if (voucherCode && (productType || serviceType)) {
                const voucherContext = productType === "product" ? "PRODUCT" : "SERVICE";
                const { discount, valid, voucher: validatedVoucher } = await this.monnify.validateVoucher(
                  userId,
                  voucherCode,
                  voucherContext,
                  amount
                );
                if (!valid || !validatedVoucher) {
                  this.logger.warn(`Invalid or inapplicable voucher for COD`, {
                    userId,
                    voucherCode,
                    voucherContext,
                    amount,
                  });
                  throw new Error("Invalid or inapplicable voucher");
                }
                voucherDiscount = validatedVoucher.type === "PERCENTAGE" ? amount * (discount / 100) : discount;
                voucher = validatedVoucher;
              }

              const adjustedAmount = Math.max(0, amount - voucherDiscount);
              const adminSettings = await this.monnify['prisma'].adminSettings.findFirst();
              const serviceFee = isWalletTopUp ? 0 : (adminSettings?.defaultServiceCharge ?? 0);
              const vatRate = adminSettings?.defaultVatRate ?? 0;
              const vat = adjustedAmount * vatRate;
              const totalAmount = adjustedAmount + serviceFee + vat;

              const paymentDetails: PaymentDetails = {
                paymentType: productType || serviceType || "pay_on_delivery",
                baseAmount: amount,
                serviceFee: isWalletTopUp ? undefined : serviceFee,
                vat,
                totalAmount,
                voucherCode: voucherCode || undefined,
                voucherDiscount: voucherDiscount || undefined,
                transactionStatus: "PENDING",
              };

              if (voucher && voucherDiscount > 0) {
                await this.monnify['prisma'].voucherUsage.create({
                  data: {
                    voucherId: voucher.id,
                    userId,
                    usedAt: new Date(),
                  },
                });
                await this.monnify['prisma'].voucher.update({
                  where: { id: voucher.id },
                  data: { uses: { increment: 1 } },
                });
              }

              return {
                transactionId: ref,
                paymentDetails,
                status: "PENDING",
              };
            } catch (error: any) {
              this.logger.error(`Pay on delivery processing failed`, {
                paymentMethod,
                userId,
                amount,
                error: error.message,
                stack: error.stack,
              });
              throw new Error(`Pay on delivery processing failed: ${error.message}`);
            }
          },
          processBillPayment: async () => {
            this.logger.error(`Pay on delivery is not supported for bill payments`);
            throw new Error(`Pay on delivery is not supported for bill payments`);
          },
        };

      default:
        this.logger.error(`No gateway available for payment method: ${paymentMethod}`);
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  }
}

export default GatewayFactory;