"use strict";
exports.__esModule = true;
var SMSSettingsController_1 = require("../../controllers/smsSettings/SMSSettingsController");
var express_1 = require("express");
var authentication_1 = require("../../middlewares/authentication");
var router = express_1["default"].Router();
/**
 * @swagger
 * tags:
 *   name: SMSSettings
 *   description: SMS settings management API for admin users
 */
/**
 * @swagger
 * /api/admin/sms-settings:
 *   get:
 *     summary: Retrieve SMS settings
 *     description: Retrieves the current SMS settings for the admin dashboard. Requires admin authentication.
 *     tags: [SMSSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SMS settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enableNotifications:
 *                   type: boolean
 *                 senderId:
 *                   type: string
 *                 deliveryTimeStart:
 *                   type: string
 *                 deliveryTimeEnd:
 *                   type: string
 *                 smsProvider:
 *                   type: string
 *                 serviceType:
 *                   type: string
 *                 user:
 *                   type: string
 *                 password:
 *                   type: string
 *                 host:
 *                   type: string
 *                 port:
 *                   type: number
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/admin/sms-settings", authentication_1.authenticateAdmin, SMSSettingsController_1.smsSettingsController.getSMSSettings.bind(SMSSettingsController_1.smsSettingsController));
/**
 * @swagger
 * /api/admin/sms-settings:
 *   put:
 *     summary: Update SMS settings
 *     description: Updates SMS settings with optional fields. Requires admin authentication.
 *     tags: [SMSSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enableNotifications:
 *                 type: boolean
 *               senderId:
 *                 type: string
 *               deliveryTimeStart:
 *                 type: string
 *               deliveryTimeEnd:
 *                 type: string
 *               smsProvider:
 *                 type: string
 *               serviceType:
 *                 type: string
 *               user:
 *                 type: string
 *               password:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: number
 *     responses:
 *       200:
 *         description: SMS settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enableNotifications:
 *                   type: boolean
 *                 senderId:
 *                   type: string
 *                 deliveryTimeStart:
 *                   type: string
 *                 deliveryTimeEnd:
 *                   type: string
 *                 smsProvider:
 *                   type: string
 *                 serviceType:
 *                   type: string
 *                 user:
 *                   type: string
 *                 password:
 *                   type: string
 *                 host:
 *                   type: string
 *                 port:
 *                   type: number
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - Validation errors
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.put("/admin/sms-settings", authentication_1.authenticateAdmin, SMSSettingsController_1.SMSSettingsController.validateSMSSettings, SMSSettingsController_1.smsSettingsController.updateSMSSettings.bind(SMSSettingsController_1.smsSettingsController));
exports["default"] = router;
