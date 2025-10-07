"use strict";
exports.__esModule = true;
var express_1 = require("express");
var EmailController_1 = require("../../controllers/EmailTemplate/EmailController");
var router = express_1.Router();
/**
 * @swagger
 * tags:
 *   name: Email
 *   description: Email template management and email sending API
 */
/**
 * @swagger
 * /api/email-templates:
 *   post:
 *     summary: Create a new email template
 *     description: Creates a new email template with a name, subject, and HTML content. Requires authentication to track the user who created the template.
 *     tags: [Email]
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
 *               - subject
 *               - htmlContent
 *             properties:
 *               name:
 *                 type: string
 *                 description: The unique name of the email template.
 *                 example: Welcome Email
 *               subject:
 *                 type: string
 *                 description: The email subject line.
 *                 example: Welcome to Our Platform!
 *               htmlContent:
 *                 type: string
 *                 description: The HTML content of the email template, supporting placeholders for dynamic data.
 *                 example: <h1>Welcome, {{name}}!</h1><p>Thank you for joining our platform.</p>
 *               description:
 *                 type: string
 *                 description: Optional description of the email template.
 *                 example: Template for welcoming new users
 *     responses:
 *       201:
 *         description: Email template created successfully
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
 *                   example: Email template created successfully
 *                 data:
 *                   type: object
 *                   description: The created email template
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: template_123
 *                     name:
 *                       type: string
 *                       example: Welcome Email
 *                     subject:
 *                       type: string
 *                       example: Welcome to Our Platform!
 *                     htmlContent:
 *                       type: string
 *                       example: <h1>Welcome, {{name}}!</h1><p>Thank you for joining our platform.</p>
 *                     description:
 *                       type: string
 *                       example: Template for welcoming new users
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-06-25T20:03:21.000Z
 *                     updatedBy:
 *                       type: string
 *                       example: user_123
 *       400:
 *         description: Bad request - Missing required fields or invalid input
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
 *                   example: Name, subject, and htmlContent are required
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
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
 *                   example: "Unauthorized: User not found"
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router.post("/email-templates", EmailController_1.EmailController.createTemplate);
/**
 * @swagger
 * /api/email-templates/{id}:
 *   patch:
 *     summary: Update an existing email template
 *     description: Updates an email template by ID with partial data. Requires authentication to track the user who updated the template.
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the email template to update
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
 *                 description: The updated name of the email template
 *                 example: Updated Welcome Email
 *               subject:
 *                 type: string
 *                 description: The updated email subject line
 *                 example: Welcome to Our Updated Platform!
 *               htmlContent:
 *                 type: string
 *                 description: The updated HTML content of the email template
 *                 example: <h1>Hello, {{name}}!</h1><p>Welcome to our updated platform.</p>
 *               description:
 *                 type: string
 *                 description: The updated description of the email template
 *                 example: Updated template for welcoming new users
 *     responses:
 *       200:
 *         description: Email template updated successfully
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
 *                   example: Email template updated
 *                 data:
 *                   type: object
 *                   description: The updated email template
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: template_123
 *                     name:
 *                       type: string
 *                       example: Updated Welcome Email
 *                     subject:
 *                       type: string
 *                       example: Welcome to Our Updated Platform!
 *                     htmlContent:
 *                       type: string
 *                       example: <h1>Hello, {{name}}!</h1><p>Welcome to our updated platform.</p>
 *                     description:
 *                       type: string
 *                       example: Updated template for welcoming new users
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-06-25T20:03:21.000Z
 *                     updatedBy:
 *                       type: string
 *                       example: user_123
 *       400:
 *         description: Bad request - Invalid input or template not found
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
 *                   example: Invalid input or template not found
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
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
 *                   example: "Unauthorized: User not found"
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router.patch("/email-templates/:id", EmailController_1.EmailController.updateTemplate);
/**
 * @swagger
 * /api/email-templates/{id}:
 *   delete:
 *     summary: Delete an email template
 *     description: Deletes an email template by ID. Requires authentication to track the user who deleted the template.
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the email template to delete
 *         example: template_123
 *     responses:
 *       200:
 *         description: Email template deleted successfully
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
 *                   example: Email template deleted
 *                 data:
 *                   type: null
 *                   example: null
 *       400:
 *         description: Bad request - Template not found
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
 *                   example: Template not found
 *       401:
 *         description: Unauthorized - Invalid or missing authentication
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
 *                   example: "Unauthorized: User not found"
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router["delete"]("/email-templates/:id", EmailController_1.EmailController.deleteTemplate);
/**
 * @swagger
 * /api/email-templates:
 *   get:
 *     summary: Retrieve all email templates
 *     description: Retrieves a list of all email templates. No authentication required (unless authMiddleware is enabled).
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Email templates retrieved successfully
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
 *                   example: Email templates retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: template_123
 *                       name:
 *                         type: string
 *                         example: Welcome Email
 *                       subject:
 *                         type: string
 *                         example: Welcome to Our Platform!
 *                       htmlContent:
 *                         type: string
 *                         example: <h1>Welcome, {{name}}!</h1><p>Thank you for joining our platform.</p>
 *                       description:
 *                         type: string
 *                         example: Template for welcoming new users
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-06-25T20:03:21.000Z
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2025-06-25T20:03:21.000Z
 *                       updatedBy:
 *                         type: string
 *                         example: user_123
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router.get("/email-templates", EmailController_1.EmailController.getTemplates);
/**
 * @swagger
 * /api/email-templates/{id}:
 *   get:
 *     summary: Retrieve an email template by ID
 *     description: Retrieves a specific email template by its ID. No authentication required (unless authMiddleware is enabled).
 *     tags: [Email]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the email template to retrieve
 *         example: template_123
 *     responses:
 *       200:
 *         description: Email template retrieved successfully
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
 *                   example: Email template retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: template_123
 *                     name:
 *                       type: string
 *                       example: Welcome Email
 *                     subject:
 *                       type: string
 *                       example: Welcome to Our Platform!
 *                     htmlContent:
 *                       type: string
 *                       example: <h1>Welcome, {{name}}!</h1><p>Thank you for joining our platform.</p>
 *                     description:
 *                       type: string
 *                       example: Template for welcoming new users
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-06-25T20:03:21.000Z
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-06-25T20:03:21.000Z
 *                     updatedBy:
 *                       type: string
 *                       example: user_123
 *       404:
 *         description: Email template not found
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
 *                   example: Email template not found
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router.get("/email-templates/:id", EmailController_1.EmailController.getTemplateById);
/**
 * @swagger
 * /api/emails:
 *   post:
 *     summary: Send email(s)
 *     description: Sends one or more emails using a template or custom content. Supports bulk email sending with dynamic data replacement. No authentication required (unless authMiddleware is enabled).
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: List of recipient email addresses
 *                 example: ["user1@example.com", "user2@example.com"]
 *               templateId:
 *                 type: string
 *                 description: ID of the email template to use (optional if custom content is provided)
 *                 example: template_123
 *               subject:
 *                 type: string
 *                 description: Custom email subject (required if no templateId)
 *                 example: Welcome to Our Platform!
 *               htmlContent:
 *                 type: string
 *                 description: Custom HTML content (required if no templateId)
 *                 example: <h1>Hello!</h1><p>Welcome to our platform.</p>
 *               data:
 *                 type: object
 *                 description: Dynamic data for template placeholders
 *                 example: { name: "John Doe", company: "Example Corp" }
 *     responses:
 *       200:
 *         description: Email(s) sent successfully
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
 *                   example: Email(s) sent successfully
 *                 data:
 *                   type: null
 *                   example: null
 *       400:
 *         description: Bad request - Invalid input or missing required fields
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
 *                   example: Invalid input or missing required fields
 *       500:
 *         description: Internal server error
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
 *                   example: Internal server error
 */
router.post("/emails", EmailController_1.EmailController.sendEmail);
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
