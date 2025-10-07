import { Router } from "express";
import { authenticationMiddleware } from "../../middlewares/authentication";
import { errorHandler } from "../../lib/handlers/errorHandler";
import { Me, ProfileUpdate, VerifyProfileUpdateOtp } from "../../controllers/root";

const userRoutes = Router();

// Apply authentication middleware to all routes
userRoutes.use(errorHandler(authenticationMiddleware));

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
userRoutes.get("/me", errorHandler(Me));

// Update user profile (supports both PUT and PATCH)
userRoutes.route("/update").put(errorHandler(ProfileUpdate)).patch(errorHandler(ProfileUpdate));

// Verify OTP for profile update
userRoutes.post("/verify-update-otp", errorHandler(VerifyProfileUpdateOtp));

/**
 * @openapi
 * components:
 *   schemas:
 *     ProfileUpdateRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         firstName:
 *           type: string
 *           example: John
 *         lastName:
 *           type: string
 *           example: Doe
 *         name:
 *           type: string
 *           example: John Doe
 *         phoneNumber:
 *           type: string
 *           pattern: ^\+?[1-9]\d{1,14}$
 *           example: +12345678901
 *         avatar:
 *           type: string
 *           example: https://example.com/avatar.jpg
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           example: 1990-01-01
 *     ProfileResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             role:
 *               type: string
 *               enum: [CUSTOMER, VENDOR, DELIVERY_REP, DELIVERY_AGENT, MANAGER, SUPERVISOR, FINANCE_MANAGER, ADMIN, STAFF, SERVICE_REP]
 *             email:
 *               type: string
 *               format: email
 *               example: user@example.com
 *             password:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               description: Null for social accounts
 *             isSocialAccount:
 *               type: boolean
 *               example: false
 *             socialAccountProvider:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               enum: [FACEBOOK, GOOGLE, null]
 *               example: null
 *             firstName:
 *               type: string
 *               example: John
 *             lastName:
 *               type: string
 *               example: Doe
 *             name:
 *               type: string
 *               example: John Doe
 *             inviteCode:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               example: null
 *             publicKey:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               example: null
 *             address:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               example: null
 *             phoneNumber:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               example: +12345678901
 *             avatar:
 *               oneOf:
 *                 - type: string
 *                 - type: null
 *               example: null
 *             emailVerified:
 *               type: boolean
 *               example: true
 *             createdAt:
 *               type: string
 *               format: date-time
 *               example: 2025-06-25T12:20:00Z
 *             updatedAt:
 *               type: string
 *               format: date-time
 *               example: 2025-06-25T12:20:00Z
 *             profile:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 role:
 *                   type: string
 *                   enum: [CUSTOMER, VENDOR, DELIVERY_REP, DELIVERY_AGENT, MANAGER, SUPERVISOR, FINANCE_MANAGER, ADMIN, STAFF, SERVICE_REP]
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 deliveryReps:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 givenFeedback:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 receivedFeedback:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 vendor:
 *                   type: object
 *                   nullable: true
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 deliveryRepVendor:
 *                   type: object
 *                   nullable: true
 *                 servicesAsDeliveryRep:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 infractionsAsDeliveryRep:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 infractionsAsVendor:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 appealsAsVendor:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 serviceOrders:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *                 vendorWalletConfigs:
 *                   type: array
 *                   items:
 *                     type: object
 *                   nullable: true
 *             wallet:
 *               type: object
 *               nullable: true
 *             notificationPreferences:
 *               type: object
 *               nullable: true
 *             ratings:
 *               type: array
 *               items:
 *                 type: object
 *               nullable: true
 *         message:
 *           type: string
 *           example: Profile fetched successfully
 */

export { userRoutes };