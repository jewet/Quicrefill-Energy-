import express, { Request, Response, NextFunction } from "express";
import { TermiiOtpController } from "../../controllers/otp/termii-otp.controller";
import { authenticateUser } from "../../middlewares/authentication";

// Initialize the router
const TermiiOtpRouter = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create and send OTP via Termii (authenticated users)
TermiiOtpRouter.post(
  "/create",
  asyncHandler(authenticateUser),
  asyncHandler(TermiiOtpController.createOtp)
);

// Validate OTP via Termii (authenticated users)
TermiiOtpRouter.post(
  "/validate",
  asyncHandler(authenticateUser),
  asyncHandler(TermiiOtpController.validateOtp)
);

export default TermiiOtpRouter;