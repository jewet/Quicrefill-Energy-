import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import nodemailer from "nodemailer";
import { createPaymentRecord } from "../../models/paymentModel";
import winston from "winston";
import dotenv from "dotenv";
import { PrismaClient, PaymentMethod, TransactionStatus } from "@prisma/client";
import VoucherModule from "../voucherModule/VoucherModule";
import CardProcessing from "./CardProcessing";

dotenv.config();

// Validate environment variables
if (
  !process.env.MONNIFY_API_KEY ||
  !process.env.MONNIFY_SECRET_KEY ||
  !process.env.MONNIFY_CONTRACT_CODE ||
  !process.env.FLUTTERWAVE_API_KEY ||
  !process.env.FLUTTERWAVE_SOURCE_ACCOUNT
) {
  console.error("Missing required environment variables");
  throw new Error("Configuration missing for Monnify or Flutterwave");
}

// Initialize nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

// Update paymentDetails interface
interface PaymentDetails {
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
  voucherCode?: string;
  voucherDiscount?: number;
  electricityToken?: string;
}

// Define interfaces for Monnify and Flutterwave responses
interface MonnifyPaymentResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    checkoutUrl: string;
    transactionReference: string;
    paymentReference: string;
  };
}

interface MonnifyReservedAccountResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accountReference: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
    collectionChannel: string;
    reservationReference: string;
    reservedAccountType: string;
  };
}

interface MonnifyMerchantAccountResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accountNumber: string;
    bankName: string;
    bankCode: string;
  };
}

interface FlutterwaveDisbursementResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    amount: number;
    reference: string;
    status: string;
    dateCreated: string;
    totalFee: number;
    destinationAccountName: string;
    destinationBankName: string;
    destinationAccountNumber: string;
    destinationBankCode: string;
  };
}

interface VoucherModuleInterface {
  validateVoucher(
    userId: string,
    voucherCode: string,
    context: "PRODUCT" | "SERVICE",
    amount: number
  ): Promise<{ discount: number; valid: boolean; voucher: any }>;
}

class MonnifyPaymentInitiation {
  private prisma: PrismaClient;
  private monnifyBaseUrl: string = "https://api.monnify.com";
  private flutterwaveBaseUrl: string = "https://api.flutterwave.com";
  private voucherModule: VoucherModuleInterface;
  private cardProcessing: CardProcessing;

  constructor() {
    this.prisma = new PrismaClient();
    this.voucherModule = VoucherModule;
    this.cardProcessing = new CardProcessing();
  }

  // Public method to validate vouchers
  public async validateVoucher(
    userId: string,
    voucherCode: string,
    context: "PRODUCT" | "SERVICE",
    amount: number
  ): Promise<{ discount: number; valid: boolean; voucher: any }> {
    try {
      return await this.voucherModule.validateVoucher(userId, voucherCode, context, amount);
    } catch (error: any) {
      logger.error("Voucher validation failed", { userId, voucherCode, context, amount, message: error.message });
      throw new Error(`Voucher validation failed: ${error.message}`);
    }
  }

  private async getMonnifyAuthToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.monnifyBaseUrl}/api/v1/auth/login`,
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

  private async getFlutterwaveAuthToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/v3/token`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.FLUTTERWAVE_API_KEY}`,
          },
        }
      );
      return response.data.data.access_token;
    } catch (error: any) {
      logger.error("Failed to get Flutterwave auth token", { message: error.message });
      throw new Error("Unable to authenticate with Flutterwave");
    }
  }

  async getReservedAccountDetails(accountReference: string): Promise<{ accountNumber: string; bankName: string }> {
    try {
      const token = await this.getMonnifyAuthToken();
      const response = await axios.get<MonnifyReservedAccountResponse>(
        `${this.monnifyBaseUrl}/api/v2/bank-transfer/reserved-accounts/${accountReference}`,
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

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Failed to fetch reserved account: ${response.data.responseMessage}`);
      }

      const { accountNumber, bankName } = response.data.responseBody;
      if (!accountNumber || !bankName) {
        throw new Error("Invalid reserved account response: Missing accountNumber or bankName");
      }

      logger.info("Successfully fetched reserved account details", { accountReference });
      return { accountNumber, bankName };
    } catch (error: any) {
      logger.error("Error fetching reserved account details from Monnify", {
        message: error.message,
        accountReference,
        response: error.response?.data,
      });
      throw new Error(`Failed to fetch reserved account details: ${error.message}`);
    }
  }

  async getMerchantAccount(): Promise<{ accountNumber: string; bankName: string }> {
    try {
      const token = await this.getMonnifyAuthToken();
      const response = await axios.get<MonnifyMerchantAccountResponse>(
        `${this.monnifyBaseUrl}/api/v1/merchant/account`,
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

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Failed to fetch merchant account: ${response.data.responseMessage}`);
      }

      const { accountNumber, bankName } = response.data.responseBody;
      if (!accountNumber || !bankName) {
        throw new Error("Invalid merchant account response: Missing accountNumber or bankName");
      }

      logger.info("Successfully fetched merchant account details");
      return { accountNumber, bankName };
    } catch (error: any) {
      logger.error("Error fetching merchant account from Monnify", {
        message: error.message,
        response: error.response?.data,
      });
      throw new Error(`Failed to fetch merchant account details: ${error.message}`);
    }
  }

  private async isPaymentMethodEnabled(paymentMethod: PaymentMethod): Promise<boolean> {
    const config = await this.prisma.paymentConfig.findUnique({ where: { paymentMethod } });
    if (!config) {
      logger.warn(`No PaymentConfig entry for ${paymentMethod}. Defaulting to disabled.`);
      return false;
    }
    return config.isEnabled;
  }

  private async getPaymentGateway(paymentMethod: PaymentMethod): Promise<string | null> {
    const config = await this.prisma.paymentConfig.findUnique({ where: { paymentMethod } });
    return config?.gateway ?? null;
  }

  private async initiateMonnifyPayment(
    transactionRef: string,
    amount: number,
    userId: string,
    type: string,
    clientIp?: string
  ): Promise<{ transactionId: string; paymentDetails: PaymentDetails; status: string }> {
    try {
      logger.info(`🔹 Initiating Monnify payment for ${type}...`, {
        transactionRef,
        amount,
        userId,
        clientIp: clientIp || "unknown",
      });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      const customerEmail = user.email || "fallback@example.com";
      const customerFullName = user.name || "Customer";

      const token = await this.getMonnifyAuthToken();

      const fullPayload = {
        amount,
        customerName: customerFullName,
        customerEmail,
        paymentReference: transactionRef,
        paymentDescription: type === "wallet_topup" ? "Wallet Top-Up" : `${type} Payment`,
        currencyCode: "NGN",
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        redirectUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-callback`,
        paymentMethods: ["ACCOUNT_TRANSFER"],
        metaData: {
          payment_method: PaymentMethod.MONNIFY,
          paymentType: type,
          ipAddress: clientIp || "unknown",
        },
      };

      logger.info("Monnify Payment Payload:", JSON.stringify(fullPayload, null, 2));

      const response = await axios.post<MonnifyPaymentResponse>(
        `${this.monnifyBaseUrl}/api/v1/merchant/transactions/init-transaction`,
        fullPayload,
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

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Monnify payment initiation failed: ${response.data.responseMessage || "No Monnify data"}`);
      }

      logger.debug("Monnify Payment Response:", {
        response: JSON.stringify(response.data, null, 2),
      });

      const reservedAccountResponse = await axios.get<MonnifyReservedAccountResponse>(
        `${this.monnifyBaseUrl}/api/v2/bank-transfer/reserved-accounts/${transactionRef}`,
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

      if (!reservedAccountResponse.data.requestSuccessful || reservedAccountResponse.data.responseCode !== "0") {
        throw new Error(`Failed to fetch reserved account: ${reservedAccountResponse.data.responseMessage}`);
      }

      const monnifyData = reservedAccountResponse.data.responseBody;
      const paymentDetails: PaymentDetails & { virtualAccount: NonNullable<PaymentDetails["virtualAccount"]> } = {
        virtualAccount: {
          accountNumber: monnifyData.accountNumber,
          bankName: monnifyData.bankName,
          accountReference: monnifyData.accountReference,
          note: `${type === "wallet_topup" ? "Wallet Top-Up" : type} Payment`,
          amount: amount.toString(),
        },
        paymentType: type,
        totalAmount: amount,
        paymentReference: response.data.responseBody.paymentReference,
        checkoutUrl: response.data.responseBody.checkoutUrl,
      };

      if (!paymentDetails.virtualAccount.accountNumber || !paymentDetails.virtualAccount.bankName) {
        throw new Error("Invalid Monnify payment response: Missing accountNumber or bankName");
      }

      const finalAmount = amount;
      await this.prisma.payment.update({
        where: { id: (await this.prisma.payment.findFirst({ where: { transactionRef } }))!.id },
        data: {
          amount: finalAmount,
          paymentDetails,
          status: TransactionStatus.PENDING,
          monnifyRef: monnifyData.accountReference,
        },
      });

      try {
        const mailOptions = {
          from: "Quicrefil <astralearnia@gmail.com>",
          to: customerEmail,
          subject: `Your Quicrefil ${type === "wallet_topup" ? "Wallet Top-Up" : type} Monnify Payment Details`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Your Quicrefil ${type === "wallet_topup" ? "Wallet Top-Up" : type} Monnify Payment</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <img src="https://via.placeholder.com/150x50?text=Quicrefil+Logo" alt="Quicrefil Logo" style="max-width: 150px; height: auto;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 20px 20px;">
                          <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${customerFullName},</h2>
                          <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Please fund the account below to complete your ${type === "wallet_topup" ? "wallet top-up" : type} order via Monnify.</p>
                          <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                            <tr>
                              <td style="color: #555555; font-size: 16px;">
                                <strong>Transaction Ref:</strong> ${transactionRef}<br>
                                <strong>Account Number:</strong> <span style="color: #e74c3c; font-size: 18px; font-weight: bold;">${paymentDetails.virtualAccount.accountNumber}</span><br>
                                <strong>Bank Name:</strong> ${paymentDetails.virtualAccount.bankName}<br>
                                <strong>Amount:</strong> ₦${paymentDetails.virtualAccount.amount}<br>
                                <strong>Narration:</strong> ${paymentDetails.virtualAccount.note || "N/A"}<br>
                              </td>
                            </tr>
                          </table>
                          <p style="color: #555555; font-size: 16px; margin: 0 0 15px;">Ensure you include the narration in your transfer.</p>
                          <p style="color: #555555; font-size: 16px; margin: 15px 0;"><strong>Total Amount:</strong> ₦${finalAmount.toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                          <p style="font-size: 14px; margin: 0 0 5px;">Best regards,<br><strong>The Quicrefil Support Team</strong></p>
                          <p style="font-size: 12px; margin: 0;">© 2025 Quicrefil. All rights reserved.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Monnify payment email sent to ${customerEmail}`, { transactionRef });
      } catch (emailError: any) {
        logger.error("Failed to send Monnify payment email:", {
          message: emailError.message,
          userId,
          transactionRef,
        });
      }

      logger.info("Monnify Payment Initiated Successfully:", { paymentDetails });
      return {
        transactionId: transactionRef,
        paymentDetails,
        status: TransactionStatus.PENDING,
      };
    } catch (error: any) {
      logger.error("Monnify Payment Initiation Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        userId,
        transactionRef,
      });
      throw new Error(`Monnify payment initiation failed: ${error.message}`);
    }
  }

  private async initiateBankTransferPayment(
    transactionRef: string,
    amount: number,
    userId: string,
    type: string,
    clientIp?: string
  ): Promise<{ transactionId: string; paymentDetails: PaymentDetails; status: string }> {
    try {
      logger.info(`🔹 Initiating bank transfer payment for ${type}...`, {
        transactionRef,
        amount,
        userId,
        clientIp: clientIp || "unknown",
      });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      const customerEmail = user.email || "fallback@example.com";
      const customerFullName = user.name || "Customer";

      const token = await this.getMonnifyAuthToken();

      const fullPayload = {
        amount,
        customerName: customerFullName,
        customerEmail,
        paymentReference: transactionRef,
        paymentDescription: type === "wallet_topup" ? "Wallet Top-Up" : `${type} Payment`,
        currencyCode: "NGN",
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        redirectUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-callback`,
        paymentMethods: ["ACCOUNT_TRANSFER"],
        metaData: {
          payment_method: PaymentMethod.TRANSFER,
          paymentType: type,
          ipAddress: clientIp || "unknown",
        },
      };

      logger.info("Bank Transfer Payment Payload:", JSON.stringify(fullPayload, null, 2));

      const response = await axios.post<MonnifyPaymentResponse>(
        `${this.monnifyBaseUrl}/api/v1/merchant/bank-transfer/init-payment`,
        fullPayload,
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

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Bank transfer initiation failed: ${response.data.responseMessage || "No transfer data"}`);
      }

      logger.debug("Monnify Bank Transfer Response:", {
        response: JSON.stringify(response.data, null, 2),
      });

      const reservedAccountResponse = await axios.get<MonnifyReservedAccountResponse>(
        `${this.monnifyBaseUrl}/api/v2/bank-transfer/reserved-accounts/${transactionRef}`,
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

      if (!reservedAccountResponse.data.requestSuccessful || reservedAccountResponse.data.responseCode !== "0") {
        throw new Error(`Failed to fetch reserved account: ${reservedAccountResponse.data.responseMessage}`);
      }

      const transferData = reservedAccountResponse.data.responseBody;
      const paymentDetails: PaymentDetails & { bankTransfer: NonNullable<PaymentDetails["bankTransfer"]> } = {
        bankTransfer: {
          accountReference: transferData.accountReference,
          accountNumber: transferData.accountNumber,
          bankName: transferData.bankName,
          accountExpiration:
            transferData.reservedAccountType === "TEMPORARY"
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              : "N/A",
          narration: `${type} Payment - ${transactionRef}`,
          transferAmount: amount.toString(),
        },
        paymentType: type,
        totalAmount: amount,
        paymentReference: response.data.responseBody.paymentReference,
        checkoutUrl: response.data.responseBody.checkoutUrl,
      };

      if (!paymentDetails.bankTransfer.accountNumber || !paymentDetails.bankTransfer.bankName) {
        throw new Error("Invalid bank transfer response: Missing accountNumber or bankName");
      }

      const finalAmount = amount;
      await this.prisma.payment.update({
        where: { id: (await this.prisma.payment.findFirst({ where: { transactionRef } }))!.id },
        data: {
          amount: finalAmount,
          paymentDetails,
          status: TransactionStatus.PENDING,
          monnifyRef: transferData.accountReference,
        },
      });

      try {
        const mailOptions = {
          from: "Quicrefil <astralearnia@gmail.com>",
          to: customerEmail,
          subject: `Your Quicrefil ${type === "wallet_topup" ? "Wallet Top-Up" : type} Payment Details`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Your Quicrefil ${type === "wallet_topup" ? "Wallet Top-Up" : type} Payment</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <img src="https://via.placeholder.com/150x50?text=Quicrefil+Logo" alt="Quicrefil Logo" style="max-width: 150px; height: auto;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 20px 20px;">
                          <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${customerFullName},</h2>
                          <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Please make your payment to the bank account below to complete your ${type === "wallet_topup" ? "wallet top-up" : type} order.</p>
                          <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                            <tr>
                              <td style="color: #555555; font-size: 16px;">
                                <strong>Transaction Ref:</strong> ${transactionRef}<br>
                                <strong>Account Number:</strong> <span style="color: #e74c3c; font-size: 18px; font-weight: bold;">${paymentDetails.bankTransfer.accountNumber}</span><br>
                                <strong>Bank Name:</strong> ${paymentDetails.bankTransfer.bankName}<br>
                                <strong>Amount:</strong> ₦${paymentDetails.bankTransfer.transferAmount}<br>
                                <strong>Narration:</strong> ${paymentDetails.bankTransfer.narration}<br>
                                <strong>Expires:</strong> ${paymentDetails.bankTransfer.accountExpiration}<br>
                              </td>
                            </tr>
                          </table>
                          <p style="color: #555555; font-size: 16px; margin: 0 0 15px;">Ensure you include the narration in your transfer. This account is valid until ${paymentDetails.bankTransfer.accountExpiration}.</p>
                          <p style="color: #555555; font-size: 16px; margin: 15px 0;"><strong>Total Amount:</strong> ₦${finalAmount.toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                          <p style="font-size: 14px; margin: 0 0 5px;">Best regards,<br><strong>The Quicrefil Support Team</strong></p>
                          <p style="font-size: 12px; margin: 0;">© 2025 Quicrefil. All rights reserved.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Bank transfer email sent to ${customerEmail}`, { transactionRef });
      } catch (emailError: any) {
        logger.error("Failed to send bank transfer email:", {
          message: emailError.message,
          userId,
          transactionRef,
        });
      }

      logger.info("Bank Transfer Payment Initiated Successfully:", { paymentDetails });
      return {
        transactionId: transactionRef,
        paymentDetails,
        status: TransactionStatus.PENDING,
      };
    } catch (error: any) {
      logger.error("Bank Transfer Payment Initiation Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        userId,
        transactionRef,
      });
      throw new Error(`Bank transfer payment initiation failed: ${error.message}`);
    }
  }

  private async initiateTransferPayment(
    transactionRef: string,
    amount: number,
    userId: string,
    type: string,
    clientIp?: string
  ): Promise<{ transactionId: string; paymentDetails: PaymentDetails; status: string }> {
    try {
      logger.info(`🔹 Initiating virtual account payment for ${type}...`, {
        transactionRef,
        amount,
        userId,
        clientIp: clientIp || "unknown",
      });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      const customerEmail = user.email || "fallback@example.com";
      const customerFullName = user.name || "Customer";

      const token = await this.getMonnifyAuthToken();

      const fullPayload = {
        amount,
        customerName: customerFullName,
        customerEmail,
        paymentReference: transactionRef,
        paymentDescription: type === "wallet_topup" ? "Wallet Top-Up" : `${type} Payment`,
        currencyCode: "NGN",
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        redirectUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-callback`,
        paymentMethods: ["ACCOUNT_TRANSFER"],
        metaData: {
          payment_method: PaymentMethod.VIRTUAL_ACCOUNT,
          paymentType: type,
          ipAddress: clientIp || "unknown",
        },
      };

      logger.info("Virtual Account Payment Payload:", JSON.stringify(fullPayload, null, 2));

      const response = await axios.post<MonnifyPaymentResponse>(
        `${this.monnifyBaseUrl}/api/v1/merchant/transactions/init-transaction`,
        fullPayload,
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

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Virtual account creation failed: ${response.data.responseMessage || "No virtual account data"}`);
      }

      logger.debug("Monnify Virtual Account Response:", {
        response: JSON.stringify(response.data, null, 2),
      });

      const reservedAccountResponse = await axios.get<MonnifyReservedAccountResponse>(
        `${this.monnifyBaseUrl}/api/v2/bank-transfer/reserved-accounts/${transactionRef}`,
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

      if (!reservedAccountResponse.data.requestSuccessful || reservedAccountResponse.data.responseCode !== "0") {
        throw new Error(`Failed to fetch reserved account: ${reservedAccountResponse.data.responseMessage}`);
      }

      const virtualAccountData = reservedAccountResponse.data.responseBody;
      const paymentDetails: PaymentDetails & { virtualAccount: NonNullable<PaymentDetails["virtualAccount"]> } = {
        virtualAccount: {
          accountNumber: virtualAccountData.accountNumber,
          bankName: virtualAccountData.bankName,
          accountReference: virtualAccountData.accountReference,
          note: `${type === "wallet_topup" ? "Wallet Top-Up" : type} Payment`,
          amount: amount.toString(),
        },
        paymentType: type,
        totalAmount: amount,
        paymentReference: response.data.responseBody.paymentReference,
        checkoutUrl: response.data.responseBody.checkoutUrl,
      };

      if (!paymentDetails.virtualAccount.accountNumber || !paymentDetails.virtualAccount.bankName) {
        throw new Error("Invalid virtual account response: Missing accountNumber or bankName");
      }

      const finalAmount = amount;
      await this.prisma.payment.update({
        where: { id: (await this.prisma.payment.findFirst({ where: { transactionRef } }))!.id },
        data: {
          amount: finalAmount,
          paymentDetails,
          status: TransactionStatus.PENDING,
          monnifyRef: virtualAccountData.accountReference,
        },
      });

      try {
        const mailOptions = {
          from: "Quicrefil <astralearnia@gmail.com>",
          to: customerEmail,
          subject: `Your Quicrefil ${type === "wallet_topup" ? "Wallet Top-Up" : type} Virtual Account Details`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Your Quicrefil ${type === "wallet_topup" ? "Wallet Top-Up" : type} Virtual Account</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <img src="https://via.placeholder.com/150x50?text=Quicrefil+Logo" alt="Quicrefil Logo" style="max-width: 150px; height: auto;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 20px 20px;">
                          <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${customerFullName},</h2>
                          <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Please fund the virtual account below to complete your ${type === "wallet_topup" ? "wallet top-up" : type} order.</p>
                          <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                            <tr>
                              <td style="color: #555555; font-size: 16px;">
                                <strong>Transaction Ref:</strong> ${transactionRef}<br>
                                <strong>Account Number:</strong> <span style="color: #e74c3c; font-size: 18px; font-weight: bold;">${paymentDetails.virtualAccount.accountNumber}</span><br>
                                <strong>Bank Name:</strong> ${paymentDetails.virtualAccount.bankName}<br>
                                <strong>Amount:</strong> ₦${paymentDetails.virtualAccount.amount}<br>
                                <strong>Narration:</strong> ${paymentDetails.virtualAccount.note || "N/A"}<br>
                              </td>
                            </tr>
                          </table>
                          <p style="color: #555555; font-size: 16px; margin: 0 0 15px;">Ensure you include the narration in your transfer.</p>
                          <p style="color: #555555; font-size: 16px; margin: 15px 0;"><strong>Total Amount:</strong> ₦${finalAmount.toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                          <p style="font-size: 14px; margin: 0 0 5px;">Best regards,<br><strong>The Quicrefil Support Team</strong></p>
                          <p style="font-size: 12px; margin: 0;">© 2025 Quicrefil. All rights reserved.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Virtual account email sent to ${customerEmail}`, { transactionRef });
      } catch (emailError: any) {
        logger.error("Failed to send virtual account email:", {
          message: emailError.message,
          userId,
          transactionRef,
        });
      }

      logger.info("Virtual Account Payment Initiated Successfully:", { paymentDetails });
      return {
        transactionId: transactionRef,
        paymentDetails,
        status: TransactionStatus.PENDING,
      };
    } catch (error: any) {
      logger.error("Virtual Account Payment Initiation Error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        userId,
        transactionRef,
      });
      throw new Error(`Virtual account payment initiation failed: ${error.message}`);
    }
  }

  private async handlePayOnDelivery(
    userId: string,
    transactionRef: string
  ): Promise<{
    transactionId: string;
    paymentDetails: { confirmationCode: string; paymentLink?: string; voucherCode?: string; voucherDiscount?: number };
    status: string;
  }> {
    try {
      logger.info(`Processing Pay on Delivery for transaction ${transactionRef}...`);

      const payment = await this.prisma.payment.findFirst({ where: { transactionRef } });
      if (!payment) throw new Error("Payment record not found.");
      const totalAmount = payment.amount;

      const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      const customerEmail = user.email || "fallback@example.com";
      const customerName = user.name || "Customer";

      const paymentDetails: {
        confirmationCode: string;
        paymentLink?: string;
        voucherCode?: string;
        voucherDiscount?: number;
      } = {
        confirmationCode,
        voucherCode:
          payment.paymentDetails && typeof payment.paymentDetails === "object"
            ? (payment.paymentDetails as any).voucherCode
            : undefined,
        voucherDiscount:
          payment.paymentDetails && typeof payment.paymentDetails === "object"
            ? (payment.paymentDetails as any).voucherDiscount
            : undefined,
      };

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: TransactionStatus.PENDING,
          paymentDetails,
        },
      });

      try {
        const mailOptions = {
          from: "Quicrefil <astralearnia@gmail.com>",
          to: customerEmail,
          subject: "Your Quicrefil Pay on Delivery Confirmation",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Your Quicrefil Pay on Delivery Confirmation</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <img src="https://via.placeholder.com/150x50?text=Quicrefil+Logo" alt="Quicrefil Logo" style="max-width: 150px; height: auto;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 20px 20px;">
                          <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${customerName},</h2>
                          <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Thank you for choosing Quicrefil! Your order is on its way.</p>
                          <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                            <tr>
                              <td style="padding: 10px; color: #555555; font-size: 16px;">
                                <strong>Transaction Ref:</strong> ${transactionRef}<br>
                                <strong>Confirmation Code:</strong> <span style="color: #e74c3c; font-size: 20px; font-weight: bold;">${confirmationCode}</span><br>
                                ${paymentDetails.voucherCode ? `<strong>Voucher Code:</strong> ${paymentDetails.voucherCode}<br>` : ""}
                                ${paymentDetails.voucherDiscount ? `<strong>Voucher Discount:</strong> ₦${paymentDetails.voucherDiscount.toFixed(2)}<br>` : ""}
                                <p style="margin: 10px 0;">Please provide this code to the delivery agent upon arrival.</p>
                              </td>
                            </tr>
                          </table>
                          <p style="color: #555555; font-size: 16px; margin: 15px 0;"><strong>Total Amount:</strong> ₦${totalAmount.toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                          <p style="font-size: 14px; margin: 0 0 5px;">Best regards,<br><strong>The Quicrefil Support Team</strong></p>
                          <p style="font-size: 12px; margin: 0;">© 2025 Quicrefil. All rights reserved.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Confirmation email sent to ${customerEmail}`);
      } catch (emailError: any) {
        logger.error("Failed to send confirmation email:", {
          message: emailError.message,
          userId,
          transactionRef,
        });
      }

      return { transactionId: transactionRef, paymentDetails, status: TransactionStatus.PENDING };
    } catch (error: any) {
      logger.error("Pay on Delivery Error:", {
        message: error.message,
        userId,
        transactionRef,
      });
      throw new Error(`Pay on delivery processing failed: ${error.message}`);
    }
  }

  async processPayment(
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
  ): Promise<{ transactionId: string; paymentDetails?: PaymentDetails; redirectUrl?: string; status: string }> {
    const ref = transactionRef || `TRX-${uuidv4()}-${Date.now()}`;
    let voucherDiscount = 0;

    try {
      logger.info(`Processing ${isWalletTopUp ? "wallet top-up" : productType || serviceType || "payment"}`, {
        userId,
        amount,
        paymentMethod,
        clientIp: clientIp || "not provided",
        isWalletTopUp,
        productType: productType || "none",
        serviceType: serviceType || "none",
        meterNumber: meterNumber || "none",
        voucherCode: voucherCode || "none",
      });

      // Validate inputs
      if (!/^[0-9a-fA-F-]{36}$/.test(userId)) throw new Error("Invalid user ID: must be a UUID");
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount: must be a positive number.");
      if (paymentMethod === PaymentMethod.WALLET) throw new Error("WALLET payment method is not supported");
      if (!(await this.isPaymentMethodEnabled(paymentMethod))) {
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
      const validServiceTypes = ["gas", "petrol", "diesel"];
      if (serviceType && !validServiceTypes.includes(serviceType) && serviceType !== "electricity") {
        throw new Error(`Invalid serviceType: ${serviceType}. Must be one of ${validServiceTypes.concat("electricity").join(", ")}`);
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

      // Validate and apply voucher
      let voucher: any = null;
      if (voucherCode && voucherContext) {
        const { discount, valid, voucher: validatedVoucher } = await this.validateVoucher(
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

      // Adjust amount after voucher discount
      const adjustedAmount = Math.max(0, amount - voucherDiscount);

      // Validate Monnify payment methods
      const monnifyMethods: PaymentMethod[] = [PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.VIRTUAL_ACCOUNT, PaymentMethod.MONNIFY];
      if (monnifyMethods.includes(paymentMethod)) {
        const gateway = await this.getPaymentGateway(paymentMethod);
        if (!gateway || gateway !== "monnify") {
          throw new Error(
            `Payment method ${paymentMethod} requires Monnify, but current gateway is ${gateway || "none"}`
          );
        }
      }

      const existingPayment = await this.prisma.payment.findFirst({ where: { transactionRef: ref } });
      if (existingPayment) {
        const paymentDetails: PaymentDetails | undefined =
          existingPayment.paymentDetails && typeof existingPayment.paymentDetails === "object"
            ? (existingPayment.paymentDetails as PaymentDetails)
            : undefined;
        return {
          transactionId: existingPayment.id,
          paymentDetails,
          status: existingPayment.status,
          redirectUrl: paymentDetails?.secure3dData?.redirectUrl,
        };
      }

      let providerId: number | undefined;
      if (monnifyMethods.includes(paymentMethod)) {
        const provider = await this.prisma.paymentProvider.findFirst({
          where: { name: { equals: "Monnify", mode: "insensitive" } },
        });
        if (!provider) throw new Error("Payment provider 'Monnify' not found.");
        providerId = provider.id;
      }

      const adminSettings = await this.prisma.adminSettings.findFirst();
      const defaultServiceCharge = adminSettings?.defaultServiceCharge ?? 0;
      const defaultTopupCharge = adminSettings?.defaultTopupCharge ?? 0;
      const defaultVatRate = adminSettings?.defaultVatRate ?? 0;

      const serviceFee = isWalletTopUp ? 0 : defaultServiceCharge;
      const topupCharge = isWalletTopUp ? defaultTopupCharge : 0;
      const vatRate = defaultVatRate;
      const vat = adjustedAmount * vatRate;
      const totalAmount = adjustedAmount + (isWalletTopUp ? topupCharge : serviceFee) + vat;

      const paymentDetails: PaymentDetails = {
        paymentType: productType || serviceType,
        baseAmount: amount,
        voucherCode: voucherCode || undefined,
        voucherDiscount: voucherDiscount || undefined,
        serviceFee: isWalletTopUp ? undefined : serviceFee,
        topupCharge: isWalletTopUp ? topupCharge : undefined,
        vat,
        totalAmount,
      };

      logger.debug("Payment details", {
        paymentType: productType || serviceType,
        paymentDetails,
        baseAmount: amount,
        voucherCode,
        voucherDiscount,
        serviceFee,
        topupCharge,
        vat,
        totalAmount,
      });

      const payment = await createPaymentRecord(
        userId,
        totalAmount,
        paymentMethod,
        TransactionStatus.PENDING,
        ref,
        productType,
        serviceType,
        providerId,
        meterNumber,
        amount
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paymentDetails },
      });

      logger.info("Payment record created", { transactionRef: ref, paymentId: payment.id });

      // Record voucher usage
      if (voucher && voucherDiscount > 0) {
        await this.prisma.voucherUsage.create({
          data: {
            voucherId: voucher.id,
            userId,
            usedAt: new Date(),
          },
        });
        await this.prisma.voucher.update({
          where: { id: voucher.id },
          data: { uses: { increment: 1 } },
        });
      }

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
            paymentMethod,
            productType,
            serviceType,
            meterNumber,
          },
        },
      });

      switch (paymentMethod) {
        case PaymentMethod.CARD:
          if (!cardDetails) throw new Error("Card details required for CARD payment");
          const cardResult = await this.cardProcessing.initiateCardCharge(
            ref,
            {
              number: cardDetails.cardno,
              pin: cardDetails.pin || "",
              expiryMonth: cardDetails.expirymonth,
              expiryYear: cardDetails.expiryyear,
              cvv: cardDetails.cvv,
            },
            {
              httpBrowserLanguage: cardDetails.httpBrowserLanguage || "en-US",
              httpBrowserJavaEnabled: cardDetails.httpBrowserJavaEnabled || false,
              httpBrowserJavaScriptEnabled: cardDetails.httpBrowserJavaScriptEnabled || true,
              httpBrowserColorDepth: cardDetails.httpBrowserColorDepth || 24,
              httpBrowserScreenHeight: cardDetails.httpBrowserScreenHeight || 1080,
              httpBrowserScreenWidth: cardDetails.httpBrowserScreenWidth || 1920,
              httpBrowserTimeDifference: cardDetails.httpBrowserTimeDifference || "+00:00",
              userAgentBrowserValue: cardDetails.userAgentBrowserValue || "Mozilla/5.0",
            }
          );
          return {
            transactionId: payment.id,
            paymentDetails: { ...paymentDetails, ...cardResult.paymentDetails },
            redirectUrl: cardResult.paymentDetails?.secure3dData?.redirectUrl,
            status: cardResult.status,
          };
        case PaymentMethod.TRANSFER:
          const bankTransferResult = await this.initiateBankTransferPayment(
            ref,
            totalAmount,
            userId,
            productType || serviceType || "product",
            clientIp
          );
          return {
            transactionId: payment.id,
            paymentDetails: { ...paymentDetails, ...bankTransferResult.paymentDetails },
            status: TransactionStatus.PENDING,
          };
        case PaymentMethod.VIRTUAL_ACCOUNT:
          const virtualAccountResult = await this.initiateTransferPayment(
            ref,
            totalAmount,
            userId,
            productType || serviceType || "product",
            clientIp
          );
          return {
            transactionId: payment.id,
            paymentDetails: { ...paymentDetails, ...virtualAccountResult.paymentDetails },
            status: TransactionStatus.PENDING,
          };
        case PaymentMethod.MONNIFY:
          const monnifyResult = await this.initiateMonnifyPayment(
            ref,
            totalAmount,
            userId,
            productType || serviceType || "product",
            clientIp
          );
          return {
            transactionId: payment.id,
            paymentDetails: { ...paymentDetails, ...monnifyResult.paymentDetails },
            status: TransactionStatus.PENDING,
          };
        case PaymentMethod.PAY_ON_DELIVERY:
          const podResult = await this.handlePayOnDelivery(userId, ref);
          return {
            transactionId: payment.id,
            paymentDetails: { ...paymentDetails, ...podResult.paymentDetails },
            status: TransactionStatus.PENDING,
          };
        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }
    } catch (error: any) {
      logger.error("Payment Processing Error", {
        message: error.message,
        userId,
        paymentMethod,
        productType,
        serviceType,
        isWalletTopUp,
        meterNumber,
        voucherCode,
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
          },
        },
      });

      throw new Error(error.message || "Payment initiation failed.");
    }
  }

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
      logger.info("Processing electricity bill payment", {
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
      if (!(await this.isPaymentMethodEnabled(paymentMethod))) {
        throw new Error(`Payment method ${paymentMethod} is currently disabled`);
      }

      // Validate and apply voucher
      let voucher: any = null;
      if (voucherCode) {
        const { discount, valid, voucher: validatedVoucher } = await this.validateVoucher(
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

      const adjustedAmount = Math.max(0, amount - voucherDiscount);

      // Validate Monnify payment methods
      const monnifyMethods: PaymentMethod[] = [PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.VIRTUAL_ACCOUNT, PaymentMethod.MONNIFY];
      let providerId: number | undefined;
      if (monnifyMethods.includes(paymentMethod)) {
        const gateway = await this.getPaymentGateway(paymentMethod);
        if (!gateway || gateway !== "monnify") {
          throw new Error(
            `Payment method ${paymentMethod} requires Monnify, but current gateway is ${gateway || "none"}`
          );
        }
        const provider = await this.prisma.paymentProvider.findFirst({
          where: { name: { equals: "Monnify", mode: "insensitive" } },
        });
        if (!provider) throw new Error("Payment provider 'Monnify' not found.");
        providerId = provider.id;
      }

      const adminSettings = await this.prisma.adminSettings.findFirst();
      const defaultServiceCharge = adminSettings?.defaultServiceCharge ?? 0;
      const defaultVatRate = adminSettings?.defaultVatRate ?? 0;

      const serviceFee = defaultServiceCharge;
      const vat = adjustedAmount * defaultVatRate;
      const totalAmount = adjustedAmount + serviceFee + vat;

      const paymentDetails: PaymentDetails = {
        paymentType: "electricity",
        baseAmount: amount,
        voucherCode: voucherCode || undefined,
        voucherDiscount: voucherDiscount || undefined,
        serviceFee,
        vat,
        totalAmount,
      };

      const payment = await createPaymentRecord(
        userId,
        totalAmount,
        paymentMethod,
        TransactionStatus.PENDING,
        ref,
        undefined,
        "electricity",
        providerId,
        meterNumber,
        amount
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { paymentDetails },
      });

      logger.info("Bill payment record created", { transactionRef: ref, paymentId: payment.id });

      // Record voucher usage
      if (voucher && voucherDiscount > 0) {
        await this.prisma.voucherUsage.create({
          data: {
            voucherId: voucher.id,
            userId,
            usedAt: new Date(),
          },
        });
        await this.prisma.voucher.update({
          where: { id: voucher.id },
          data: { uses: { increment: 1 } },
        });
      }

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
            paymentMethod,
            serviceType: "electricity",
            meterNumber,
            destinationBankCode,
            destinationAccountNumber,
          },
        },
      });

      let paymentResult: {
        transactionId: string;
        paymentDetails: PaymentDetails;
        status: string;
        redirectUrl?: string;
      };

      switch (paymentMethod) {
        case PaymentMethod.CARD:
          if (!cardDetails) throw new Error("Card details required for CARD payment");
          const cardResult = await this.cardProcessing.initiateCardCharge(
            ref,
            {
              number: cardDetails.cardno,
              pin: cardDetails.pin || "",
              expiryMonth: cardDetails.expirymonth,
              expiryYear: cardDetails.expiryyear,
              cvv: cardDetails.cvv,
            },
            {
              httpBrowserLanguage: cardDetails.httpBrowserLanguage || "en-US",
              httpBrowserJavaEnabled: cardDetails.httpBrowserJavaEnabled || false,
              httpBrowserJavaScriptEnabled: cardDetails.httpBrowserJavaScriptEnabled || true,
              httpBrowserColorDepth: cardDetails.httpBrowserColorDepth || 24,
              httpBrowserScreenHeight: cardDetails.httpBrowserScreenHeight || 1080,
              httpBrowserScreenWidth: cardDetails.httpBrowserScreenWidth || 1920,
              httpBrowserTimeDifference: cardDetails.httpBrowserTimeDifference || "+00:00",
              userAgentBrowserValue: cardDetails.userAgentBrowserValue || "Mozilla/5.0",
            }
          );
          paymentResult = {
            transactionId: payment.id,
            paymentDetails: { ...paymentDetails, ...cardResult.paymentDetails },
            redirectUrl: cardResult.paymentDetails?.secure3dData?.redirectUrl,
            status: cardResult.status,
          };
          break;
        case PaymentMethod.TRANSFER:
          paymentResult = await this.initiateBankTransferPayment(
            ref,
            totalAmount,
            userId,
            "electricity",
            clientIp
          );
          paymentResult.paymentDetails = { ...paymentDetails, ...paymentResult.paymentDetails };
          break;
        case PaymentMethod.VIRTUAL_ACCOUNT:
          paymentResult = await this.initiateTransferPayment(
            ref,
            totalAmount,
            userId,
            "electricity",
            clientIp
          );
          paymentResult.paymentDetails = { ...paymentDetails, ...paymentResult.paymentDetails };
          break;
        case PaymentMethod.MONNIFY:
          paymentResult = await this.initiateMonnifyPayment(
            ref,
            totalAmount,
            userId,
            "electricity",
            clientIp
          );
          paymentResult.paymentDetails = { ...paymentDetails, ...paymentResult.paymentDetails };
          break;
        default:
          throw new Error(`Unsupported payment method for bill payment: ${paymentMethod}`);
      }

      // If payment is successful or pending, proceed to Flutterwave disbursement
      if (
        paymentResult.status === TransactionStatus.PENDING ||
        paymentResult.status === TransactionStatus.COMPLETED
      ) {
        const flutterwaveResult = await this.initiateFlutterwaveDisbursement(
          ref,
          totalAmount,
          destinationBankCode,
          destinationAccountNumber,
          userId
        );

        paymentResult.paymentDetails.electricityToken = flutterwaveResult.electricityToken;

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymentDetails: paymentResult.paymentDetails,
            status: flutterwaveResult.status,
          },
        });

        // Send email with token
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("User not found");
        const customerEmail = user.email || "fallback@example.com";
        const customerName = user.name || "Customer";

        try {
          await transporter.sendMail({
            from: "Quicrefil <astralearnia@gmail.com>",
            to: customerEmail,
            subject: "Your Quicrefil Electricity Bill Payment Token",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <title>Your Electricity Bill Payment Token</title>
              </head>
              <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
                  <tr>
                    <td align="center">
                      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <tr>
                          <td style="padding: 20px; text-align: center;">
                            <img src="https://via.placeholder.com/150x50?text=Quicrefil+Logo" alt="Quicrefil Logo" style="max-width: 150px; height: auto;" />
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 20px 20px;">
                            <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${customerName},</h2>
                            <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Your electricity bill payment has been processed successfully.</p>
                            <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                              <tr>
                                <td style="color: #555555; font-size: 16px;">
                                  <strong>Transaction Ref:</strong> ${ref}<br>
                                  <strong>Meter Number:</strong> ${meterNumber}<br>
                                  <strong>Amount Paid:</strong> ₦${totalAmount.toFixed(2)}<br>
                                  <strong>Electricity Token:</strong> <span style="color: #e74c3c; font-size: 18px; font-weight: bold;">${flutterwaveResult.electricityToken}</span><br>
                                  ${voucherCode ? `<strong>Voucher Code:</strong> ${voucherCode}<br>` : ""}
                                  ${voucherDiscount ? `<strong>Voucher Discount:</strong> ₦${voucherDiscount.toFixed(2)}<br>` : ""}
                                </td>
                              </tr>
                            </table>
                            <p style="color: #555555; font-size: 16px; margin: 0 0 15px;">Please use this token to recharge your meter.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                            <p style="font-size: 14px; margin: 0 0 5px;">Best regards,<br><strong>The Quicrefil Support Team</strong></p>
                            <p style="font-size: 12px; margin: 0;">© 2025 Quicrefil. All rights reserved.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `,
          });
          logger.info(`Electricity token email sent to ${customerEmail}`, { transactionRef: ref });
        } catch (emailError: any) {
          logger.error("Failed to send electricity token email", {
            message: emailError.message,
            userId,
            transactionRef: ref,
          });
        }
      }

      return {
        transactionId: payment.id,
        paymentDetails: paymentResult.paymentDetails,
        redirectUrl: paymentResult.redirectUrl,
        status: paymentResult.status,
        electricityToken: paymentResult.paymentDetails.electricityToken,
      };
    } catch (error: any) {
      logger.error("Bill Payment Processing Error", {
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

      throw new Error(error.message || "Bill payment initiation failed.");
    }
  }

  private async initiateFlutterwaveDisbursement(
    transactionRef: string,
    amount: number,
    destinationBankCode: string,
    destinationAccountNumber: string,
    userId: string
  ): Promise<{ status: string; electricityToken: string }> {
    try {
      const token = await this.getFlutterwaveAuthToken();
      const narration = `Electricity Bill Payment - ${transactionRef}`;
      const payload = {
        amount,
        reference: transactionRef,
        narration,
        destinationBankCode,
        destinationAccountNumber,
        currency: "NGN",
        sourceAccountNumber: process.env.FLUTTERWAVE_SOURCE_ACCOUNT,
        async: false,
      };

      logger.info("Flutterwave Disbursement Payload", { payload });

      const response = await axios.post<FlutterwaveDisbursementResponse>(
        `${this.flutterwaveBaseUrl}/api/v2/disbursements/single`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "CustomerService/1.0",
          },
          timeout: 15000,
        }
      );

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Flutterwave disbursement failed: ${response.data.responseMessage}`);
      }

      const { status, destinationAccountName } = response.data.responseBody;

      // Simulate token generation (replace with actual integration if available)
      const electricityToken = `TOKEN-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      logger.info("Flutterwave Disbursement Successful", {
        transactionRef,
        amount,
        status,
        destinationAccountName,
        electricityToken,
      });

      return {
        status: status === "SUCCESS" ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
        electricityToken,
      };
    } catch (error: any) {
      logger.error("Flutterwave Disbursement Error", {
        message: error.message,
        transactionRef,
        response: error.response?.data,
      });
      throw new Error(`Flutterwave disbursement failed: ${error.message}`);
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

    const result = await this.cardProcessing.validateCardPayment(transactionRef, paymentReference, tokenId, token);

    // Ensure paymentDetails is an object or initialize as empty object
    const existingDetails: PaymentDetails =
      payment.paymentDetails && typeof payment.paymentDetails === "object"
        ? (payment.paymentDetails as PaymentDetails)
        : {};

    // Update payment status based on card validation result
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        paymentDetails: {
          ...existingDetails,
          transactionStatus: result.status,
        },
      },
    });

    // Log successful validation
    await this.prisma.auditLog.create({
      data: {
        id: uuidv4(),
        userId: payment.userId,
        action: "CARD_OTP_AUTHORIZATION_SUCCESS",
        entityType: "Payment",
        entityId: payment.id,
        details: {
          transactionRef,
          paymentReference,
          status: result.status,
        },
      },
    });

    logger.info("Card payment validated successfully", { transactionRef, paymentReference, status: result.status });

    return {
      transactionId: payment.id,
      status: result.status,
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
    cardno: string;
    cvv: string;
    expirymonth: string;
    expiryyear: string;
    pin?: string;
  }
): Promise<{ transactionId: string; status: string; paymentDetails?: PaymentDetails }> {
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

    const result = await this.cardProcessing.authorize3DSCardPayment(transactionRef, paymentReference, {
      number: cardDetails.cardno,
      pin: cardDetails.pin || "",
      expiryMonth: cardDetails.expirymonth,
      expiryYear: cardDetails.expiryyear,
      cvv: cardDetails.cvv,
    });

    // Ensure paymentDetails is an object or initialize as empty object
    const existingDetails: PaymentDetails =
      payment.paymentDetails && typeof payment.paymentDetails === "object"
        ? (payment.paymentDetails as PaymentDetails)
        : {};

    // Ensure result.paymentDetails is an object or initialize as empty object
    const newDetails: PaymentDetails =
      result.paymentDetails && typeof result.paymentDetails === "object" ? result.paymentDetails : {};

    // Update payment with new details and status
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        paymentDetails: {
          ...existingDetails,
          ...newDetails,
          transactionStatus: result.status,
        },
      },
    });

    // Log successful 3DS authorization
    await this.prisma.auditLog.create({
      data: {
        id: uuidv4(),
        userId: payment.userId,
        action: "CARD_3DS_AUTHORIZATION_SUCCESS",
        entityType: "Payment",
        entityId: payment.id,
        details: {
          transactionRef,
          paymentReference: paymentReference || payment.monnifyRef || "unknown",
          status: result.status,
        },
      },
    });

    logger.info("3DS card payment authorized successfully", {
      transactionRef,
      paymentReference: paymentReference || payment.monnifyRef,
      status: result.status,
    });

    return {
      transactionId: payment.id,
      status: result.status,
      paymentDetails: {
        ...existingDetails,
        ...newDetails,
        transactionStatus: result.status,
      },
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

export default MonnifyPaymentInitiation;