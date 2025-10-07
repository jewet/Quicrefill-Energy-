import express, { Request, Response, NextFunction } from "express";
import { FeedbackController } from "../../controllers/feedback/feedbackController";
import { authenticateUser, authorizeRoles } from "../../middlewares/authentication";

// Initialize the router and controller
const router = express.Router();
const feedbackController = new FeedbackController();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Submit a new feedback (non-admin authenticated users)
router.post(
  "/",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles([
    "CUSTOMER",
    "DELIVERY_AGENT",
    "VENDOR",
    "MANAGER",
    "SUPERVISOR",
    "FINANCE_MANAGER",
    "STAFF",
    "SERVICE_REP",
  ])),
  feedbackController.createFeedback.bind(feedbackController)
);

// Retrieve feedbacks with filters (ADMIN only)
router.get(
  "/",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  feedbackController.getFeedbacks.bind(feedbackController)
);

// Update a feedback by ID (ADMIN only)
router.put(
  "/:id",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  feedbackController.updateFeedback.bind(feedbackController)
);

// Retrieve a feedback by ID (ADMIN only)
router.get(
  "/:id",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  feedbackController.getFeedbackById.bind(feedbackController)
);

// Reopen a resolved feedback ticket (ADMIN only)
router.put(
  "/:id/reopen",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  feedbackController.reopenFeedback.bind(feedbackController)
);

// Update receiver's average rating (ADMIN only)
router.post(
  "/update-rating",
  asyncHandler(authenticateUser),
  asyncHandler(authorizeRoles(["ADMIN"])),
  feedbackController.updateReceiverRating.bind(feedbackController)
);

export default router;