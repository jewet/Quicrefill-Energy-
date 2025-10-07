"use strict";
exports.__esModule = true;
var express_1 = require("express");
var emailController_1 = require("../../controllers/email/emailController");
var authentication_1 = require("../../middlewares/authentication");
var emailRoutes = express_1["default"].Router();
/**
 * @swagger
 * tags:
 *   name: Email
 *   description: Email template management and email sending API for admin users
 */
/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Create a new email template
 *     description: Creates a new email template with a name, subject, and HTML content. Requires admin authentication to track the user who created the template.
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
 *         description: Bad request - Missing required fields
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
emailRoutes.post("/templates", authentication_1.authenticateAdmin, emailController_1.emailController.createTemplate.bind(emailController_1.emailController));
/**
 * @swagger
 * /api/templates/{id}:
 *   put:
 *     summary: Update an existing email template
 *     description: Updates an email template by ID with partial data. Requires admin authentication to track the user who updated the template.
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
emailRoutes.put("/templates/:id", authentication_1.authenticateAdmin, emailController_1.emailController.updateTemplate.bind(emailController_1.emailController));
/**
 * @swagger
 * /api/templates/{id}:
 *   delete:
 *     summary: Delete an email template
 *     description: Deletes an email template by ID. Requires admin authentication to track the user who deleted the template.
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
 *                   example: Template deleted
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
emailRoutes["delete"]("/templates/:id", authentication_1.authenticateAdmin, emailController_1.emailController.deleteTemplate.bind(emailController_1.emailController));
/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: Retrieve all email templates
 *     description: Retrieves a list of all email templates. Requires admin authentication.
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
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
emailRoutes.get("/templates", authentication_1.authenticateAdmin, emailController_1.emailController.getTemplates.bind(emailController_1.emailController));
/**
 * @swagger
 * /api/send:
 *   post:
 *     summary: Send email(s)
 *     description: Sends one or more emails using a template or custom content. Supports bulk email sending with dynamic data replacement. Requires admin authentication.
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
emailRoutes.post("/send", authentication_1.authenticateAdmin, emailController_1.emailController.sendEmail.bind(emailController_1.emailController));
exports["default"] = emailRoutes;
