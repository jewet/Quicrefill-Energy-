"use strict";
exports.__esModule = true;
var express_1 = require("express");
var EmailSettingsController_1 = require("../../controllers/EmailSettings/EmailSettingsController");
var authentication_1 = require("../../middlewares/authentication");
var client_1 = require("@prisma/client");
var router = express_1.Router();
/**
 * @swagger
 * tags:
 *   name: EmailSettings
 *   description: Email settings management API for admin users
 */
/**
 * @swagger
 * /api/email-settings/dashboard:
 *   get:
 *     summary: Retrieve email dashboard data
 *     description: Retrieves comprehensive email-related data for the admin dashboard, including email settings, total emails sent this month, daily success rate, and email templates. Requires admin authentication.
 *     tags: [EmailSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 emailSettings:
 *                   type: object
 *                   properties:
 *                     serviceType:
 *                       type: string
 *                       example: SMTP
 *                     smtpHost:
 *                       type: string
 *                       example: smtp.example.com
 *                     smtpPort:
 *                       type: integer
 *                       example: 587
 *                     smtpUser:
 *                       type: string
 *                       example: user@example.com
 *                     smtpPassword:
 *                       type: string
 *                       example: "********"
 *                     emailFrom:
 *                       type: string
 *                       example: no-reply@example.com
 *                     enableNotifications:
 *                       type: boolean
 *                       example: true
 *                     deliveryTimeStart:
 *                       type: string
 *                       example: "09:00"
 *                     deliveryTimeEnd:
 *                       type: string
 *                       example: "17:00"
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-06-25T20:03:21.000Z
 *                     updatedBy:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: user_123
 *                         name:
 *                           type: string
 *                           example: John Doe
 *                         email:
 *                           type: string
 *                           example: john.doe@example.com
 *                 totalEmailsSent:
 *                   type: integer
 *                   example: 1500
 *                 successRate:
 *                   type: string
 *                   example: "98.50"
 *                 templates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       messageId:
 *                         type: string
 *                         example: template_123
 *                       templateName:
 *                         type: string
 *                         example: Welcome Email
 *                       content:
 *                         type: string
 *                         example: <h1>Welcome</h1><p>Sample content</p>
 *                       status:
 *                         type: string
 *                         example: Active
 *                       provider:
 *                         type: string
 *                         example: SMTP
 *                       dateCreated:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-06-25T20:03:21.000Z
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied: Admin role required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unknown error"
 */
router.get("/dashboard", authentication_1.authenticateUser, authentication_1.authorizeRoles([client_1.Role.ADMIN]), EmailSettingsController_1.emailSettingsController.getEmailDashboard.bind(EmailSettingsController_1.emailSettingsController));
/**
 * @swagger
 * /api/email-settings:
 *   get:
 *     summary: Retrieve current email settings
 *     description: Retrieves the current email settings for the settings form, including SMTP configuration and notification preferences. Requires admin authentication.
 *     tags: [EmailSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serviceType:
 *                   type: string
 *                   example: SMTP
 *                 smtpHost:
 *                   type: string
 *                   example: smtp.example.com
 *                 smtpPort:
 *                   type: integer
 *                   example: 587
 *                 smtpUser:
 *                   type: string
 *                   example: user@example.com
 *                 smtpPassword:
 *                   type: string
 *                   example: "********"
 *                 emailFrom:
 *                   type: string
 *                   example: no-reply@example.com
 *                 enableNotifications:
 *                   type: boolean
 *                   example: true
 *                 deliveryTimeStart:
 *                   type: string
 *                   example: "09:00"
 *                 deliveryTimeEnd:
 *                   type: string
 *                   example: "17:00"
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-06-25T20:03:21.000Z
 *                 updatedBy:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: user_123
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied: Admin role required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unknown error"
 */
router.get("/", authentication_1.authenticateUser, authentication_1.authorizeRoles([client_1.Role.ADMIN]), EmailSettingsController_1.emailSettingsController.getEmailSettings.bind(EmailSettingsController_1.emailSettingsController));
/**
 * @swagger
 * /api/email-settings:
 *   patch:
 *     summary: Update email settings
 *     description: Updates email settings with optional fields for SMTP configuration and notification preferences. Requires admin authentication and valid input.
 *     tags: [EmailSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               smtpHost:
 *                 type: string
 *                 description: SMTP server host
 *                 example: smtp.example.com
 *               smtpPort:
 *                 type: number
 *                 description: SMTP server port number (1-65535)
 *                 example: 587
 *               smtpUser:
 *                 type: string
 *                 description: SMTP server user email
 *                 example: user@example.com
 *               smtpPassword:
 *                 type: string
 *                 description: Password for SMTP authentication
 *                 example: securepass123
 *               emailFrom:
 *                 type: string
 *                 description: Sender email address
 *                 example: no-reply@example.com
 *               enableNotifications:
 *                 type: boolean
 *                 description: Enable or disable email notifications
 *                 example: true
 *               deliveryTimeStart:
 *                 type: string
 *                 description: Start time for email delivery (HH:mm)
 *                 example: "09:00"
 *               deliveryTimeEnd:
 *                 type: string
 *                 description: End time for email delivery (HH:mm)
 *                 example: "17:00"
 *     responses:
 *       200:
 *         description: Email settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serviceType:
 *                   type: string
 *                   example: SMTP
 *                 smtpHost:
 *                   type: string
 *                   example: smtp.example.com
 *                 smtpPort:
 *                   type: integer
 *                   example: 587
 *                 smtpUser:
 *                   type: string
 *                   example: user@example.com
 *                 smtpPassword:
 *                   type: string
 *                   example: "********"
 *                 emailFrom:
 *                   type: string
 *                   example: no-reply@example.com
 *                 enableNotifications:
 *                   type: boolean
 *                   example: true
 *                 deliveryTimeStart:
 *                   type: string
 *                   example: "09:00"
 *                 deliveryTimeEnd:
 *                   type: string
 *                   example: "17:00"
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-06-25T20:03:21.000Z
 *                 updatedBy:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: user_123
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         example: SMTP host must be a non-empty string
 *                       param:
 *                         type: string
 *                         example: smtpHost
 *                       location:
 *                         type: string
 *                         example: body
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access denied: Admin role required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unknown error"
 */
router.patch("/", authentication_1.authenticateUser, authentication_1.authorizeRoles([client_1.Role.ADMIN]), EmailSettingsController_1.EmailSettingsController.validateEmailSettings, EmailSettingsController_1.emailSettingsController.updateEmailSettings.bind(EmailSettingsController_1.emailSettingsController));
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */
exports["default"] = router;
