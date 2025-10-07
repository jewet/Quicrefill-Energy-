"use strict";
exports.__esModule = true;
var express_1 = require("express");
var notificationController_1 = require("../../controllers/notification/notificationController");
var authentication_1 = require("../../middlewares/authentication");
var notificationRoutes = express_1["default"].Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationPayload:
 *       type: object
 *       required:
 *         - eventTypeName
 *       properties:
 *         eventTypeName:
 *           type: string
 *           enum:
 *             - NEW_ORDER
 *             - ORDER_UPDATE
 *             - ORDER_CONFIRMED
 *             - ORDER_CANCELLED
 *             - PASSWORD_CHANGE
 *             - FEEDBACK_SUBMITTED
 *             - PREFERENCE_UPDATE
 *             - PROFILE_UPDATE
 *             - WALLET_EVENT
 *             - WALLET_TRANSACTION
 *             - DISCOUNT
 *             - PROMO_OFFER
 *             - FLASH_SALE
 *           description: The type of event triggering the notification
 *           example: NEW_ORDER
 *         dynamicData:
 *           type: object
 *           description: Additional data specific to the event type
 *           example: { orderId: "12345", amount: 99.99 }
 *         userIds:
 *           type: array
 *           items:
 *             type: string
 *           description: List of user IDs to receive the notification (optional)
 *           example: ["user1", "user2"]
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *             enum: [CUSTOMER, VENDOR, DELIVERY_REP, ADMIN]
 *           description: List of user roles to receive the notification (optional)
 *           example: ["CUSTOMER", "VENDOR"]
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         message:
 *           type: string
 *           example: Notifications for event NEW_ORDER dispatched successfully
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 *           example: Invalid request payload
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               path:
 *                 type: array
 *                 items:
 *                   type: string
 *           example: [{ message: "Invalid event type", path: ["eventTypeName"] }]
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
/**
 * @swagger
 * /notifications/send:
 *   post:
 *     summary: Send a notification to users or roles
 *     tags: [Notifications]
 *     description: Dispatches a notification based on the specified event type, targeting specific users or roles. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationPayload'
 *     responses:
 *       200:
 *         description: Notification dispatched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid request payload or invalid user IDs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationRoutes.post("/send", authentication_1.authenticateAdmin, notificationController_1.validateNotificationPayload, notificationController_1.notificationController.sendNotification.bind(notificationController_1.notificationController));
/**
 * @swagger
 * /notifications/resend:
 *   post:
 *     summary: Resend a notification (not implemented)
 *     tags: [Notifications]
 *     description: Placeholder endpoint to resend a specific notification by ID. Requires admin authentication. Currently not implemented.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationId:
 *                 type: string
 *                 description: The ID of the notification to resend
 *                 example: "notif_12345"
 *     responses:
 *       501:
 *         description: Resend notification not implemented
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationRoutes.post("/resend", authentication_1.authenticateAdmin, notificationController_1.notificationController.resendNotification.bind(notificationController_1.notificationController));
/**
 * @swagger
 * /notifications/logs:
 *   get:
 *     summary: Retrieve notification logs (not implemented)
 *     tags: [Notifications]
 *     description: Placeholder endpoint to fetch notification logs. Requires admin authentication. Currently not implemented.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       501:
 *         description: Get notification logs not implemented
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationRoutes.get("/logs", authentication_1.authenticateAdmin, notificationController_1.notificationController.getNotificationLogs.bind(notificationController_1.notificationController));
exports["default"] = notificationRoutes;
