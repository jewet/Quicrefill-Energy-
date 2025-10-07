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
exports.VerifyAccountDeletionOtp = exports.RequestAccountDeletion = void 0;
var root_1 = require("../../../exceptions/root");
var validation_1 = require("../../../exceptions/validation");
var zod_1 = require("zod");
var __1 = require("../../../");
var unauthorizedRequests_1 = require("../../../exceptions/unauthorizedRequests");
var otp_1 = require("../../../lib/utils/mail/otp");
var uuid_1 = require("uuid");
var email_1 = require("../../../services/email");
var http_util_1 = require("../../../utils/http.util");
var winston_1 = require("winston");
var client_1 = require("@prisma/client");
var EventTypeDictionary_1 = require("../../../utils/EventTypeDictionary");
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
// Helper function to add a timeout to a promise
var withTimeout = function (promise, ms) {
    var timeout = new Promise(function (_, reject) {
        return setTimeout(function () { return reject(new Error("Operation timed out after " + ms + "ms")); }, ms);
    });
    return Promise.race([promise, timeout]);
};
// Helper to determine contextRole
var determineContextRole = function (role, platform) {
    if (role === client_1.Role.VENDOR && platform === "app") {
        return client_1.Role.DELIVERY_REP;
    }
    if (role === client_1.Role.VENDOR && platform === "web") {
        return client_1.Role.VENDOR;
    }
    return role;
};
// RequestAccountDeletion controller
exports.RequestAccountDeletion = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var platform, authUser, platformRaw, schema, validatedData, email_2, reason, user_1, transactionReference, contextRole, isVendorOrRep, emailContent, emailError_1, errorMessage, error_1, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                platform = "app";
                _a.label = 1;
            case 1:
                _a.trys.push([1, 10, , 11]);
                console.log("Starting account deletion OTP request for email:", req.body.email);
                authUser = req.user;
                if (!authUser) {
                    logger.warn("No authenticated user found for account deletion request", {
                        email: req.body.email,
                        ip: req.ip,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Unauthorized: No authenticated user", root_1.AppErrorCode.UNAUTHORIZED);
                }
                if (authUser.email !== req.body.email) {
                    logger.warn("Unauthorized account deletion attempt: Email mismatch", {
                        authUserEmail: authUser.email,
                        requestedEmail: req.body.email,
                        authUserId: authUser.id,
                        ip: req.ip,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Unauthorized: Email does not match authenticated user", root_1.AppErrorCode.UNAUTHORIZED);
                }
                platformRaw = req.query.platform;
                if (typeof platformRaw === "string") {
                    platform = platformRaw;
                }
                else if (platformRaw) {
                    logger.warn("Invalid platform query parameter", {
                        platformRaw: platformRaw,
                        ip: req.ip,
                        platform: platform
                    });
                }
                schema = zod_1.z.object({
                    email: zod_1.z.string().email({ message: "Invalid email format" }),
                    reason: zod_1.z.string().optional()
                });
                return [4 /*yield*/, schema.parseAsync(req.body)["catch"](function (err) {
                        logger.error("Validation error in account deletion OTP request", {
                            errors: err.issues,
                            email: req.body.email,
                            ip: req.ip,
                            platform: platform
                        });
                        throw new validation_1.UnprocessableEntity("Invalid input format", root_1.AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
                    })];
            case 2:
                validatedData = _a.sent();
                email_2 = validatedData.email, reason = validatedData.reason;
                console.log("Input validated:", email_2);
                return [4 /*yield*/, withTimeout(__1.prismaClient.user.findUnique({
                        where: { email: email_2 },
                        include: { accountDeletionRequest: true }
                    }), 5000)["catch"](function (dbError) {
                        var errorMessage = dbError instanceof Error ? dbError.message : "Unknown error";
                        logger.error("Database query failed", {
                            email: email_2,
                            error: errorMessage,
                            platform: platform
                        });
                        throw new Error("Failed to query user from database");
                    })];
            case 3:
                user_1 = _a.sent();
                if (!user_1) {
                    logger.warn("User not found for account deletion OTP request", {
                        email: email_2,
                        ip: req.ip,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User does not exist", root_1.AppErrorCode.USER_DOES_NOT_EXIST);
                }
                console.log("User query completed, user found:", user_1.id);
                if (user_1.accountDeletionRequest &&
                    (user_1.accountDeletionRequest.status === "PENDING" ||
                        user_1.accountDeletionRequest.status === "UNDER_REVIEW")) {
                    logger.warn("Active account deletion request already exists", {
                        userId: user_1.id,
                        email: email_2,
                        deletionRequestId: user_1.accountDeletionRequest.id,
                        status: user_1.accountDeletionRequest.status,
                        platform: platform
                    });
                    throw new validation_1.UnprocessableEntity("An active account deletion request already exists", root_1.AppErrorCode.DUPLICATE_DELETION_REQUEST, { deletionRequestId: user_1.accountDeletionRequest.id, status: user_1.accountDeletionRequest.status });
                }
                transactionReference = uuid_1.v4();
                console.log("Generating and sending OTP for email:", email_2, "with transactionReference:", transactionReference);
                return [4 /*yield*/, withTimeout(otp_1.emailOtpService.generateAndSendOtp({
                        userId: user_1.id,
                        email: email_2,
                        medium: ["EMAIL"],
                        transactionReference: transactionReference,
                        eventType: EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST
                    }), 10000)["catch"](function (otpError) {
                        var errorMessage = otpError instanceof Error ? otpError.message : "Unknown error";
                        logger.error("Failed to generate and send OTP", {
                            userId: user_1.id,
                            email: email_2,
                            error: errorMessage,
                            platform: platform
                        });
                        throw new Error("Failed to send OTP, please try again");
                    })];
            case 4:
                _a.sent();
                console.log("OTP sent successfully");
                contextRole = determineContextRole(user_1.role, platform);
                return [4 /*yield*/, __1.prismaClient.auditLog.create({
                        data: {
                            userId: user_1.id,
                            action: "ACCOUNT_DELETION_OTP_REQUESTED",
                            entityType: "USER",
                            entityId: user_1.id,
                            details: {
                                platform: platform,
                                contextRole: contextRole,
                                email: email_2,
                                role: user_1.role,
                                ip: req.ip,
                                reason: reason || null,
                                transactionReference: transactionReference
                            },
                            createdAt: new Date()
                        }
                    })];
            case 5:
                _a.sent();
                console.log("Audit log created for account deletion OTP request");
                _a.label = 6;
            case 6:
                _a.trys.push([6, 8, , 9]);
                isVendorOrRep = user_1.role === client_1.Role.VENDOR || user_1.role === client_1.Role.DELIVERY_REP;
                emailContent = isVendorOrRep
                    ? "<p>Dear " + (user_1.name || "User") + ",</p>\n           <p>We have received your request to delete your Quicrefill account (" + user_1.role + "). An OTP has been sent to your email to verify this request.</p>\n           <p>Please check your inbox (and spam/junk folder) for the OTP and enter it in the Quicrefill app or website to confirm your account deletion request.</p>\n           <p>If you were using the delivery app as a Delivery Rep or accessing the Vendor dashboard at <a href=\"https://vendor.quicrefill.com\">vendor.quicrefill.com</a>, access will remain active until the request is approved.</p>\n           " + (reason ? "<p><strong>Reason provided:</strong> " + reason + "</p>" : "") + "\n           <p>If you did not initiate this request, please contact support at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a> immediately.</p>\n           <p>Best regards,<br>Quicrefill Team</p>"
                    : "<p>Dear " + (user_1.name || "User") + ",</p>\n           <p>We have received your request to delete your Quicrefill account (" + user_1.role + "). An OTP has been sent to your email to verify this request.</p>\n           <p>Please check your inbox (and spam/junk folder) for the OTP and enter it in the Quicrefill app or website to confirm your account deletion request.</p>\n           " + (reason ? "<p><strong>Reason provided:</strong> " + reason + "</p>" : "") + "\n           <p>If you did not initiate this request, please contact support at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a> immediately.</p>\n           <p>Best regards,<br>Quicrefill Team</p>";
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST,
                        customPayload: {
                            to: user_1.email,
                            subject: "Account Deletion Request Received",
                            htmlContent: emailContent
                        },
                        metadata: {
                            userId: user_1.id,
                            name: user_1.name || "User",
                            email: user_1.email,
                            role: user_1.role,
                            contextRole: contextRole,
                            platform: platform,
                            reason: reason || null,
                            transactionReference: transactionReference
                        }
                    })];
            case 7:
                _a.sent();
                logger.info("Account deletion confirmation email sent", {
                    userId: user_1.id,
                    email: email_2,
                    platform: platform,
                    transactionReference: transactionReference
                });
                return [3 /*break*/, 9];
            case 8:
                emailError_1 = _a.sent();
                errorMessage = emailError_1 instanceof Error ? emailError_1.message : "Unknown error";
                logger.error("Failed to send account deletion confirmation email", {
                    userId: user_1.id,
                    email: email_2,
                    error: errorMessage,
                    platform: platform,
                    transactionReference: transactionReference
                });
                return [3 /*break*/, 9];
            case 9:
                http_util_1.HttpResponse.success(res, { transactionReference: transactionReference }, "OTP sent to " + (user_1.name || "User") + " on " + email_2 + " to verify account deletion request");
                return [3 /*break*/, 11];
            case 10:
                error_1 = _a.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("Error in RequestAccountDeletion", {
                    email: req.body.email || "unknown",
                    error: errorMessage,
                    ip: req.ip || "unknown",
                    platform: platform
                });
                next(error_1);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); };
// VerifyAccountDeletionOtp controller
exports.VerifyAccountDeletionOtp = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var platform, authUser_1, platformRaw, schema, validatedData, transactionReference_1, code, otpVerification, user, auditLog, reason, details, existingDeletionRequest, accountDeletionRequest, contextRole, isVendorOrRep, emailContent, emailError_2, errorMessage, error_2, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                platform = "app";
                _b.label = 1;
            case 1:
                _b.trys.push([1, 13, , 14]);
                console.log("Starting account deletion OTP verification for transactionReference:", req.body.transactionReference);
                authUser_1 = req.user;
                if (!authUser_1) {
                    logger.warn("No authenticated user found for OTP verification", {
                        transactionReference: req.body.transactionReference,
                        ip: req.ip,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Unauthorized: No authenticated user", root_1.AppErrorCode.UNAUTHORIZED);
                }
                platformRaw = req.query.platform;
                if (typeof platformRaw === "string") {
                    platform = platformRaw;
                }
                else if (platformRaw) {
                    logger.warn("Invalid platform query parameter", {
                        platformRaw: platformRaw,
                        ip: req.ip,
                        platform: platform
                    });
                }
                schema = zod_1.z.object({
                    transactionReference: zod_1.z.string().uuid({ message: "Invalid transaction reference format" }),
                    code: zod_1.z.string().length(6, { message: "OTP code must be 6 digits" }).regex(/^\d{6}$/, { message: "OTP code must be numeric" })
                });
                return [4 /*yield*/, schema.parseAsync(req.body)["catch"](function (err) {
                        logger.error("Validation error in account deletion OTP verification", {
                            errors: err.issues,
                            transactionReference: req.body.transactionReference,
                            ip: req.ip,
                            platform: platform
                        });
                        throw new validation_1.UnprocessableEntity("Invalid input format", root_1.AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
                    })];
            case 2:
                validatedData = _b.sent();
                transactionReference_1 = validatedData.transactionReference, code = validatedData.code;
                console.log("Input validated:", transactionReference_1);
                return [4 /*yield*/, withTimeout(otp_1.emailOtpService.verifyOtp(transactionReference_1, code), 5000)["catch"](function (otpError) {
                        var errorMessage = otpError instanceof Error ? otpError.message : "Unknown error";
                        logger.error("Failed to verify OTP", {
                            transactionReference: transactionReference_1,
                            error: errorMessage,
                            platform: platform
                        });
                        throw new validation_1.UnprocessableEntity("OTP verification failed: " + errorMessage, root_1.AppErrorCode.INVALID_OTP, { error: errorMessage });
                    })];
            case 3:
                otpVerification = _b.sent();
                console.log("OTP verified successfully:", otpVerification);
                if (otpVerification.eventType !== EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST) {
                    logger.warn("Invalid OTP event type for account deletion", {
                        transactionReference: transactionReference_1,
                        eventType: otpVerification.eventType,
                        userId: authUser_1.id,
                        platform: platform
                    });
                    throw new validation_1.UnprocessableEntity("OTP is not valid for account deletion request", root_1.AppErrorCode.INVALID_OTP, { eventType: otpVerification.eventType });
                }
                if (otpVerification.userId !== authUser_1.id) {
                    logger.warn("User ID mismatch in OTP verification", {
                        transactionReference: transactionReference_1,
                        otpUserId: otpVerification.userId,
                        authUserId: authUser_1.id,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Unauthorized: OTP does not belong to this user", root_1.AppErrorCode.UNAUTHORIZED);
                }
                return [4 /*yield*/, withTimeout(__1.prismaClient.user.findUnique({
                        where: { id: authUser_1.id },
                        select: { id: true, email: true, name: true, role: true }
                    }), 5000)["catch"](function (dbError) {
                        var errorMessage = dbError instanceof Error ? dbError.message : "Unknown error";
                        logger.error("Database query failed", {
                            userId: authUser_1.id,
                            error: errorMessage,
                            platform: platform
                        });
                        throw new Error("Failed to query user from database");
                    })];
            case 4:
                user = _b.sent();
                if (!user) {
                    logger.warn("User not found for OTP verification", {
                        userId: authUser_1.id,
                        transactionReference: transactionReference_1,
                        ip: req.ip,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User does not exist", root_1.AppErrorCode.USER_DOES_NOT_EXIST);
                }
                return [4 /*yield*/, __1.prismaClient.auditLog.findFirst({
                        where: {
                            userId: authUser_1.id,
                            action: "ACCOUNT_DELETION_OTP_REQUESTED",
                            details: { path: ["transactionReference"], equals: transactionReference_1 }
                        },
                        select: { details: true }
                    })];
            case 5:
                auditLog = _b.sent();
                reason = void 0;
                if (auditLog === null || auditLog === void 0 ? void 0 : auditLog.details) {
                    details = auditLog.details;
                    reason = (_a = details.reason) !== null && _a !== void 0 ? _a : undefined;
                }
                console.log("Reason fetched from audit log:", reason);
                return [4 /*yield*/, __1.prismaClient.accountDeletionRequest.findUnique({
                        where: { userId: user.id }
                    })];
            case 6:
                existingDeletionRequest = _b.sent();
                if (existingDeletionRequest &&
                    (existingDeletionRequest.status === "PENDING" || existingDeletionRequest.status === "UNDER_REVIEW")) {
                    logger.warn("Active account deletion request already exists", {
                        userId: user.id,
                        deletionRequestId: existingDeletionRequest.id,
                        status: existingDeletionRequest.status,
                        platform: platform
                    });
                    throw new validation_1.UnprocessableEntity("An active account deletion request already exists", root_1.AppErrorCode.DUPLICATE_DELETION_REQUEST, { deletionRequestId: existingDeletionRequest.id, status: existingDeletionRequest.status });
                }
                return [4 /*yield*/, __1.prismaClient.accountDeletionRequest.create({
                        data: {
                            userId: user.id,
                            reason: reason || null,
                            status: client_1.AccountDeletionStatus.PENDING,
                            requestedAt: new Date(),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    })];
            case 7:
                accountDeletionRequest = _b.sent();
                console.log("Account deletion request created:", accountDeletionRequest.id);
                contextRole = determineContextRole(user.role, platform);
                return [4 /*yield*/, __1.prismaClient.auditLog.create({
                        data: {
                            userId: user.id,
                            action: "ACCOUNT_DELETION_REQUESTED",
                            entityType: "ACCOUNT_DELETION_REQUEST",
                            entityId: uuid_1.v4(),
                            details: {
                                platform: platform,
                                contextRole: contextRole,
                                email: user.email,
                                role: user.role,
                                ip: req.ip,
                                reason: reason || null,
                                transactionReference: transactionReference_1,
                                deletionRequestId: accountDeletionRequest.id
                            },
                            createdAt: new Date()
                        }
                    })];
            case 8:
                _b.sent();
                console.log("Audit log created for account deletion request");
                _b.label = 9;
            case 9:
                _b.trys.push([9, 11, , 12]);
                isVendorOrRep = user.role === client_1.Role.VENDOR || user.role === client_1.Role.DELIVERY_REP;
                emailContent = isVendorOrRep
                    ? "<p>Dear " + (user.name || "User") + ",</p>\n           <p>Your request to delete your Quicrefill account (" + user.role + ") has been received and is now pending review.</p>\n           <p>We will process your request within 7 business days. If approved, your account will be permanently deleted, and you will receive a confirmation email.</p>\n           <p>If you were using the delivery app as a Delivery Rep or accessing the Vendor dashboard at <a href=\"https://vendor.quicrefill.com\">vendor.quicrefill.com</a>, access will remain active until the request is approved.</p>\n           " + (reason ? "<p><strong>Reason provided:</strong> " + reason + "</p>" : "") + "\n           <p>If you did not initiate this request or wish to cancel it, please contact support at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a> immediately.</p>\n           <p>Best regards,<br>Quicrefill Team</p>"
                    : "<p>Dear " + (user.name || "User") + ",</p>\n           <p>Your request to delete your Quicrefill account (" + user.role + ") has been received and is now pending review.</p>\n           <p>We will process your request within 7 business days. If approved, your account will be permanently deleted, and you will receive a confirmation email.</p>\n           " + (reason ? "<p><strong>Reason provided:</strong> " + reason + "</p>" : "") + "\n           <p>If you did not initiate this request or wish to cancel it, please contact support at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a> immediately.</p>\n           <p>Best regards,<br>Quicrefill Team</p>";
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST,
                        customPayload: {
                            to: user.email,
                            subject: "Account Deletion Request Submitted",
                            htmlContent: emailContent
                        },
                        metadata: {
                            userId: user.id,
                            name: user.name || "User",
                            email: user.email,
                            role: user.role,
                            contextRole: contextRole,
                            platform: platform,
                            reason: reason || null,
                            transactionReference: transactionReference_1,
                            deletionRequestId: accountDeletionRequest.id
                        }
                    })];
            case 10:
                _b.sent();
                logger.info("Account deletion request confirmation email sent", {
                    userId: user.id,
                    email: user.email,
                    platform: platform,
                    transactionReference: transactionReference_1,
                    deletionRequestId: accountDeletionRequest.id
                });
                return [3 /*break*/, 12];
            case 11:
                emailError_2 = _b.sent();
                errorMessage = emailError_2 instanceof Error ? emailError_2.message : "Unknown error";
                logger.error("Failed to send account deletion request confirmation email", {
                    userId: user.id,
                    email: user.email,
                    error: errorMessage,
                    platform: platform,
                    transactionReference: transactionReference_1,
                    deletionRequestId: accountDeletionRequest.id
                });
                return [3 /*break*/, 12];
            case 12:
                http_util_1.HttpResponse.success(res, { deletionRequestId: accountDeletionRequest.id, transactionReference: transactionReference_1 }, "Account deletion request submitted successfully for " + user.email + ". A confirmation email has been sent.");
                return [3 /*break*/, 14];
            case 13:
                error_2 = _b.sent();
                errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                logger.error("Error in VerifyAccountDeletionOtp", {
                    transactionReference: req.body.transactionReference || "unknown",
                    error: errorMessage,
                    ip: req.ip || "unknown",
                    platform: platform
                });
                next(error_2);
                return [3 /*break*/, 14];
            case 14: return [2 /*return*/];
        }
    });
}); };
