import express, { Router, Request, Response, NextFunction } from "express";
import auditLogController from "../../controllers/auditlog/auditLogController"; // Import default export
import { authenticateAdmin } from "../../middlewares/authentication";

// Initialize the router
const auditLogRoutes: Router = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// POST route to create an audit log entry
auditLogRoutes.post(
  "/",
  asyncHandler(authenticateAdmin),
  auditLogController.createLog.bind(auditLogController)
);

// GET route to retrieve audit logs with optional filters
auditLogRoutes.get(
  "/",
  asyncHandler(authenticateAdmin),
  auditLogController.getLogs.bind(auditLogController)
);

export default auditLogRoutes;