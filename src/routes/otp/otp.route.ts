import express, { Request, Response, NextFunction } from "express";
import { OtpController } from "../../controllers/otp/otp.controller";
import { authenticateUser } from "../../middlewares/authentication";

// Initialize the router
const OtpRouter = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create and send OTP to user's phone number (authenticated users)
OtpRouter.post(
  "/create",
  asyncHandler(authenticateUser),
  asyncHandler(OtpController.createOtp)
);

// Validate an OTP (authenticated users)
OtpRouter.post(
  "/validate",
  asyncHandler(authenticateUser),
  asyncHandler(OtpController.validateOtp)
);

export default OtpRouter;