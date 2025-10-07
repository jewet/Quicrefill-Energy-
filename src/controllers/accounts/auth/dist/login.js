"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.verifyMigrationOTP = exports.login = exports.LoginUserSchema = void 0;
var zod_1 = require("zod");
var root_1 = require("../../../exceptions/root");
var db_1 = require("../../../config/db");
var unauthorizedRequests_1 = require("../../../exceptions/unauthorizedRequests");
var bcryptjs_1 = require("bcryptjs");
var generateTokenPair_1 = require("../../../lib/utils/jwt/generateTokenPair");
var jwt_tokens_1 = require("../../../lib/storage/jwt_tokens");
var http_util_1 = require("../../../utils/http.util");
var winston_1 = require("winston");
var EventTypeDictionary_1 = require("../../../utils/EventTypeDictionary");
var client_1 = require("@prisma/client");
var emailQueue_1 = require("../../../queues/emailQueue");
var otp_1 = require("../../../lib/utils/mail/otp");
var uuid_1 = require("uuid");
// Logger setup
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1["default"].transports.File({ filename: "logs/combined.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
// Helper to determine contextRole
var determineContextRole = function (role, platform, migratedToVendor) {
    if (role === client_1.Role.VENDOR && platform === "app" && migratedToVendor) {
        return client_1.Role.DELIVERY_REP;
    }
    if (role === client_1.Role.DELIVERY_REP && platform === "web") {
        return client_1.Role.VENDOR;
    }
    return role;
};
// Role-specific onboarding email content
var getOnboardingEmailContent = function (role, name, platform) {
    var baseContent = "<p>Dear " + (name || "User") + ",</p>\n                       <p>Welcome to Quicrefill! We're excited to have you on board.</p>";
    var footer = "<p>Happy refilling!<br>Quicrefill Team</p>";
    switch (role) {
        case client_1.Role.CUSTOMER:
            return baseContent + "\n              <p>Explore our wide range of services on the Quicrefill app or website. Download the app for a seamless experience!</p>\n              " + footer;
        case client_1.Role.VENDOR:
            return baseContent + "\n              <p>Manage your business, track orders, and grow with Quicrefill. Access your Vendor Dashboard at <a href=\"https://vendor.quicrefill.com\">vendor.quicrefill.com</a>.</p>\n              <p>Use the mobile app to operate as a Delivery Rep for on-the-go tasks.</p>\n              " + footer;
        case client_1.Role.DELIVERY_REP:
            return baseContent + "\n              <p>Start delivering services with Quicrefill! Use the mobile app to register businesses and list services.</p>\n              <p>Upgrade to a Vendor account on the web dashboard for advanced features.</p>\n              " + footer;
        case client_1.Role.DELIVERY_AGENT:
            return baseContent + "\n              <p>Join our delivery team! Use the Quicrefill app to accept and complete delivery tasks efficiently.</p>\n              " + footer;
        case client_1.Role.MANAGER:
        case client_1.Role.SUPERVISOR:
        case client_1.Role.FINANCE_MANAGER:
        case client_1.Role.ADMIN:
            return baseContent + "\n              <p>Oversee operations and manage your team with Quicrefill's admin tools. Access the dashboard on the web for full control.</p>\n              " + footer;
        case client_1.Role.STAFF:
        case client_1.Role.SERVICE_REP:
            return baseContent + "\n              <p>Support our customers and vendors with Quicrefill's tools. Use the app or web dashboard to perform your tasks.</p>\n              " + footer;
        default:
            return baseContent + "\n              <p>Get started with Quicrefill by downloading our app or visiting our website.</p>\n              " + footer;
    }
};
// Login success email content
var getLoginSuccessEmailContent = function (name, platform, loginTime) {
    return "\n    <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;\">\n      <h2 style=\"color: #333; text-align: center;\">Quicrefill - Successful Login</h2>\n      <p style=\"color: #333; font-size: 16px;\">Dear " + (name || "User") + ",</p>\n      <p style=\"color: #333; font-size: 16px;\">You have successfully logged in to your Quicrefill account on our <strong>" + (platform.charAt(0).toUpperCase() + platform.slice(1)) + "</strong> platform at " + loginTime + " (WAT).</p>\n      <p style=\"color: #333; font-size: 16px;\">If you did not initiate this login, please secure your account by resetting your password and contact our support team immediately at <a href=\"mailto:support@quicrefill.com\" style=\"color: #007bff; text-decoration: none;\">support@quicrefill.com</a>.</p>\n      <p style=\"color: #333; font-size: 16px;\">Thank you for choosing Quicrefill!</p>\n      <p style=\"color: #333; font-size: 16px; margin-top: 20px;\">Best regards,<br>The Quicrefill Team</p>\n      <hr style=\"border-top: 1px solid #e0e0e0; margin: 20px 0;\">\n      <p style=\"color: #777; font-size: 12px; text-align: center;\">Quicrefill, Inc. | <a href=\"https://www.quicrefill.com\" style=\"color: #007bff; text-decoration: none;\">www.quicrefill.com</a></p>\n    </div>\n  ";
};
exports.LoginUserSchema = zod_1.z.object({
    email: zod_1.z.string().email({ message: "Invalid email format" }).optional(),
    phoneNumber: zod_1.z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" })
        .optional(),
    password: zod_1.z.string().min(6, { message: "Password must be at least 6 characters" })
}).refine(function (data) { return data.email || data.phoneNumber; }, {
    message: "Either email or phoneNumber must be provided",
    path: ["email", "phoneNumber"]
});
exports.login = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var start, validatedData, email, phoneNumber, password, queryStart, user, passwordStart, passwordMatch, platform, loginTime, otpStart, transactionReference, isFirstLogin, onboardingEmail, emailError_1, errorMessage, loginSuccessEmail, emailError_2, errorMessage, tokenStart, payload, token, redisStart, error_1, cookieStart, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 23, , 24]);
                start = Date.now();
                console.log("Login controller started:", req.body);
                logger.info("Login request URL: " + req.url + ", Query: " + JSON.stringify(req.query));
                // Validate request body
                console.log("Validating request body...");
                return [4 /*yield*/, exports.LoginUserSchema.parseAsync(req.body)];
            case 1:
                validatedData = _a.sent();
                email = validatedData.email, phoneNumber = validatedData.phoneNumber, password = validatedData.password;
                console.log("Validation passed:", { email: email, phoneNumber: phoneNumber });
                // Normalize inputs
                if (email)
                    email = email.toLowerCase();
                if (phoneNumber && !phoneNumber.startsWith("+")) {
                    phoneNumber = "+" + phoneNumber;
                }
                // Query user by email or phoneNumber
                console.log("Querying user...");
                queryStart = Date.now();
                return [4 /*yield*/, db_1.prismaClient.user.findFirst({
                        where: {
                            OR: [
                                email ? { email: email } : {},
                                phoneNumber ? { phoneNumber: phoneNumber } : {},
                            ].filter(Boolean)
                        },
                        include: {
                            profile: true
                        }
                    })];
            case 2:
                user = _a.sent();
                console.log("User query took " + (Date.now() - queryStart) + "ms");
                console.log("User query result:", user ? "Found" : "Not found");
                if (!user) {
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Incorrect email/phone number or password", root_1.AppErrorCode.USER_NOT_FOUND);
                }
                // Check password for non-social accounts
                console.log("Checking password...");
                passwordStart = Date.now();
                if (!!user.isSocialAccount) return [3 /*break*/, 4];
                if (!password) {
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Provide a password to authenticate this account", root_1.AppErrorCode.USER_NOT_FOUND);
                }
                return [4 /*yield*/, bcryptjs_1["default"].compare(password, user.password || "")];
            case 3:
                passwordMatch = _a.sent();
                console.log("Password verification took " + (Date.now() - passwordStart) + "ms");
                console.log("Password verification result:", passwordMatch ? "Success" : "Failure");
                if (!passwordMatch) {
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Incorrect email/phone number or password", root_1.AppErrorCode.USER_NOT_FOUND);
                }
                return [3 /*break*/, 5];
            case 4: throw new unauthorizedRequests_1.UnauthorizedRequest("Social account users must login via their provider", root_1.AppErrorCode.USER_NOT_FOUND);
            case 5:
                platform = typeof req.query.platform === "string" ? req.query.platform.toLowerCase() : "app";
                loginTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" });
                console.log("Platform detected:", { platform: platform, query: req.query });
                if (!(user.role === client_1.Role.DELIVERY_REP && platform === "web" && !user.migratedToVendor)) return [3 /*break*/, 8];
                console.log("Initiating OTP for DELIVERY_REP to VENDOR migration...");
                otpStart = Date.now();
                transactionReference = uuid_1.v4();
                // Generate and send OTP using EmailOtpService
                return [4 /*yield*/, otp_1.emailOtpService.generateAndSendOtp({
                        userId: user.id,
                        email: user.email,
                        medium: ["EMAIL"],
                        transactionReference: transactionReference,
                        eventType: EventTypeDictionary_1.KnownEventTypes.MIGRATION_VERIFICATION,
                        metadata: {
                            platform: platform,
                            action: "vendor migration"
                        }
                    })];
            case 6:
                // Generate and send OTP using EmailOtpService
                _a.sent();
                console.log("OTP generation took " + (Date.now() - otpStart) + "ms");
                logger.info("OTP generated", { userId: user.id, transactionReference: transactionReference, email: user.email });
                // Update last login time
                return [4 /*yield*/, db_1.prismaClient.user.update({
                        where: { id: user.id },
                        data: { lastLoginAt: new Date() }
                    })];
            case 7:
                // Update last login time
                _a.sent();
                // Send response requiring OTP verification without generating tokens
                console.log("Total login time: " + (Date.now() - start) + "ms");
                return [2 /*return*/, http_util_1.HttpResponse.success(res, { requiresMigration: true, transactionReference: transactionReference }, "Please verify OTP sent to your email to proceed with vendor migration.")];
            case 8: 
            // Update last login time
            return [4 /*yield*/, db_1.prismaClient.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() }
                })];
            case 9:
                // Update last login time
                _a.sent();
                isFirstLogin = !user.lastLoginAt;
                if (!(isFirstLogin && !(user.role === client_1.Role.DELIVERY_REP && platform === "web"))) return [3 /*break*/, 13];
                onboardingEmail = {
                    eventType: EventTypeDictionary_1.KnownEventTypes.USER_REGISTRATION,
                    customPayload: {
                        to: user.email,
                        from: "noreply@quicrefill.com",
                        subject: "Welcome to Quicrefill, " + (user.name || "User") + "!",
                        htmlContent: getOnboardingEmailContent(user.role, user.name, platform)
                    },
                    metadata: {
                        userId: user.id,
                        name: user.name || "User",
                        email: user.email,
                        role: user.role,
                        contextRole: determineContextRole(user.role, platform, user.migratedToVendor),
                        platform: platform
                    }
                };
                _a.label = 10;
            case 10:
                _a.trys.push([10, 12, , 13]);
                return [4 /*yield*/, emailQueue_1.addEmailJob(onboardingEmail)];
            case 11:
                _a.sent();
                logger.info("Onboarding email queued", { email: user.email, role: user.role });
                return [3 /*break*/, 13];
            case 12:
                emailError_1 = _a.sent();
                errorMessage = emailError_1 instanceof Error ? emailError_1.message : "Unknown error";
                logger.error("Failed to queue onboarding email", { email: user.email, role: user.role, error: errorMessage });
                return [3 /*break*/, 13];
            case 13:
                loginSuccessEmail = {
                    eventType: EventTypeDictionary_1.KnownEventTypes.LOGIN_SUCCESS,
                    customPayload: {
                        to: user.email,
                        from: "noreply@quicrefill.com",
                        subject: "Successful Login to Quicrefill",
                        htmlContent: getLoginSuccessEmailContent(user.name, platform, loginTime)
                    },
                    metadata: {
                        userId: user.id,
                        name: user.name || "User",
                        email: user.email,
                        role: user.role,
                        contextRole: determineContextRole(user.role, platform, user.migratedToVendor),
                        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                        loginTime: loginTime
                    }
                };
                _a.label = 14;
            case 14:
                _a.trys.push([14, 16, , 17]);
                return [4 /*yield*/, emailQueue_1.addEmailJob(loginSuccessEmail)];
            case 15:
                _a.sent();
                logger.info("Login success email queued", { email: user.email, role: user.role });
                return [3 /*break*/, 17];
            case 16:
                emailError_2 = _a.sent();
                errorMessage = emailError_2 instanceof Error ? emailError_2.message : "Unknown error";
                logger.error("Failed to queue login success email", { email: user.email, role: user.role, error: errorMessage });
                return [3 /*break*/, 17];
            case 17:
                // Generate token pair
                console.log("Generating token pair...");
                tokenStart = Date.now();
                payload = {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    contextRole: determineContextRole(user.role, platform, user.migratedToVendor)
                };
                console.log("Token payload:", payload);
                return [4 /*yield*/, generateTokenPair_1.generateTokenPair(payload)];
            case 18:
                token = _a.sent();
                console.log("Token generation took " + (Date.now() - tokenStart) + "ms");
                console.log("Token generated:", token);
                // Store access token in Redis
                console.log("Storing access token in Redis...");
                redisStart = Date.now();
                _a.label = 19;
            case 19:
                _a.trys.push([19, 21, , 22]);
                return [4 /*yield*/, jwt_tokens_1.storeAccessToken(token.accessToken, user.id)];
            case 20:
                _a.sent();
                console.log("Access token storage took " + (Date.now() - redisStart) + "ms");
                console.log("Access token stored for user:", user.id);
                return [3 /*break*/, 22];
            case 21:
                error_1 = _a.sent();
                console.error("Error storing access token:", error_1);
                throw new Error("Failed to store access token");
            case 22:
                // Set token in cookies
                console.log("Setting cookie...");
                cookieStart = Date.now();
                res.cookie("token", token.accessToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict"
                });
                console.log("Cookie setting took " + (Date.now() - cookieStart) + "ms");
                // Send response
                console.log("Total login time: " + (Date.now() - start) + "ms");
                return [2 /*return*/, http_util_1.HttpResponse.success(res, { token: token }, "Login successful")];
            case 23:
                error_2 = _a.sent();
                console.error("Login error:", error_2);
                logger.error("Login error", { error: error_2 instanceof Error ? error_2.message : "Unknown error" });
                next(error_2);
                return [3 /*break*/, 24];
            case 24: return [2 /*return*/];
        }
    });
}); };
exports.verifyMigrationOTP = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var VerifyMigrationOTPSchema, _a, email, transactionReference, otp, user_1, otpStart, platform_1, migrationStart, tokenStart, payload, token, redisStart, error_3, cookieStart, migrationEmail, emailError_3, errorMessage, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 14, , 15]);
                logger.info("Verify migration OTP request URL: " + req.url + ", Query: " + JSON.stringify(req.query));
                VerifyMigrationOTPSchema = zod_1.z.object({
                    email: zod_1.z.string().email({ message: "Invalid email format" }),
                    transactionReference: zod_1.z.string().uuid({ message: "Invalid transaction reference" }),
                    otp: zod_1.z.string().length(6, { message: "OTP must be 6 digits" })
                });
                return [4 /*yield*/, VerifyMigrationOTPSchema.parseAsync(req.body)];
            case 1:
                _a = _b.sent(), email = _a.email, transactionReference = _a.transactionReference, otp = _a.otp;
                return [4 /*yield*/, db_1.prismaClient.user.findFirst({
                        where: { email: email.toLowerCase() },
                        include: { profile: true }
                    })];
            case 2:
                user_1 = _b.sent();
                if (!user_1 || user_1.role !== client_1.Role.DELIVERY_REP || user_1.migratedToVendor) {
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User not eligible for vendor migration", root_1.AppErrorCode.UNAUTHORIZED);
                }
                // Verify OTP
                console.log("Verifying OTP...");
                otpStart = Date.now();
                return [4 /*yield*/, otp_1.emailOtpService.verifyOtp(transactionReference, otp)];
            case 3:
                _b.sent();
                console.log("OTP verification took " + (Date.now() - otpStart) + "ms");
                logger.info("OTP verified for migration", { userId: user_1.id, transactionReference: transactionReference, email: email });
                platform_1 = typeof req.query.platform === "string" ? req.query.platform.toLowerCase() : "app";
                console.log("Performing migration for user:", { userId: user_1.id, platform: platform_1 });
                migrationStart = Date.now();
                return [4 /*yield*/, db_1.prismaClient.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // Update User to VENDOR role
                                return [4 /*yield*/, tx.user.update({
                                        where: { id: user_1.id },
                                        data: {
                                            role: "VENDOR",
                                            migratedToVendor: true,
                                            migrationDate: new Date(),
                                            webAccessGranted: true,
                                            webAccessGrantedAt: new Date()
                                        }
                                    })];
                                case 1:
                                    // Update User to VENDOR role
                                    _a.sent();
                                    if (!user_1.profile) return [3 /*break*/, 3];
                                    return [4 /*yield*/, tx.profile.update({
                                            where: { id: user_1.profile.id },
                                            data: { role: "VENDOR", isWebEnabled: true, webEnabledAt: new Date() }
                                        })];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3: 
                                // Reassign Services
                                return [4 /*yield*/, tx.service.updateMany({
                                        where: { deliveryRepId: user_1.id },
                                        data: { vendorId: user_1.id, deliveryRepId: null }
                                    })];
                                case 4:
                                    // Reassign Services
                                    _a.sent();
                                    // Log migration audit
                                    return [4 /*yield*/, tx.auditLog.create({
                                            data: {
                                                userId: user_1.id,
                                                action: "MIGRATE_DELIVERY_REP_TO_VENDOR",
                                                entityType: "USER",
                                                entityId: user_1.id,
                                                details: { fromRole: "DELIVERY_REP", toRole: "VENDOR", platform: platform_1 }
                                            }
                                        })];
                                case 5:
                                    // Log migration audit
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 4:
                _b.sent();
                logger.info("DELIVERY_REP migrated to VENDOR", { userId: user_1.id });
                console.log("Migration took " + (Date.now() - migrationStart) + "ms");
                // Generate token pair after migration
                console.log("Generating token pair...");
                tokenStart = Date.now();
                payload = {
                    userId: user_1.id,
                    email: user_1.email,
                    role: client_1.Role.VENDOR,
                    contextRole: determineContextRole(client_1.Role.VENDOR, platform_1, true)
                };
                console.log("Token payload:", payload);
                return [4 /*yield*/, generateTokenPair_1.generateTokenPair(payload)];
            case 5:
                token = _b.sent();
                console.log("Token generation took " + (Date.now() - tokenStart) + "ms");
                console.log("Token generated:", token);
                // Store access token in Redis
                console.log("Storing access token in Redis...");
                redisStart = Date.now();
                _b.label = 6;
            case 6:
                _b.trys.push([6, 8, , 9]);
                return [4 /*yield*/, jwt_tokens_1.storeAccessToken(token.accessToken, user_1.id)];
            case 7:
                _b.sent();
                console.log("Access token storage took " + (Date.now() - redisStart) + "ms");
                console.log("Access token stored for user:", user_1.id);
                return [3 /*break*/, 9];
            case 8:
                error_3 = _b.sent();
                console.error("Error storing access token:", error_3);
                throw new Error("Failed to store access token");
            case 9:
                // Set token in cookies
                console.log("Setting cookie...");
                cookieStart = Date.now();
                res.cookie("token", token.accessToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict"
                });
                console.log("Cookie setting took " + (Date.now() - cookieStart) + "ms");
                migrationEmail = {
                    eventType: EventTypeDictionary_1.KnownEventTypes.MIGRATION_VERIFICATION,
                    customPayload: {
                        to: user_1.email,
                        from: "noreply@quicrefill.com",
                        subject: "Your Quicrefill Vendor Dashboard is Ready!",
                        htmlContent: "\n          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;\">\n            <h2 style=\"color: #333; text-align: center;\">Quicrefill - Vendor Account Upgrade</h2>\n            <p style=\"color: #333; font-size: 16px;\">Dear " + (user_1.name || "Vendor") + ",</p>\n            <p style=\"color: #333; font-size: 16px;\">Your account has been successfully upgraded from Delivery Rep to Vendor!</p>\n            <p style=\"color: #333; font-size: 16px;\">Access your new Vendor Dashboard at <a href=\"https://vendor.quicrefill.com\" style=\"color: #007bff; text-decoration: none;\">vendor.quicrefill.com</a> to manage multiple businesses, track orders, and assign riders.</p>\n            <p style=\"color: #333; font-size: 16px;\">On the mobile app, you can continue to operate as a Delivery Rep for tasks like registering businesses and listing services.</p>\n            <p style=\"color: #333; font-size: 16px;\">Contact our support team at <a href=\"mailto:support@quicrefill.com\" style=\"color: #007bff; text-decoration: none;\">support@quicrefill.com</a> for assistance.</p>\n            <p style=\"color: #333; font-size: 16px; margin-top: 20px;\">Best wishes,<br>The Quicrefill Team</p>\n            <hr style=\"border-top: 1px solid #e0e0e0; margin: 20px 0;\">\n            <p style=\"color: #777; font-size: 12px; text-align: center;\">Quicrefill, Inc. | <a href=\"https://www.quicrefill.com\" style=\"color: #007bff; text-decoration: none;\">www.quicrefill.com</a></p>\n          </div>\n        "
                    },
                    metadata: {
                        userId: user_1.id,
                        name: user_1.name || "Vendor",
                        email: user_1.email,
                        role: client_1.Role.VENDOR,
                        contextRole: determineContextRole(client_1.Role.VENDOR, platform_1, true),
                        platform: platform_1
                    }
                };
                _b.label = 10;
            case 10:
                _b.trys.push([10, 12, , 13]);
                console.log("Queuing migration email:", {
                    to: migrationEmail.customPayload.to,
                    subject: migrationEmail.customPayload.subject,
                    eventType: migrationEmail.eventType
                });
                return [4 /*yield*/, emailQueue_1.addEmailJob(migrationEmail)];
            case 11:
                _b.sent();
                logger.info("Vendor migration email queued successfully", {
                    email: user_1.email,
                    userId: user_1.id,
                    transactionReference: transactionReference
                });
                return [3 /*break*/, 13];
            case 12:
                emailError_3 = _b.sent();
                errorMessage = emailError_3 instanceof Error ? emailError_3.message : "Unknown error";
                console.error("Failed to queue migration email:", errorMessage);
                logger.error("Failed to queue vendor migration email", {
                    email: user_1.email,
                    userId: user_1.id,
                    transactionReference: transactionReference,
                    error: errorMessage,
                    stack: emailError_3 instanceof Error ? emailError_3.stack : undefined
                });
                return [3 /*break*/, 13];
            case 13: 
            // Send response
            return [2 /*return*/, http_util_1.HttpResponse.success(res, { token: token }, "Vendor migration completed successfully. You can now access the Vendor Dashboard.")];
            case 14:
                error_4 = _b.sent();
                console.error("Verify migration OTP error:", error_4);
                logger.error("Verify migration OTP error", {
                    error: error_4 instanceof Error ? error_4.message : "Unknown error",
                    stack: error_4 instanceof Error ? error_4.stack : undefined
                });
                next(error_4);
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/];
        }
    });
}); };
