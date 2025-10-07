import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ElectricityService } from "../services/electricityService";
import { UnprocessableEntity } from "../exceptions/validation";
import { AppErrorCode } from "../exceptions/root";
import { AuthUser } from "../middlewares/authentication";
import { PaymentMethod } from "@prisma/client";
import winston from "winston";

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

// Instantiate ElectricityService
const electricityService = new ElectricityService();

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Schema for validating payment method
const isValidPaymentMethod = (method: string): method is PaymentMethod => {
  return Object.values(PaymentMethod).includes(method as PaymentMethod);
};

// GetElectricityBillers controller
export const GetElectricityBillers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const schema = z.object({
      location: z.string().optional(),
    });
    const { location } = await schema.parseAsync(req.query).catch((err: z.ZodError) => {
      throw new UnprocessableEntity("Invalid query format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });

    const billers = await electricityService.getElectricityBillers(location);
    logger.info("Fetched electricity billers", { location, count: billers.length });
    res.status(200).json({
      success: true,
      data: { electricityBillersList: billers },
    });
  } catch (error: unknown) {
    logger.error("Error fetching electricity billers", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: req.ip,
      location: req.query.location,
    });
    next(error);
  }
};

// GetMeterInfo controller
export const GetMeterInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const schema = z.object({
      billerCode: z.string().min(1, "Biller code is required"),
      meterNumber: z.string().min(1, "Meter number is required"),
      meterType: z.enum(["prepaid", "postpaid"]).default("prepaid"),
    });
    const { billerCode, meterNumber, meterType } = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });

    const meterInfo = await electricityService.getMeterInfo(billerCode, meterNumber, meterType);
    logger.info("Fetched meter info", { billerCode, meterNumber });
    res.status(200).json({
      success: true,
      data: { meterInfo },
    });
  } catch (error: unknown) {
    logger.error("Error fetching meter info", {
      error: error instanceof Error ? error.message : "Unknown error",
      billerCode: req.body.billerCode,
      meterNumber: req.body.meterNumber,
      ip: req.ip,
    });
    next(error);
  }
};

// GetSavedMeterNumbers controller
export const GetSavedMeterNumbers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnprocessableEntity("User not authenticated", AppErrorCode.UNAUTHORIZED, []);
    }
    const userId = req.user.id;

    const savedMeterNumbers = await electricityService.getSavedMeterNumbers(userId);
    logger.info("Fetched saved meter numbers", { userId, count: savedMeterNumbers.length });
    res.status(200).json({
      success: true,
      data: { savedMeterNumbers },
    });
  } catch (error: unknown) {
    logger.error("Error fetching saved meter numbers", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id || "unknown",
      ip: req.ip,
    });
    next(error);
  }
};

// CreateElectricityOrder controller
export const CreateElectricityOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnprocessableEntity("User not authenticated", AppErrorCode.UNAUTHORIZED, []);
    }
    if (req.user.role !== "CUSTOMER") {
      throw new UnprocessableEntity("Only customers can create orders", AppErrorCode.UNAUTHORIZED, []);
    }
    const userId = req.user.id;

    const schema = z.object({
      billerCode: z.string().min(1, "Biller code is required"),
      meterNumber: z.string().min(1, "Meter number is required"),
      paymentAmount: z.number().positive("Payment amount must be positive"),
      paymentMethod: z.enum([PaymentMethod.CARD, PaymentMethod.WALLET, PaymentMethod.TRANSFER]).refine(isValidPaymentMethod, {
        message: "Invalid payment method",
      }),
      meterType: z.enum(["prepaid", "postpaid"]).default("prepaid"),
    });
    const { billerCode, meterNumber, paymentAmount, paymentMethod, meterType } = await schema.parseAsync(req.body).catch(
      (err: z.ZodError) => {
        throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
      }
    );

    const order = await electricityService.createElectricityOrder(
      userId,
      billerCode,
      meterNumber,
      paymentAmount,
      paymentMethod,
      meterType
    );

    logger.info("Created electricity order", { userId, orderId: order.id, billerCode, meterNumber });

    if (paymentMethod === PaymentMethod.WALLET) {
      try {
        const paymentResult = await electricityService.processPayment(userId, order.id, paymentMethod, order.paymentJwt!);
        logger.info("Processed wallet payment", { userId, orderId: order.id });
        res.status(paymentResult.success ? 200 : 400).json({
          success: paymentResult.success,
          data: { order, paymentJwt: order.paymentJwt, paymentResult },
        });
      } catch (paymentError: any) {
        logger.error("Error processing wallet payment", {
          error: paymentError.message,
          userId,
          orderId: order.id,
          ip: req.ip,
        });
        res.status(400).json({
          success: false,
          error:
            paymentError.code === "INSUFFICIENT_SOURCE_BALANCE"
              ? "Insufficient merchant balance for payment"
              : paymentError.code === "FLUTTERWAVE_FEE_FETCH_AXIOS_ERROR"
              ? "Failed to fetch payment fees"
              : paymentError.message || "Failed to process payment",
          data: { order, paymentJwt: order.paymentJwt },
        });
        return;
      }
    } else {
      res.status(201).json({
        success: true,
        data: { order, paymentJwt: order.paymentJwt },
      });
    }
  } catch (error: unknown) {
    logger.error("Error creating electricity order", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id || "unknown",
      requestData: req.body,
      ip: req.ip,
    });
    next(error);
  }
};

// ProcessPayment controller
export const ProcessPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnprocessableEntity("User not authenticated", AppErrorCode.UNAUTHORIZED, []);
    }
    if (req.user.role !== "CUSTOMER") {
      throw new UnprocessableEntity("Only customers can process payments", AppErrorCode.UNAUTHORIZED, []);
    }
    const userId = req.user.id;

    const schema = z.object({
      orderId: z.string().min(1, "Order ID is required"),
      paymentMethod: z.enum([PaymentMethod.CARD, PaymentMethod.WALLET, PaymentMethod.TRANSFER]).refine(isValidPaymentMethod, {
        message: "Invalid payment method",
      }),
      paymentJwt: z.string().min(1, "Payment JWT is required"),
    });
    const { orderId, paymentMethod, paymentJwt } = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });

    // Map CARD to MONNIFY for Flutterwave payments
    const mappedPaymentMethod = paymentMethod === PaymentMethod.CARD ? PaymentMethod.MONNIFY : paymentMethod;

    const result = await electricityService.processPayment(userId, orderId, mappedPaymentMethod, paymentJwt);
    logger.info("Processed payment", { userId, orderId, paymentMethod: mappedPaymentMethod });
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
    });
  } catch (error: unknown) {
    logger.error("Error processing payment", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id || "unknown",
      orderId: req.body.orderId,
      paymentMethod: req.body.paymentMethod,
      ip: req.ip,
    });
    next(error);
  }
};

// VerifyPayment controller
export const VerifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const schema = z.object({
      orderId: z.string().min(1, "Order ID is required"),
      transactionRef: z.string().min(1, "Transaction reference is required"),
    });
    const { orderId, transactionRef } = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });

    const result = await electricityService.verifyPayment(orderId, transactionRef);
    logger.info("Verified payment", { orderId, transactionRef, success: result.success });
    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
    });
  } catch (error: unknown) {
    logger.error("Error verifying payment", {
      error: error instanceof Error ? error.message : "Unknown error",
      orderId: req.body.orderId,
      transactionRef: req.body.transactionRef,
      ip: req.ip,
    });
    next(error);
  }
};

// RegeneratePaymentJwt controller
export const RegeneratePaymentJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnprocessableEntity("User not authenticated", AppErrorCode.UNAUTHORIZED, []);
    }
    if (req.user.role !== "CUSTOMER") {
      throw new UnprocessableEntity("Only customers can regenerate payment JWT", AppErrorCode.UNAUTHORIZED, []);
    }
    const userId = req.user.id;

    const schema = z.object({
      orderId: z.string().min(1, "Order ID is required"),
    });
    const { orderId } = await schema.parseAsync(req.body).catch((err: z.ZodError) => {
      throw new UnprocessableEntity("Invalid input format", AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
    });

    const newJwt = await electricityService.regeneratePaymentJwt(userId, orderId);
    logger.info("Regenerated payment JWT", { userId, orderId });
    res.status(200).json({
      success: true,
      data: { paymentJwt: newJwt },
    });
  } catch (error: unknown) {
    logger.error("Error regenerating payment JWT", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id || "unknown",
      orderId: req.body.orderId,
      ip: req.ip,
    });
    next(error);
  }
};

// GetOrderHistory controller
export const GetOrderHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new UnprocessableEntity("User not authenticated", AppErrorCode.UNAUTHORIZED, []);
    }
    const userId = req.user.id;

    const orders = await electricityService.getOrderHistory(userId);
    logger.info("Fetched order history", { userId, count: orders.length });
    res.status(200).json({
      success: true,
      data: {
        recentOrders: orders.map((order) => ({
          meterNumber: order.meterNumber,
          amount: `N${order.paymentAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
          serviceFee: `N${(order.serviceFee ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
          flutterwaveFee: order.flutterwaveFee
            ? `N${order.flutterwaveFee.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
            : "Pending",
          vat: order.vat ? `N${order.vat.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "Pending",
        })),
      },
    });
  } catch (error: unknown) {
    logger.error("Error fetching order history", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id || "unknown",
      ip: req.ip,
    });
    next(error);
  }
};