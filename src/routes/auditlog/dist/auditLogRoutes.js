"use strict";
exports.__esModule = true;
var express_1 = require("express");
var auditLogController_1 = require("../../controllers/auditlog/auditLogController"); // Import default export
var authentication_1 = require("../../middlewares/authentication");
var auditLogRoutes = express_1["default"].Router();
/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLogRequest:
 *       type: object
 *       required:
 *         - userId
 *         - action
 *         - details
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: The ID of the user performing the action
 *         action:
 *           type: string
 *           description: The action being logged
 *         details:
 *           type: object
 *           description: Additional details about the action
 *         entityType:
 *           type: string
 *           description: The type of entity affected (optional)
 *         entityId:
 *           type: string
 *           format: uuid
 *           description: The ID of the entity affected (optional)
 *         notes:
 *           type: string
 *           description: Additional notes about the log (optional)
 *         investigationStatus:
 *           type: string
 *           description: Status of the investigation (optional)
 *         investigatedBy:
 *           type: string
 *           format: uuid
 *           description: ID of the user who investigated (optional)
 *       example:
 *         userId: "123e4567-e89b-12d3-a456-426614174000"
 *         action: "USER_LOGIN"
 *         details: { "ip": "192.168.1.1", "device": "Chrome" }
 *         entityType: "USER"
 *         entityId: "123e4567-e89b-12d3-a456-426614174001"
 *         notes: "Successful login"
 *         investigationStatus: "PENDING"
 *         investigatedBy: "123e4567-e89b-12d3-a456-426614174002"
 *     AuditLogFilter:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Filter by user ID (optional)
 *         action:
 *           type: string
 *           description: Filter by action type (optional)
 *         entityType:
 *           type: string
 *           description: Filter by entity type (optional)
 *         entityId:
 *           type: string
 *           format: uuid
 *           description: Filter by entity ID (optional)
 *         investigationStatus:
 *           type: string
 *           description: Filter by investigation status (optional)
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Filter logs after this date (optional)
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Filter logs before this date (optional)
 *       example:
 *         userId: "123e4567-e89b-12d3-a456-426614174000"
 *         action: "USER_LOGIN"
 *         entityType: "USER"
 *         entityId: "123e4567-e89b-12d3-a456-426614174001"
 *         investigationStatus: "PENDING"
 *         startDate: "2023-01-01T00:00:00Z"
 *         endDate: "2023-12-31T23:59:59Z"
 *     AuditLogResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *       example:
 *         message: "Audit log created successfully"
 *     AuditLogsResponse:
 *       type: object
 *       properties:
 *         logs:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AuditLogRequest'
 *           description: List of audit logs
 *       example:
 *         logs:
 *           - userId: "123e4567-e89b-12d3-a456-426614174000"
 *             action: "USER_LOGIN"
 *             details: { "ip": "192.168.1.1", "device": "Chrome" }
 *             entityType: "USER"
 *             entityId: "123e4567-e89b-12d3-a456-426614174001"
 *             notes: "Successful login"
 *             investigationStatus: "PENDING"
 *             investigatedBy: "123e4567-e89b-12d3-a456-426614174002"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Unauthorized"
 */
/**
 * @swagger
 * /audit-logs:
 *   post:
 *     summary: Create an audit log entry
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuditLogRequest'
 *     responses:
 *       200:
 *         description: Audit log created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogResponse'
 *       400:
 *         description: Validation error
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
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
auditLogRoutes.post("/", authentication_1.authenticateAdmin, auditLogController_1["default"].createLog.bind(auditLogController_1["default"]));
/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Retrieve audit logs with optional filters
 *     tags: [AuditLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by entity ID
 *       - in: query
 *         name: investigationStatus
 *         schema:
 *           type: string
 *         description: Filter by investigation status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs before this date
 *     responses:
 *       200:
 *         description: List of audit logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogsResponse'
 *       400:
 *         description: Validation error
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
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
auditLogRoutes.get("/", authentication_1.authenticateAdmin, auditLogController_1["default"].getLogs.bind(auditLogController_1["default"]));
exports["default"] = auditLogRoutes;
