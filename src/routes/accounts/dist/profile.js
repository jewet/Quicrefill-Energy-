"use strict";
exports.__esModule = true;
exports.userRoutes = void 0;
var express_1 = require("express");
var authentication_1 = require("../../middlewares/authentication");
var errorHandler_1 = require("../../lib/handlers/errorHandler");
var root_1 = require("../../controllers/root");
var userRoutes = express_1.Router();
exports.userRoutes = userRoutes;
// Apply authentication middleware to all routes
userRoutes.use(errorHandler_1.errorHandler(authentication_1.authenticationMiddleware));
/**
 * @openapi
 * tags:
 *   name: User Profile
 *   description: User profile management endpoints under /accounts/profile
 */
/**
 * @openapi
 * /accounts/profile/me:
 *   get:
 *     summary: Fetch user profile details
 *     description: Retrieves the full profile details of the authenticated user, including role-specific data. For DELIVERY_REP users on the web platform, automatically migrates to VENDOR role if not already migrated.
 *     operationId: fetchUserProfile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: platform
 *         in: query
 *         description: Platform the request originates from (e.g., 'app' or 'web')
 *         required: false
 *         schema:
 *           type: string
 *           enum: [app, web]
 *           default: app
 *     responses:
 *       '200':
 *         description: Profile details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileResponse'
 *       '401':
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @openapi
 * /accounts/profile/update:
 *   patch:
 *     summary: Update user profile
 *     description: Updates the authenticated user's profile details such as name, email, phone number, or avatar. If the email is changed, an OTP is sent for verification, and the update is completed only after OTP verification.
 *     operationId: updateUserProfile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: platform
 *         in: query
 *         description: Platform the request originates from (e.g., 'app' or 'web')
 *         required: false
 *         schema:
 *           type: string
 *           enum: [app, web]
 *           default: app
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdateRequest'
 *     responses:
 *       '200':
 *         description: Profile updated successfully or OTP sent for email verification
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/ProfileResponse'
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     data:
 *                       type: object
 *                       properties:
 *                         transactionReference:
 *                           type: string
 *                           format: uuid
 *                           example: 123e4567-e89b-12d3-a456-426614174000
 *                     message:
 *                       type: string
 *                       example: OTP sent to new email. Please verify to complete profile update.
 *       '400':
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       '401':
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Unprocessable entity (e.g., user not found, invalid role)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
/**
 * @openapi
 * /accounts/profile/verify-update-otp:
 *   post:
 *     summary: Verify OTP for profile update
 *     description: Verifies the OTP sent for an email change during a profile update and completes the profile update process.
 *     operationId: verifyProfileUpdateOtp
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: platform
 *         in: query
 *         description: Platform the request originates from (e.g., 'app' or 'web')
 *         required: false
 *         schema:
 *           type: string
 *           enum: [app, web]
 *           default: app
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionReference
 *               - otpCode
 *             properties:
 *               transactionReference:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               otpCode:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       '200':
 *         description: Profile updated successfully after OTP verification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProfileResponse'
 *       '400':
 *         description: Invalid OTP or transaction reference
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       '401':
 *         description: Unauthorized - Invalid or missing token, or user mismatch
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '422':
 *         description: Unprocessable entity (e.g., pending update not found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
// Fetch user profile details
userRoutes.get("/me", errorHandler_1.errorHandler(root_1.Me));
// Update user profile (supports both PUT and PATCH)
userRoutes.route("/update").put(errorHandler_1.errorHandler(root_1.ProfileUpdate)).patch(errorHandler_1.errorHandler(root_1.ProfileUpdate));
// Verify OTP for profile update
userRoutes.post("/verify-update-otp", errorHandler_1.errorHandler(root_1.VerifyProfileUpdateOtp));
