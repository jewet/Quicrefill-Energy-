// File: PaymentManagement.ts
import { v4 as uuidv4 } from "uuid";
import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import { PrismaClient, PaymentMethod, TransactionStatus } from "@prisma/client";
import nodemailer from "nodemailer";
import winston from "winston";

dotenv.config();

// Validate environment variables
const requiredEnvVars = [
  "MONNIFY_API_KEY",
  "MONNIFY_SECRET_KEY",
  "MONNIFY_CONTRACT_CODE",
  "EMAIL_USER",
  "EMAIL_PASS",
  "SERVER_URL",
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing ${envVar} in environment`);
    throw new Error(`${envVar} configuration missing`);
  }
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

// Define paymentDetails interface to align with PaymentService.ts and CardProcessing.ts
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
  authorization?: any;
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
  refundReference?: string;
  refundStatus?: string;
}

// Define Monnify-specific response interfaces
interface MonnifyRefundResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    refundReference: string;
    transactionReference: string;
    amount: number;
    status: string;
  };
}

interface BVNVerificationResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    bvn: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phoneNumber: string;
    status: string;
    bankName?: string;
    accountNumber?: string;
  };
}

// Utility function for sending emails with retry
async function sendEmailWithRetry(
  mailOptions: nodemailer.SendMailOptions,
  retries: number = 3,
  delay: number = 1000
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully`, { recipient: mailOptions.to, attempt });
      return;
    } catch (error: any) {
      logger.warn(`Email sending attempt ${attempt} failed`, {
        recipient: mailOptions.to,
        error: error.message,
      });
      if (attempt === retries) {
        throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

class PaymentManagement {
  private prisma: PrismaClient;
  private readonly axiosTimeout: number;
  private readonly baseUrl: string = "https://api.monnify.com";

  constructor() {
    this.prisma = new PrismaClient();
    this.axiosTimeout = parseInt(process.env.AXIOS_TIMEOUT || "10000", 10);
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
          timeout: this.axiosTimeout,
        }
      );
      return response.data.responseBody.accessToken;
    } catch (error: any) {
      const errorMessage = error instanceof AxiosError
        ? `Monnify auth failed: ${error.response?.status} - ${error.response?.data?.responseMessage || error.message}`
        : `Monnify auth error: ${error.message}`;
      logger.error(errorMessage, { stack: error.stack });
      throw new Error(errorMessage);
    }
  }

  async processRefund(
    transactionRef: string,
    userId: string,
    amount: number,
    paymentReference?: string
  ): Promise<void> {
    if (!transactionRef || !userId || amount <= 0 || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      throw new Error("Invalid input: transactionRef, userId (UUID), and positive amount are required");
    }

    let payment = null;
    try {
      logger.info(`Initiating refund for transaction: ${transactionRef}`, {
        userId,
        amount,
        paymentReference,
      });

      payment = await this.prisma.payment.findFirst({
        where: { transactionRef },
        include: { provider: true },
      });
      if (!payment) {
        throw new Error(`Payment not found for transaction: ${transactionRef}`);
      }
      if (payment.status !== TransactionStatus.FAILED && payment.status !== TransactionStatus.CANCELLED) {
        throw new Error(`Cannot refund transaction ${transactionRef}: status is ${payment.status}`);
      }
      if (!payment.provider || payment.provider.name.toLowerCase() !== "monnify") {
        throw new Error("Refunds only supported for Monnify payments");
      }

      const resolvedPaymentReference = paymentReference || payment.monnifyRef;
      if (!resolvedPaymentReference) {
        throw new Error(`Monnify payment reference missing for transaction: ${transactionRef}`);
      }

      const token = await this.getMonnifyAuthToken();
      const refundPayload = {
        transactionReference: resolvedPaymentReference,
        refundAmount: amount,
        refundReference: `REF-${uuidv4()}`,
        narration: `Refund for transaction ${transactionRef}`,
      };

      const response = await axios.post<MonnifyRefundResponse>(
        `${this.baseUrl}/api/v1/refunds/initiate`,
        refundPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: this.axiosTimeout,
        }
      );

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`Refund initiation failed: ${response.data.responseMessage}`);
      }

      // Ensure paymentDetails is an object before spreading
      const existingPaymentDetails =
        (payment.paymentDetails as paymentDetails | undefined) || {};

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: TransactionStatus.REFUND, // Use REFUND as PENDING_REFUND is not in enum
            paymentDetails: {
              ...existingPaymentDetails,
              refundReference: response.data.responseBody.refundReference,
              refundStatus: response.data.responseBody.status,
            },
            updatedAt: new Date(),
          },
        }),
        this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId,
            action: "REFUND_INITIATED",
            entityType: "Payment",
            entityId: payment.id,
            details: {
              transactionRef,
              paymentReference: resolvedPaymentReference,
              amount,
              refundReference: response.data.responseBody.refundReference,
              refundStatus: response.data.responseBody.status,
            },
            createdAt: new Date(),
          },
        }),
      ]);

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.email) {
        const mailOptions = {
          from: "Quicrefil <astralearnia@gmail.com>",
          to: user.email,
          subject: "Quicrefil Payment Refund Confirmation",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Quicrefil Refund Confirmation</title>
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
                          <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${user.name || "Customer"},</h2>
                          <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">We have initiated a refund for your payment.</p>
                          <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                            <tr>
                              <td style="padding: 10px; color: #555555; font-size: 16px;">
                                <strong>Transaction Ref:</strong> ${transactionRef}<br>
                                <strong>Amount:</strong> ₦${amount.toFixed(2)}<br>
                                <strong>Refund Reference:</strong> ${response.data.responseBody.refundReference}<br>
                                <strong>Status:</strong> ${response.data.responseBody.status}<br>
                              </td>
                            </tr>
                          </table>
                          <p style="color: #555555; font-size: 16px; margin: 0 0 15px;">The refund will be processed to your original payment method within 5-7 business days.</p>
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
        await sendEmailWithRetry(mailOptions);
        logger.info(`Refund confirmation email sent to ${user.email}`, { transactionRef });
      }

      logger.info(`Refund initiated successfully for transaction: ${transactionRef}`, {
        refundReference: response.data.responseBody.refundReference,
        status: response.data.responseBody.status,
      });
    } catch (error: any) {
      const errorMessage = error instanceof AxiosError
        ? `Refund failed: ${error.response?.status} - ${error.response?.data?.responseMessage || error.message}`
        : `Refund error: ${error.message}`;
      logger.error(errorMessage, {
        transactionRef,
        userId,
        amount,
        stack: error.stack,
        response: error.response?.data,
      });

      if (payment) {
        await this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId,
            action: "REFUND_FAILED",
            entityType: "Payment",
            entityId: payment.id,
            details: {
              error: errorMessage,
              transactionRef,
              amount,
              response: error.response?.data,
            },
            createdAt: new Date(),
          },
        });
      }

      throw new Error(errorMessage);
    }
  }

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
    if (
      !userId ||
      !bvn ||
      !bankName ||
      !accountNumber ||
      !transactionRef ||
      !/^[0-9a-fA-F-]{36}$/.test(userId) ||
      !/^\d{11}$/.test(bvn) ||
      !/^\d{10}$/.test(accountNumber)
    ) {
      throw new Error("Invalid input: userId (UUID), bvn (11 digits), bankName, accountNumber (10 digits), and transactionRef are required");
    }

    try {
      logger.info(`Initiating BVN verification for user ${userId}`, {
        transactionRef,
        bankName,
        accountNumber: `****${accountNumber.slice(-4)}`,
      });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User not found");
      if (!user.email || !user.firstName || !user.lastName) {
        throw new Error("User missing required details: email, firstName, and lastName must be set");
      }

      const verification = await this.prisma.bVNVerification.create({
        data: {
          id: uuidv4(),
          userId,
          transactionRef,
          bvn: `****${bvn.slice(-4)}`, // Store masked BVN
          bankName,
          accountNumber,
          status: "PENDING",
          createdAt: new Date(),
        },
      });

      const token = await this.getMonnifyAuthToken();
      const response = await axios.post<BVNVerificationResponse>(
        `${this.baseUrl}/api/v1/vas/bvn-details`,
        { bvn },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "CustomerService/1.0",
          },
          timeout: this.axiosTimeout,
        }
      );

      if (!response.data.requestSuccessful || response.data.responseCode !== "0") {
        throw new Error(`BVN verification failed: ${response.data.responseMessage || "Unknown error"}`);
      }

      const verificationResponse = response.data;
      if (
        verificationResponse.responseBody.firstName.toLowerCase() !== user.firstName.toLowerCase() ||
        verificationResponse.responseBody.lastName.toLowerCase() !== user.lastName.toLowerCase()
      ) {
        await this.prisma.$transaction([
          this.prisma.bVNVerification.update({
            where: { id: verification.id },
            data: {
              status: "FAILED",
              responseDetails: { message: "BVN name mismatch" },
            },
          }),
          this.prisma.auditLog.create({
            data: {
              id: uuidv4(),
              userId,
              action: "BVN_VERIFICATION_FAILED",
              entityType: "BVNVerification",
              entityId: verification.id,
              details: {
                error: "BVN name mismatch",
                bvnDetails: {
                  ...verificationResponse.responseBody,
                  bvn: `****${verificationResponse.responseBody.bvn.slice(-4)}`,
                },
                userDetails: {
                  firstName: user.firstName,
                  lastName: user.lastName,
                },
              },
              createdAt: new Date(),
            },
          }),
        ]);
        throw new Error("BVN name does not match user details");
      }

      let bankAccountLinked = false;
      if (
        verificationResponse.responseBody.bankName &&
        verificationResponse.responseBody.accountNumber &&
        verificationResponse.responseBody.bankName.toLowerCase() === bankName.toLowerCase() &&
        verificationResponse.responseBody.accountNumber === accountNumber
      ) {
        bankAccountLinked = true;
      }

      const existingBankCard = await this.prisma.bankCard.findFirst({
        where: {
          userId,
          accountNumber,
          bankName,
        },
      });

      await this.prisma.$transaction([
        this.prisma.bVNVerification.update({
          where: { id: verification.id },
          data: {
            status: "COMPLETED",
            responseDetails: {
              ...verificationResponse.responseBody,
              bvn: `****${verificationResponse.responseBody.bvn.slice(-4)}`,
            },
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: {
            bvnVerified: true,
          },
        }),
        existingBankCard
          ? this.prisma.bankCard.update({
              where: { id: existingBankCard.id },
              data: {
                bankName,
                accountNumber,
                isValidated: true,
                updatedAt: new Date(),
              },
            })
          : this.prisma.bankCard.create({
              data: {
                id: uuidv4(),
                userId,
                bankName,
                accountNumber,
                cardLast4: accountNumber.slice(-4),
                cardType: "BANK_ACCOUNT",
                expiryDate: "N/A", // Use string "N/A" to satisfy Prisma schema
                isValidated: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }),
        this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId,
            action: "BVN_VERIFIED",
            entityType: "BVNVerification",
            entityId: verification.id,
            details: {
              transactionRef,
              bvn: `****${bvn.slice(-4)}`,
              bankName,
              accountNumber: `****${accountNumber.slice(-4)}`,
              bankAccountLinked,
            },
            createdAt: new Date(),
          },
        }),
      ]);

      const mailOptions = {
        from: "Quicrefil <astralearnia@gmail.com>",
        to: user.email,
        subject: "Quicrefil BVN Verification Confirmation",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Quicrefil BVN Verification Confirmation</title>
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
                        <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${user.name || "Customer"},</h2>
                        <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Your BVN verification has been successfully completed.</p>
                        <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                          <tr>
                            <td style="color: #555555; font-size: 16px;">
                              <strong>Transaction Ref:</strong> ${transactionRef}<br>
                              <strong>Bank Name:</strong> ${bankName}<br>
                              <strong>Account Number:</strong> ****${accountNumber.slice(-4)}<br>
                              <strong>Status:</strong> COMPLETED<br>
                              <strong>Bank Account Linked:</strong> ${bankAccountLinked ? "Yes" : "No"}<br>
                            </td>
                          </tr>
                        </table>
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
      await sendEmailWithRetry(mailOptions);
      logger.info(`BVN verification email sent to ${user.email}`, { transactionRef });

      return {
        transactionId: transactionRef,
        status: "COMPLETED",
        verificationDetails: {
          ...verificationResponse.responseBody,
          bvn: `****${verificationResponse.responseBody.bvn.slice(-4)}`,
        },
        bankAccountLinked,
      };
    } catch (error: any) {
      const errorMessage = error instanceof AxiosError
        ? `BVN verification failed: ${error.response?.status} - ${error.response?.data?.responseMessage || error.message}`
        : `BVN verification error: ${error.message}`;
      logger.error(errorMessage, {
        userId,
        transactionRef,
        bankName,
        accountNumber: `****${accountNumber.slice(-4)}`,
        stack: error.stack,
      });

      const verification = await this.prisma.bVNVerification.findFirst({
        where: { transactionRef },
      });

      if (verification) {
        await this.prisma.$transaction([
          this.prisma.bVNVerification.update({
            where: { id: verification.id },
            data: {
              status: "FAILED",
              responseDetails: { message: errorMessage },
            },
          }),
          this.prisma.auditLog.create({
            data: {
              id: uuidv4(),
              userId,
              action: "BVN_VERIFICATION_FAILED",
              entityType: "BVNVerification",
              entityId: verification.id,
              details: {
                error: errorMessage,
                transactionRef,
                bankName,
                accountNumber: `****${accountNumber.slice(-4)}`,
              },
              createdAt: new Date(),
            },
          }),
        ]);
      }

      return {
        transactionId: transactionRef,
        status: "FAILED",
        verificationDetails: { message: errorMessage },
        bankAccountLinked: false,
      };
    }
  }

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
    const { page = 1, limit = 10, startDate, endDate, status, paymentMethod } = options;

    if (!/^[0-9a-fA-F-]{36}$/.test(userId)) {
      throw new Error("Invalid user ID: must be a UUID");
    }
    if (page < 1) throw new Error("Page must be greater than 0");
    if (limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100");

    try {
      logger.info(`Fetching transaction history for user ${userId}`, { options });

      const where: any = { userId };
      if (startDate) where.createdAt = { gte: startDate };
      if (endDate) {
        where.createdAt = where.createdAt || {};
        where.createdAt.lte = endDate;
      }
      if (status) where.status = status;
      if (paymentMethod) where.paymentMethod = paymentMethod;

      const [transactions, total] = await this.prisma.$transaction([
        this.prisma.payment.findMany({
          where,
          include: {
            provider: true,
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
      ]);

      logger.info(`Retrieved ${transactions.length} transactions for user ${userId}`, {
        total,
        page,
        limit,
      });

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          transactionRef: t.transactionRef,
          amount: t.amount,
          status: t.status,
          paymentMethod: t.paymentMethod,
          productType: t.productType,
          serviceType: t.serviceType,
          provider: t.provider?.name || null,
          paymentDetails: t.paymentDetails as paymentDetails | undefined,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error("Transaction History Retrieval Error:", {
        message: error.message,
        userId,
        options,
        stack: error.stack,
      });
      throw new Error(`Failed to retrieve transaction history: ${error.message}`);
    }
  }

  async cancelPayment(transactionRef: string, userId: string): Promise<void> {
    if (!transactionRef || !userId || !/^[0-9a-fA-F-]{36}$/.test(userId)) {
      throw new Error("Invalid input: transactionRef and userId (UUID) are required");
    }

    let payment = null;
    try {
      logger.info(`Attempting to cancel payment for transaction: ${transactionRef}`, { userId });

      payment = await this.prisma.payment.findFirst({
        where: { transactionRef, userId },
      });
      if (!payment) {
        throw new Error(`Payment not found for transaction: ${transactionRef}`);
      }
      if (
        payment.status !== TransactionStatus.PENDING &&
        payment.status !== TransactionStatus.PENDING_DELIVERY &&
        payment.status !== TransactionStatus.PENDING_MANUAL
      ) {
        throw new Error(`Cannot cancel payment in ${payment.status} status`);
      }

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: TransactionStatus.CANCELLED,
            updatedAt: new Date(),
          },
        }),
        this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId,
            action: "PAYMENT_CANCELLED",
            entityType: "Payment",
            entityId: payment.id,
            details: {
              transactionRef,
              previousStatus: payment.status,
            },
            createdAt: new Date(),
          },
        }),
      ]);

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.email) {
        const mailOptions = {
          from: "Quicrefil <astralearnia@gmail.com>",
          to: user.email,
          subject: "Quicrefil Payment Cancellation Confirmation",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Quicrefil Payment Cancellation</title>
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
                          <h2 style="color: #2c3e50; font-size: 24px; margin: 0 0 10px;">Hello ${user.name || "Customer"},</h2>
                          <p style="color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;">Your payment has been successfully cancelled.</p>
                          <table width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;">
                            <tr>
                              <td style="color: #555555; font-size: 16px;">
                                <strong>Transaction Ref:</strong> ${transactionRef}<br>
                                <strong>Amount:</strong> ₦${payment.amount.toFixed(2)}<br>
                                <strong>Status:</strong> CANCELLED<br>
                              </td>
                            </tr>
                          </table>
                          <p style="color: #555555; font-size: 16px; margin: 0 0 15px;">If you have any questions, please contact our support team.</p>
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
        await sendEmailWithRetry(mailOptions);
        logger.info(`Cancellation confirmation email sent to ${user.email}`, { transactionRef });
      }

      logger.info(`Payment cancelled successfully for transaction: ${transactionRef}`);
    } catch (error: any) {
      logger.error("Payment Cancellation Error:", {
        message: error.message,
        transactionRef,
        userId,
        stack: error.stack,
      });

      if (payment) {
        await this.prisma.auditLog.create({
          data: {
            id: uuidv4(),
            userId,
            action: "PAYMENT_CANCELLATION_FAILED",
            entityType: "Payment",
            entityId: payment.id,
            details: {
              error: error.message,
              transactionRef,
            },
            createdAt: new Date(),
          },
        });
      }

      throw new Error(`Failed to cancel payment: ${error.message}`);
    }
  }

  public async checkPaymentMethodStatus(
    paymentMethod: PaymentMethod
  ): Promise<{
    paymentMethod: string;
    isEnabled: boolean;
    gateway: string | null;
    lastUpdated: Date | null;
    updatedBy: string | null;
  }> {
    try {
      logger.info(`Checking PaymentConfig status for payment method: ${paymentMethod}`);

      const config = await this.prisma.paymentConfig.findUnique({
        where: { paymentMethod },
      });

      if (!config) {
        logger.warn(`No PaymentConfig entry found for ${paymentMethod}. Defaulting to disabled.`);
        return {
          paymentMethod,
          isEnabled: false,
          gateway: null,
          lastUpdated: null,
          updatedBy: null,
        };
      }

      logger.info(`PaymentConfig status for ${paymentMethod}:`, {
        isEnabled: config.isEnabled,
        gateway: config.gateway,
        lastUpdated: config.updatedAt,
        updatedBy: config.updatedBy,
      });

      const validMonnifyMethods: PaymentMethod[] = ["CARD", "TRANSFER", "VIRTUAL_ACCOUNT"];
      if (validMonnifyMethods.includes(paymentMethod) && config.gateway?.toLowerCase() !== "monnify") {
        logger.warn(`Payment method ${paymentMethod} is configured with incorrect gateway: ${config.gateway}`);
        return {
          paymentMethod: config.paymentMethod,
          isEnabled: false,
          gateway: config.gateway,
          lastUpdated: config.updatedAt,
          updatedBy: config.updatedBy,
        };
      }

      return {
        paymentMethod: config.paymentMethod,
        isEnabled: config.isEnabled,
        gateway: config.gateway,
        lastUpdated: config.updatedAt,
        updatedBy: config.updatedBy,
      };
    } catch (error: any) {
      logger.error(`Error checking PaymentConfig status for ${paymentMethod}:`, {
        message: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to check payment method status: ${error.message}`);
    }
  }
}

export default PaymentManagement;