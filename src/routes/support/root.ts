import { Router } from "express";
import FeedbackRouter  from "./support";

const SupportRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Support-related endpoints
 */

/**
 * @swagger
 * /api/support/feedback:
 *   get:
 *     summary: Support feedback routes placeholder
 *     tags: [Support]
 *     description: See nested feedback routes for specific endpoints related to support feedback
 *     responses:
 *       200:
 *         description: Success (handled by nested routes)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Support feedback routes placeholder"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
SupportRouter.use("/feedback", FeedbackRouter);

export default SupportRouter;