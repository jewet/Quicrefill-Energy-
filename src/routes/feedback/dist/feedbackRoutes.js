"use strict";
exports.__esModule = true;
var express_1 = require("express");
var feedbackController_1 = require("../../controllers/feedback/feedbackController");
var authentication_1 = require("../../middlewares/authentication");
var client_1 = require("@prisma/client");
var router = express_1["default"].Router();
var feedbackController = new feedbackController_1.FeedbackController();
/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit a new feedback
 *     description: Allows authenticated users (except admins) to submit feedback with content, rating, and optional related entity details.
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - rating
 *               - type
 *             properties:
 *               content:
 *                 type: string
 *                 description: The feedback content or comment.
 *                 example: "Great service, fast delivery!"
 *               rating:
 *                 type: number
 *                 description: Rating from 1 to 5.
 *                 example: 5
 *               type:
 *                 type: string
 *                 description: Type of feedback (e.g., ORDER, PRODUCT, SERVICE).
 *                 example: ORDER
 *               relatedEntityId:
 *                 type: string
 *                 description: ID of the related entity (e.g., order ID, product ID).
 *                 example: "order_123"
 *               relatedEntityType:
 *                 type: string
 *                 description: Type of the related entity (e.g., ORDER, PRODUCT).
 *                 example: ORDER
 *     responses:
 *       200:
 *         description: Feedback submitted successfully
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
 *                   example: Feedback submitted successfully
 *                 data:
 *                   type: object
 *                   description: The created feedback object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - User role not allowed
 *       500:
 *         description: Internal server error
 */
router.post('/', authentication_1.authenticateUser, authentication_1.authorizeRoles([
    client_1.Role.CUSTOMER,
    client_1.Role.DELIVERY_AGENT,
    client_1.Role.DELIVERY_REP,
    client_1.Role.VENDOR,
    client_1.Role.MANAGER,
    client_1.Role.SUPERVISOR,
    client_1.Role.FINANCE_MANAGER,
    client_1.Role.STAFF,
    client_1.Role.SERVICE_REP,
]), feedbackController.createFeedback.bind(feedbackController));
/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Retrieve feedbacks with filters
 *     description: Allows admins to retrieve feedbacks with optional filters such as user ID, type, status, and date range.
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *         example: user_123
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by feedback type (e.g., ORDER, PRODUCT)
 *         example: ORDER
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by feedback status (e.g., PENDING, RESOLVED)
 *         example: PENDING
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *         description: Filter by rating (1 to 5)
 *         example: 5
 *       - in: query
 *         name: relatedEntityId
 *         schema:
 *           type: string
 *         description: Filter by related entity ID
 *         example: order_123
 *       - in: query
 *         name: relatedEntityType
 *         schema:
 *           type: string
 *         description: Filter by related entity type
 *         example: ORDER
 *       - in: query
 *         name: createdAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter feedbacks created after this date
 *         example: 2025-01-01T00:00:00Z
 *       - in: query
 *         name: createdBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter feedbacks created before this date
 *         example: 2025-12-31T23:59:59Z
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of feedbacks per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Feedbacks retrieved successfully
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
 *                   example: Feedbacks retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Feedback objects
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.get('/', authentication_1.authenticateUser, authentication_1.authorizeRoles([client_1.Role.ADMIN]), feedbackController.getFeedbacks.bind(feedbackController));
/**
 * @swagger
 * /api/feedback/{id}:
 *   put:
 *     summary: Update a feedback by ID
 *     description: Allows admins to update feedback details such as content, rating, or status.
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The feedback ID
 *         example: feedback_123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated feedback content
 *                 example: "Updated: Service was excellent"
 *               rating:
 *                 type: number
 *                 description: Updated rating (1 to 5)
 *                 example: 4
 *               status:
 *                 type: string
 *                 description: Updated feedback status (e.g., PENDING, RESOLVED)
 *                 example: RESOLVED
 *     responses:
 *       200:
 *         description: Feedback updated successfully
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
 *                   example: Feedback updated successfully
 *                 data:
 *                   type: object
 *                   description: The updated feedback object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authentication_1.authenticateUser, authentication_1.authorizeRoles([client_1.Role.ADMIN]), feedbackController.updateFeedback.bind(feedbackController));
/**
 * @swagger
 * /api/feedback/{id}:
 *   get:
 *     summary: Retrieve a feedback by ID
 *     description: Allows admins to retrieve a specific feedback by its ID.
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The feedback ID
 *         example: feedback_123
 *     responses:
 *       200:
 *         description: Feedback retrieved successfully
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
 *                   example: Feedback retrieved successfully
 *                 data:
 *                   type: object
 *                   description: The feedback object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Feedback not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authentication_1.authenticateUser, authentication_1.authorizeRoles([client_1.Role.ADMIN]), feedbackController.getFeedbackById.bind(feedbackController));
exports["default"] = router;
