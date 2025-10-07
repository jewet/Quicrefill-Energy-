import express, { Request, Response, NextFunction } from "express";
import { fraudDetectionController } from "../../controllers/fraudalert/fraudDetectionController";
import { authenticateAdmin } from "../../middlewares/authentication";

// Initialize the router
const fraudDetectionRoutes = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Check for suspicious activity in a transaction (ADMIN only)
fraudDetectionRoutes.post(
  "/check",
  asyncHandler(authenticateAdmin),
  fraudDetectionController.checkFraud.bind(fraudDetectionController)
);

// Retrieve fraud alerts with filters (ADMIN only)
fraudDetectionRoutes.get(
  "/alerts",
  asyncHandler(authenticateAdmin),
  fraudDetectionController.getFraudAlerts.bind(fraudDetectionController)
);

export default fraudDetectionRoutes;