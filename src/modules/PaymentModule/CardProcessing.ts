// File: CardProcessing.ts
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import winston from "winston";
import dotenv from "dotenv";
import { PrismaClient, PaymentMethod, TransactionStatus } from "@prisma/client";

dotenv.config();

// Validate Monnify environment variables
if (!process.env.MONNIFY_API_KEY || !process.env.MONNIFY_SECRET_KEY) {
  console.error("Missing MONNIFY_API_KEY or MONNIFY_SECRET_KEY in environment");
  throw new Error("Monnify configuration missing");
}

const logger = winston.createLogger({
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

// Define paymentDetails interface to align with PaymentService.ts
interface paymentDetails {
  [key: string]: any;
  paymentType?: string;
  baseAmount?: number;
  serviceFee?: number;
  topupCharge?: number;
  vat?: number;
  totalAmount?: number;
  auth_url?: string;
  paymentReference?: string;
  transactionStatus?: string;
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
  vendorDetails?: {
    vendorId: string;
    itemAccount: { accountNumber: string; bankName: string };
    deliveryAccount: { accountNumber: string; bankName: string };
  };
  adminDetails?: {
    merchantAccount: { accountNumber: string; bankName: string };
  };
}

// Define Monnify-specific response interfaces
interface MonnifyCardChargeResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    status: string;
    message: string;
    transactionReference: string;
    paymentReference: string;
    authorizedAmount: number;
    tokenId?: string;
    secure3dData?: {
      id: string;
      redirectUrl: string;
    };
  };
}

interface MonnifyCardOtpAuthorizeResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    status: string;
    message: string;
    transactionReference: string;
    paymentReference: string;
    authorizedAmount: number;
  };
}

interface MonnifyCard3DSAuthorizeResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    status: string;
    message: string;
    transactionReference: string;
    paymentReference: string;
    authorizedAmount: number;
    secure3dData?: {
      id: string;
      redirectUrl: string;
    };
  };
}

class CardProcessing {
  private prisma: PrismaClient;
  private baseUrl: string = "https://api.monnify.com";

  constructor() {
    this.prisma = new PrismaClient();
  }

  private async getMonnifyAuthToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/auth/login`,
        {},
        {
          auth: {
            username: process.env.MONNIFY_API_KEY!,
            password: process.env.MONNIFY_SECRET_KEY!,
          },
        }
      );
      return response.data.responseBody.accessToken;
    } catch (error: any) {
      logger.error("Failed to get Monnify auth token", { message: error.message });
      throw new Error("Unable to authenticate with Monnify");
    }
  }

  async initiateCardCharge(
    transactionRef: string,
    cardDetails: {
      number: string;
      pin: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
    },
    deviceInformation: {
      httpBrowserLanguage: string;
      httpBrowserJavaEnabled: boolean;
      httpBrowserJavaScriptEnabled: boolean;
      httpBrowserColorDepth: number;
      httpBrowserScreenHeight: number;
      httpBrowserScreenWidth: number;
      httpBrowserTimeDifference: string;
      userAgentBrowserValue: string;
    }
  ): Promise<{ transactionId: string; status: string; paymentDetails?: paymentDetails }> {
    try {
      logger.info(`Initiating card charge for transaction: ${transactionRef}`);

      if (!transactionRef || !cardDetails || !deviceInformation) {
        throw new Error("Missing required parameters: transactionRef, cardDetails, or deviceInformation");
      }

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef },
        include: { provider: true },
      });
      if (!payment) {
        throw new Error("Payment record not found");
      }
      if (payment.paymentMethod !== PaymentMethod.CARD) {
        throw new Error("Charge initiation is only applicable for CARD payments");
      }
      if (
        !payment.providerId ||
        (await this.prisma.paymentProvider.findUnique({ where: { id: payment.providerId } }))?.name.toLowerCase() !==
          "monnify"
      ) {
        throw new Error("Invalid payment provider for card charge");
      }

      const token = await this.getMonnifyAuthToken();

      const payload = {
        transactionReference: transactionRef,
        collectionChannel: "API_NOTIFICATION",
        card: cardDetails,
        deviceInformation,
      };

      logger.info("Card Charge Payload:", JSON.stringify(payload, null, 2));

      const response = await axios.post<MonnifyCardChargeResponse>(
        `${this.baseUrl}/api/v1/merchant/cards/charge`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "CustomerService/1.0",
          },
          timeout: 10000,
        }
      );

      logger.info("Monnify Charge Response:", JSON.stringify(response.data, null, 2));

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Card charge failed: ${response.data.responseMessage || "Unknown error"}`);
      }

      let status: TransactionStatus = TransactionStatus.PENDING;
      let paymentDetails: paymentDetails = (payment.paymentDetails as paymentDetails | undefined) || {};

      if (response.data.responseBody.status === "SUCCESS") {
        status = TransactionStatus.COMPLETED;
      } else if (response.data.responseBody.status === "PENDING" || response.data.responseBody.status === "BANK_AUTHORIZATION_REQUIRED") {
        status = TransactionStatus.PENDING;
        paymentDetails = {
          ...paymentDetails,
          paymentReference: response.data.responseBody.paymentReference,
          transactionStatus: response.data.responseBody.status,
          totalAmount: response.data.responseBody.authorizedAmount,
          tokenId: response.data.responseBody.tokenId,
          secure3dData: response.data.responseBody.secure3dData,
          paymentType: (payment.productType || payment.serviceType) ?? undefined,
        };
      } else {
        status = TransactionStatus.FAILED;
        throw new Error(`Unexpected status: ${response.data.responseBody.status}`);
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          paymentDetails,
          monnifyRef: response.data.responseBody.paymentReference,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment.userId,
          action: "CARD_CHARGE_INITIATED",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            transactionRef,
            paymentReference: response.data.responseBody.paymentReference,
            status,
          },
        },
      });

      logger.info(`Card charge initiated: ${transactionRef} - Status: ${status}`);
      return {
        transactionId: transactionRef,
        status,
        paymentDetails,
      };
    } catch (error: any) {
      logger.error("Card Charge Error:", {
        message: error.message,
        transactionRef,
        response: error.response?.data,
        stack: error.stack,
      });

      const payment = await this.prisma.payment.findFirst({ where: { transactionRef } });
      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: TransactionStatus.FAILED },
        });
      } else {
        logger.warn("Payment not found in catch block, skipping payment status update", { transactionRef });
      }

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment?.userId || "unknown",
          action: "CARD_CHARGE_FAILED",
          entityType: "Payment",
          entityId: payment?.id || null,
          details: {
            error: error.message,
            transactionRef,
            paymentReference: payment?.monnifyRef || "unknown",
          },
        },
      });

      throw new Error(`Card charge failed: ${error.message}`);
    }
  }

  async validateCardPayment(
    transactionRef: string,
    paymentReference: string,
    tokenId: string,
    token: string
  ): Promise<{ transactionId: string; status: string }> {
    try {
      logger.info(`Validating card payment for transaction: ${transactionRef}, paymentReference: ${paymentReference}`);

      if (!transactionRef || !paymentReference || !tokenId || !token) {
        throw new Error("Missing required parameters: transactionRef, paymentReference, tokenId, or token");
      }

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef },
        include: { provider: true },
      });
      if (!payment) {
        throw new Error("Payment record not found");
      }
      if (payment.paymentMethod !== PaymentMethod.CARD) {
        throw new Error("Validation is only applicable for CARD payments");
      }
      if (
        !payment.providerId ||
        (await this.prisma.paymentProvider.findUnique({ where: { id: payment.providerId } }))?.name.toLowerCase() !==
          "monnify"
      ) {
        throw new Error("Invalid payment provider for card validation");
      }

      // Move token declaration before Axios request
      const authToken = await this.getMonnifyAuthToken();

      const response = await axios.post<MonnifyCardOtpAuthorizeResponse>(
        `${this.baseUrl}/api/v1/merchant/cards/otp/authorize`,
        {
          transactionReference: paymentReference,
          collectionChannel: "API_NOTIFICATION",
          tokenId,
          token,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "CustomerService/1.0",
          },
          timeout: 10000,
        }
      );

      logger.info("Monnify OTP Authorization Response:", JSON.stringify(response.data, null, 2));

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Card validation failed: ${response.data.responseMessage || "Unknown error"}`);
      }

      let status: TransactionStatus = TransactionStatus.PENDING;
      const paymentDetails = (payment.paymentDetails as paymentDetails | undefined) || {};

      if (response.data.responseBody.status === "SUCCESS") {
        status = TransactionStatus.COMPLETED;
      } else {
        status = TransactionStatus.FAILED;
        throw new Error(`Unexpected status: ${response.data.responseBody.status}`);
      }

      const updatedPaymentDetails: paymentDetails = {
        ...paymentDetails,
        paymentReference: response.data.responseBody.paymentReference || paymentReference,
        transactionStatus: response.data.responseBody.status,
        totalAmount: response.data.responseBody.authorizedAmount,
        paymentType: (payment.productType || payment.serviceType) ?? undefined,
      };

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          paymentDetails: updatedPaymentDetails,
          monnifyRef: response.data.responseBody.paymentReference || paymentReference,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment.userId,
          action: "CARD_OTP_AUTHORIZATION",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            transactionRef,
            paymentReference,
            status,
            tokenId,
          },
        },
      });

      logger.info(`Card payment validated: ${transactionRef} - Status: ${status}`);
      return {
        transactionId: transactionRef,
        status,
      };
    } catch (error: any) {
      logger.error("Card OTP Authorization Error:", {
        message: error.message,
        transactionRef,
        paymentReference,
        response: error.response?.data,
        stack: error.stack,
      });

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: TransactionStatus.FAILED },
        });
      } else {
        logger.warn("Payment not found in catch block, skipping payment status update", { transactionRef });
      }

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment?.userId || "unknown",
          action: "CARD_OTP_AUTHORIZATION_FAILED",
          entityType: "Payment",
          entityId: payment?.id || null,
          details: {
            error: error.message,
            transactionRef,
            paymentReference,
          },
        },
      });

      throw new Error(`Card OTP authorization failed: ${error.message}`);
    }
  }

  async authorize3DSCardPayment(
    transactionRef: string,
    paymentReference: string | undefined,
    cardDetails: {
      number: string;
      pin: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
    }
  ): Promise<{ transactionId: string; status: string; paymentDetails?: paymentDetails }> {
    try {
      logger.info(`Authorizing 3DS card payment for transaction: ${transactionRef}`);

      if (!transactionRef || !cardDetails) {
        throw new Error("Transaction reference and card details are required");
      }

      const payment = await this.prisma.payment.findFirst({
        where: { transactionRef },
        include: { provider: true },
      });
      if (!payment) {
        throw new Error("Payment record not found");
      }
      if (payment.paymentMethod !== PaymentMethod.CARD) {
        throw new Error("Authorization is only applicable for CARD payments");
      }
      if (
        !payment.providerId ||
        (await this.prisma.paymentProvider.findUnique({ where: { id: payment.providerId } }))?.name.toLowerCase() !==
          "monnify"
      ) {
        throw new Error("Invalid payment provider for 3DS authorization");
      }

      const resolvedPaymentReference = paymentReference || payment.monnifyRef;
      if (!resolvedPaymentReference) {
        throw new Error("Monnify payment reference missing");
      }

      const token = await this.getMonnifyAuthToken();

      const payload = {
        transactionReference: resolvedPaymentReference,
        collectionChannel: "API_NOTIFICATION",
        card: cardDetails,
        apiKey: process.env.MONNIFY_API_KEY!,
      };

      logger.info("3DS Authorization Payload:", JSON.stringify(payload, null, 2));

      const response = await axios.post<MonnifyCard3DSAuthorizeResponse>(
        `${this.baseUrl}/api/v1/sdk/cards/secure-3d/authorize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "CustomerService/1.0",
          },
          timeout: 10000,
        }
      );

      logger.info("Monnify 3DS Authorization Response:", JSON.stringify(response.data, null, 2));

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`3DS authorization failed: ${response.data.responseMessage || "Unknown error"}`);
      }

      let status: TransactionStatus = TransactionStatus.PENDING;
      let paymentDetails: paymentDetails = (payment.paymentDetails as paymentDetails | undefined) || {};

      if (response.data.responseBody.status === "SUCCESS") {
        status = TransactionStatus.COMPLETED;
        paymentDetails = {
          ...paymentDetails,
          paymentReference: response.data.responseBody.paymentReference,
          transactionStatus: response.data.responseBody.status,
          totalAmount: response.data.responseBody.authorizedAmount,
          paymentType: (payment.productType || payment.serviceType) ?? undefined,
        };
      } else if (response.data.responseBody.status === "BANK_AUTHORIZATION_REQUIRED") {
        paymentDetails = {
          ...paymentDetails,
          paymentReference: response.data.responseBody.paymentReference,
          transactionStatus: response.data.responseBody.status,
          secure3dData: response.data.responseBody.secure3dData,
          paymentType: (payment.productType || payment.serviceType) ?? undefined,
        };
      } else {
        status = TransactionStatus.FAILED;
        throw new Error(`Unexpected status: ${response.data.responseBody.status}`);
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          paymentDetails,
          monnifyRef: response.data.responseBody.paymentReference || resolvedPaymentReference,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment.userId,
          action: "CARD_3DS_AUTHORIZATION",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            transactionRef,
            paymentReference: resolvedPaymentReference,
            status,
            secure3dData: response.data.responseBody.secure3dData,
          },
        },
      });

      logger.info(`3DS card payment authorized: ${transactionRef} - Status: ${status}`);
      return {
        transactionId: transactionRef,
        status,
        paymentDetails,
      };
    } catch (error: any) {
      logger.error("3DS Card Authorization Error:", {
        message: error.message,
        transactionRef,
        paymentReference,
        response: error.response?.data,
        stack: error.stack,
      });

      const payment = await this.prisma.payment.findFirst({ where: { transactionRef } });
      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: TransactionStatus.FAILED },
        });
      } else {
        logger.warn("Payment not found in catch block, skipping payment status update", { transactionRef });
      }

      await this.prisma.auditLog.create({
        data: {
          id: uuidv4(),
          userId: payment?.userId || "unknown",
          action: "CARD_3DS_AUTHORIZATION_FAILED",
          entityType: "Payment",
          entityId: payment?.id || null,
          details: {
            error: error.message,
            transactionRef,
            paymentReference: paymentReference || payment?.monnifyRef || "unknown",
          },
        },
      });

      throw new Error(`3DS card authorization failed: ${error.message}`);
    }
  }
}

export default CardProcessing;