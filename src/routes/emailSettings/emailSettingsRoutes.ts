import { Router, Request, Response, NextFunction } from "express";
import { emailSettingsController, EmailSettingsController } from "../../controllers/EmailSettings/EmailSettingsController";
import { authenticateUser, authorizeRoles } from "../../middlewares/authentication";

// Initialize the router
const router = Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Retrieve email dashboard data (ADMIN only)
router.get(
  "/dashboard",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  emailSettingsController.getEmailDashboard.bind(emailSettingsController)
);

// Retrieve current email settings (ADMIN only)
router.get(
  "/",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  emailSettingsController.getEmailSettings.bind(emailSettingsController)
);

// Update email settings (ADMIN only)
router.patch(
  "/",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  EmailSettingsController.validateEmailSettings,
  emailSettingsController.updateEmailSettings.bind(emailSettingsController)
);

export default router;