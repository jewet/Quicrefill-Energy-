import { Router } from "express";
import { authenticationMiddleware } from "../../middlewares/authentication";
import { errorHandler } from "../../lib/handlers/errorHandler";
import { ensureAdmin, getContactOptions, createContactOption } from "../../controllers/support/support";

const SupportRouter = Router();
SupportRouter.use(errorHandler(authenticationMiddleware));

// Get contact options (accessible to all authenticated users)
SupportRouter.get(
  "/contact-options",
  errorHandler(getContactOptions)
);

// Create contact option (admin only)
SupportRouter.post(
  "/contact-options",
  errorHandler(ensureAdmin),
  errorHandler(createContactOption)
);

export default SupportRouter;