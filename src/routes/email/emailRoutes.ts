import express, { Router, Request, Response, NextFunction } from "express";
import { emailController } from "../../controllers/email/emailController";
import { authenticateAdmin } from "../../middlewares/authentication";

// Initialize the router
const emailRoutes: Router = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create a new email template (ADMIN only)
emailRoutes.post(
  "/templates",
  asyncHandler(authenticateAdmin),
  emailController.createTemplate.bind(emailController)
);

// Update an existing email template (ADMIN only)
emailRoutes.put(
  "/templates/:id",
  asyncHandler(authenticateAdmin),
  emailController.updateTemplate.bind(emailController)
);

// Delete an email template (ADMIN only)
emailRoutes.delete(
  "/templates/:id",
  asyncHandler(authenticateAdmin),
  emailController.deleteTemplate.bind(emailController)
);

// Retrieve all email templates (ADMIN only)
emailRoutes.get(
  "/templates",
  asyncHandler(authenticateAdmin),
  emailController.getTemplates.bind(emailController)
);

// Send email(s) (ADMIN only)
emailRoutes.post(
  "/send",
  asyncHandler(authenticateAdmin),
  emailController.sendEmail.bind(emailController)
);

export default emailRoutes;