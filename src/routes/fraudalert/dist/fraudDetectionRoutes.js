"use strict";
exports.__esModule = true;
var express_1 = require("express");
var fraudDetectionController_1 = require("../../controllers/fraudalert/fraudDetectionController");
var authentication_1 = require("../../middlewares/authentication");
var fraudDetectionRoutes = express_1["default"].Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     FraudCheckRequest:
 *       type: object
 *       required:
 *         - userId
 *         - amount
 *         - type
 *         - entityType
 *         - entityId
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: The ID of the user associated with the transaction
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         amount:
 *           type: number
 *           description: The transaction amount
 *           example: 100.50
 *         type:
 *           type: string
 *           description: The type of transaction
 *           example: "PURCHASE"
 *         entityType:
 *           type: string
 *           description: The type of entity involved in the transaction
 *           example: "ORDER"
 *         entityId:
 *           type: string
 *           format: uuid
 *           description: The ID of the entity involved in the transaction
 *           example: "987e6543-e21b-12d3-a456-426614174000"
 *         vendorId:
 *           type: string
 *           format: uuid
 *           description: The ID of the vendor (optional)
 *           example: "456e7890-e12b-12d3-a456-426614174000"
 *     FraudAlertFilter:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Filter by user ID
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         vendorId:
 *           type: string
 *           format: uuid
 *           description: Filter by vendor ID
 *           example: "456e7890-e12b-12d3-a456-426614174000"
 *         type:
 *           type: string
 *           description: Filter by transaction type
 *           example: "PURCHASE"
 *         entityType:
 *           type: string
 *           description: Filter by entity type
 *           example: "ORDER"
 *         entityId:
 *           type: string
 *           format: uuid
 *           description: Filter by entity ID
 *           example: "987e6543-e21b-12d3-a456-426614174000"
 *         status:
 *           type: string
 *           description: Filter by fraud alert status
 *           example: "PENDING"
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Filter alerts created on or after this date (ISO 8601)
 *           example: "2025-06-01T00:00:00Z"
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Filter alerts created on or before this date (ISO 8601)
 *           example: "2025-06-27T23:59:59Z"
 *     FraudAlertResponse:
 *       type: object
 *       properties:
 *         alerts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the fraud alert
 *                 example: "789e1234-e56b-12d3-a456-426614174000"
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the user associated with the alert
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               vendorId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the vendor (if applicable)
 *                 example: "456e7890-e12b-12d3-a456-426614174000"
 *               type:
 *                 type: string
 *                 description: The type of transaction
 *                 example: "PURCHASE"
 *               entityType:
 *                 type: string
 *                 description: The type of entity involved
 *                 example: "ORDER"
 *               entityId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the entity involved
 *                 example: "987e6543-e21b-12d3-a456-426614174000"
 *               status:
 *                 type: string
 *                 description: The status of the fraud alert
 *                 example: "PENDING"
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *                 description: The date and time the alert was created
 *                 example: "2025-06-27T09:00:00Z"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message describing the issue
 *           example: "Unauthorized"
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
/**
 * @swagger
 * /fraud/check:
 *   post:
 *     summary: Check for suspicious activity in a transaction
 *     tags: [FraudDetection]
 *     description: Checks a transaction for potential fraudulent activity. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FraudCheckRequest'
 *     responses:
 *       200:
 *         description: Fraud check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No suspicious activity detected"
 *       400:
 *         description: Invalid request body
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
fraudDetectionRoutes.post("/check", authentication_1.authenticateAdmin, fraudDetectionController_1.fraudDetectionController.checkFraud.bind(fraudDetectionController_1.fraudDetectionController));
/**
 * @swagger
 * /fraud/alerts:
 *   get:
 *     summary: Retrieve fraud alerts with filters
 *     tags: [FraudDetection]
 *     description: Retrieves a list of fraud alerts based on optional filters. Requires admin authentication.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by vendor ID
 *         example: "456e7890-e12b-12d3-a456-426614174000"
 *       - in: queryස
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by transaction type
 *         example: "PURCHASE"
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *         example: "ORDER"
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by entity ID
 *         example: "987e6543-e21b-12d3-a456-426614174000"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by fraud alert status
 *         example: "PENDING"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter alerts created on or after this date (ISO 8601)
 *         example: "2025-06-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter alerts created on or before this date (ISO 8601)
 *         example: "2025-06-27T23:59:59Z"
 *     responses:
 *       200:
 *         description: Fraud alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FraudAlertResponse'
 *       400:
 *         description: Invalid query parameters
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
fraudDetectionRoutes.get("/alerts", authentication_1.authenticateAdmin, fraudDetectionController_1.fraudDetectionController.getFraudAlerts.bind(fraudDetectionController_1.fraudDetectionController));
exports["default"] = fraudDetectionRoutes;
