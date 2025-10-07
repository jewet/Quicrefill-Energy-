"use strict";
exports.__esModule = true;
var express_1 = require("express");
var smsTemplate_1 = require("../../controllers/SmSTemplate/smsTemplate");
var router = express_1.Router();
/**
 * @swagger
 * tags:
 *   name: SMSTemplates
 *   description: SMS template management and SMS sending API
 */
/**
 * @swagger
 * /api/sms-templates:
 *   post:
 *     summary: Create a new SMS template
 *     description: Creates a new SMS template with a name, content, and optional roles, event type, and status. Requires authentication to track the user who created the template.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *                 description: The unique name of the SMS template.
 *                 example: Welcome SMS
 *               content:
 *                 type: string
 *                 description: The SMS content, supporting placeholders for dynamic data (e.g., {{name}}).
 *                 example: Hello {{name}}, welcome to our platform!
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [ADMIN, CUSTOMER, DELIVERY_AGENT, DELIVERY_REP, VENDOR, MANAGER, SUPERVISOR, FINANCE_MANAGER, STAFF, SERVICE_REP]
 *                 description: Optional list of user roles authorized to use this template.
 *                 example: [CUSTOMER, VENDOR]
 *               eventTypeId:
 *                 type: string
 *                 description: Optional ID of the event type associated with this template (e.g., for automated triggers).
 *                 example: event_welcome
 *               isActive:
 *                 type: boolean
 *                 description: Optional status indicating if the template is active.
 *                 example: true
 *     responses:
 *       201:
 *         description: SMS template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The unique ID of the created template.
 *                   example: template_123
 *                 name:
 *                   type: string
 *                   description: The name of the template.
 *                   example: Welcome SMS
 *                 content:
 *                   type: string
 *                   description: The SMS content.
 *                   example: Hello {{name}}, welcome to our platform!
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of authorized roles.
 *                   example: [CUSTOMER, VENDOR]
 *                 eventTypeId:
 *                   type: string
 *                   description: Associated event type ID.
 *                   example: event_welcome
 *                 isActive:
 *                   type: boolean
 *                   description: Template active status.
 *                   example: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: Creation timestamp.
 *                   example: 2025-06-25T15:19:00.000Z
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp.
 *                   example: 2025-06-25T15:19:00.000Z
 *                 updatedBy:
 *                   type: string
 *                   description: ID of the user who created/updated the template.
 *                   example: user_123
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
 *                         example: Name is required
 *                       param:
 *                         type: string
 *                         example: name
 *                       location:
 *                         type: string
 *                         example: body
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unknown error
 */
router.post("/sms-templates", smsTemplate_1.SMSTemplateController.validateTemplate, smsTemplate_1.smsTemplateController.createTemplate.bind(smsTemplate_1.smsTemplateController));
/**
 * @swagger
 * /api/sms-templates/{id}:
 *   patch:
 *     summary: Update an existing SMS template
 *     description: Updates an SMS template by ID with partial data. Requires authentication to track the user who updated the template.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the SMS template to update.
 *         example: template_123
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The updated name of the SMS template.
 *                 example: Updated Welcome SMS
 *               content:
 *                 type: string
 *                 description: The updated SMS content.
 *                 example: Hi {{name}}, thanks for joining us!
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [ADMIN, CUSTOMER, DELIVERY_AGENT, DELIVERY_REP, VENDOR, MANAGER, SUPERVISOR, FINANCE_MANAGER, STAFF, SERVICE_REP]
 *                 description: Updated list of authorized roles.
 *                 example: [CUSTOMER]
 *               eventTypeId:
 *                 type: string
 *                 description: Updated event type ID.
 *                 example: event_updated
 *               isActive:
 *                 type: boolean
 *                 description: Updated active status.
 *                 example: false
 *     responses:
 *       200:
 *         description: SMS template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: template_123
 *                 name:
 *                   type: string
 *                   example: Updated Welcome SMS
 *                 content:
 *                   type: string
 *                   example: Hi {{name}}, thanks for joining us!
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [CUSTOMER]
 *                 eventTypeId:
 *                   type: string
 *                   example: event_updated
 *                 isActive:
 *                   type: boolean
 *                   example: false
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-06-25T15:19:00.000Z
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-06-25T15:20:00.000Z
 *                 updatedBy:
 *                   type: string
 *                   example: user_123
 *       400:
 *         description: Bad request - Validation errors
 *       500:
 *         description: Internal server error
 */
router.patch("/sms-templates/:id", smsTemplate_1.SMSTemplateController.validateTemplate, smsTemplate_1.smsTemplateController.updateTemplate.bind(smsTemplate_1.smsTemplateController));
/**
 * @swagger
 * /api/sms-templates/{id}:
 *   delete:
 *     summary: Delete an SMS template
 *     description: Deletes an SMS template by ID. Requires authentication to track the user who deleted the template.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the SMS template to delete.
 *         example: template_123
 *     responses:
 *       204:
 *         description: SMS template deleted successfully
 *       500:
 *         description: Internal server error
 */
router["delete"]("/sms-templates/:id", smsTemplate_1.smsTemplateController.deleteTemplate.bind(smsTemplate_1.smsTemplateController));
/**
 * @swagger
 * /api/sms-templates:
 *   get:
 *     summary: Retrieve all SMS templates
 *     description: Retrieves a list of all SMS templates. Requires authentication.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SMS templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: template_123
 *                   name:
 *                     type: string
 *                     example: Welcome SMS
 *                   content:
 *                     type: string
 *                     example: Hello {{name}}, welcome to our platform!
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: [CUSTOMER, VENDOR]
 *                   eventTypeId:
 *                     type: string
 *                     example: event_welcome
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: 2025-06-25T15:19:00.000Z
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: 2025-06-25T15:19:00.000Z
 *                   updatedBy:
 *                     type: string
 *                     example: user_123
 *       500:
 *         description: Internal server error
 */
router.get("/sms-templates", smsTemplate_1.smsTemplateController.getTemplates.bind(smsTemplate_1.smsTemplateController));
/**
 * @swagger
 * /api/sms-templates/{id}:
 *   get:
 *     summary: Retrieve an SMS template by ID
 *     description: Retrieves a specific SMS template by its ID. Requires authentication.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the SMS template to retrieve.
 *         example: template_123
 *     responses:
 *       200:
 *         description: SMS template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: template_123
 *                 name:
 *                   type: string
 *                   example: Welcome SMS
 *                 content:
 *                   type: string
 *                   example: Hello {{name}}, welcome to our platform!
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [CUSTOMER, VENDOR]
 *                 eventTypeId:
 *                   type: string
 *                   example: event_welcome
 *                 isActive:
 *                   type: boolean
 *                   example: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-06-25T15:19:00.000Z
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-06-25T15:19:00.000Z
 *                 updatedBy:
 *                   type: string
 *                   example: user_123
 *       404:
 *         description: SMS template not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Template not found
 *       500:
 *         description: Internal server error
 */
router.get("/sms-templates/:id", smsTemplate_1.smsTemplateController.getTemplateById.bind(smsTemplate_1.smsTemplateController));
/**
 * @swagger
 * /api/sms/otp:
 *   post:
 *     summary: Send OTP SMS
 *     description: Sends an OTP SMS to a specified phone number with an OTP code. Requires authentication.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - otpCode
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: The recipient's phone number in E.164 format (e.g., +1234567890).
 *                 example: +1234567890
 *               otpCode:
 *                 type: string
 *                 description: The OTP code to send.
 *                 example: 123456
 *               eventType:
 *                 type: string
 *                 description: Optional event type associated with the OTP (e.g., for logging or triggers).
 *                 example: user_verification
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for additional context.
 *                 example: { userId: "user_123", source: "login" }
 *     responses:
 *       200:
 *         description: OTP SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP SMS sent successfully
 *       400:
 *         description: Bad request - Validation errors
 *       500:
 *         description: Internal server error
 */
router.post("/sms/otp", smsTemplate_1.SMSTemplateController.validateOtpSMS, smsTemplate_1.smsTemplateController.sendOtpSMS.bind(smsTemplate_1.smsTemplateController));
/**
 * @swagger
 * /api/sms/bulk:
 *   post:
 *     summary: Send bulk SMS
 *     description: Sends bulk SMS messages using a template or custom content to specified recipients, roles, or user IDs. Requires authentication.
 *     tags: [SMSTemplates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: Optional ID of the SMS template to use.
 *                 example: template_123
 *               eventType:
 *                 type: string
 *                 description: Optional event type associated with the bulk SMS.
 *                 example: promotional_campaign
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [ADMIN, CUSTOMER, DELIVERY_AGENT, DELIVERY_REP, VENDOR, MANAGER, SUPERVISOR, FINANCE_MANAGER, STAFF, SERVICE_REP]
 *                 description: Optional list of roles to target recipients.
 *                 example: [CUSTOMER]
 *               customPayload:
 *                 type: object
 *                 description: Optional custom payload for ad-hoc SMS content.
 *                 properties:
 *                   content:
 *                     type: string
 *                     description: Custom SMS content if no template is used.
 *                     example: Don't miss our sale this weekend!
 *                   to:
 *                     oneOf:
 *                       - type: string
 *                         description: Single recipient phone number.
 *                         example: +1234567890
 *                       - type: array
 *                         items:
 *                           type: string
 *                         description: List of recipient phone numbers.
 *                         example: [+1234567890, +0987654321]
 *                 example:
 *                   content: Don't miss our sale this weekend!
 *                   to: [+1234567890, +0987654321]
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional list of user IDs to target recipients.
 *                 example: [user_123, user_456]
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for additional context.
 *                 example: { campaignId: "camp_789", source: "marketing" }
 *     responses:
 *       200:
 *         description: Bulk SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bulk SMS sent successfully
 *       400:
 *         description: Bad request - Validation errors
 *       500:
 *         description: Internal server error
 */
router.post("/sms/bulk", smsTemplate_1.SMSTemplateController.validateBulkSMS, smsTemplate_1.smsTemplateController.sendBulkSMS.bind(smsTemplate_1.smsTemplateController));
exports["default"] = router;
