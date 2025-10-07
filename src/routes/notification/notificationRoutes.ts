import express, { Request, Response, NextFunction } from "express";
import { notificationController, validateNotificationPayload } from "../../controllers/notification/notificationController";
import { authenticateAdmin } from "../../middlewares/authentication";

// Initialize the router
const notificationRoutes = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Send a notification to users or roles (ADMIN only)
notificationRoutes.post(
  "/send",
  asyncHandler(authenticateAdmin),
  validateNotificationPayload,
  notificationController.sendNotification.bind(notificationController)
);

// Resend a notification (ADMIN only, not implemented)
notificationRoutes.post(
  "/resend",
  asyncHandler(authenticateAdmin),
  notificationController.resendNotification.bind(notificationController)
);

// Retrieve notification logs (ADMIN only, not implemented)
notificationRoutes.get(
  "/logs",
  asyncHandler(authenticateAdmin),
  notificationController.getNotificationLogs.bind(notificationController)
);

export default notificationRoutes;