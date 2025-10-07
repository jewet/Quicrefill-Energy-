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
exports.RequestPasswordReset = void 0;
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
        new winston_1["default"].transports.File({ filename: "logs/auth.log" }),
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
exports.RequestPasswordReset = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var platform, platformRaw, schema, validatedData, email_2, user_1, eventType_1, mappedEventType_1, transactionReference, expiresAt, contextRole, isMigratedVendor, isDeliveryRep, emailContent, emailError_1, errorMessage, error_1, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                platform = "app";
                _a.label = 1;
            case 1:
                _a.trys.push([1, 10, , 11]);
                console.log("Starting password reset for email:", req.body.email);
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
                    email: zod_1.z.string().email({ message: "Invalid email format" })
                });
                return [4 /*yield*/, schema.parseAsync(req.body)["catch"](function (err) {
                        var errorMessage = "Validation error";
                        logger.error("Validation error in password reset", {
                            errors: err.issues,
                            email: req.body.email,
                            ip: req.ip,
                            platform: platform
                        });
                        throw new validation_1.UnprocessableEntity(errorMessage, root_1.AppErrorCode.UNPROCESSABLE_ENTITY, err);
                    })];
            case 2:
                validatedData = _a.sent();
                email_2 = validatedData.email;
                console.log("Input validated:", email_2);
                // Query user with timeout
                console.log("Querying user for email:", email_2);
                return [4 /*yield*/, withTimeout(__1.prismaClient.user.findUnique({ where: { email: email_2 } }), 5000)["catch"](function (dbError) {
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
                    logger.warn("User not found for password reset", {
                        email: email_2,
                        ip: req.ip,
                        platform: platform
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User does not exist", root_1.AppErrorCode.USER_DOES_NOT_EXIST);
                }
                console.log("User query completed, user found:", user_1.id);
                eventType_1 = "password reset";
                console.log("Event input for OTP:", eventType_1);
                mappedEventType_1 = EventTypeDictionary_1.mapToEventType(eventType_1);
                console.log("Mapped eventType for email service:", mappedEventType_1);
                // Validate mapped event type to use KnownEventTypes
                if (mappedEventType_1 !== EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET) {
                    logger.error("Unexpected event type mapping", {
                        input: eventType_1,
                        mapped: mappedEventType_1,
                        expected: EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET
                    });
                    throw new Error("Invalid event type mapping: expected " + EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET + ", got " + mappedEventType_1);
                }
                transactionReference = uuid_1.v4();
                console.log("Generating and sending OTP for email:", email_2, "with transactionReference:", transactionReference);
                console.log("User data:", { id: user_1.id, email: user_1.email, role: user_1.role, name: user_1.name });
                expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                return [4 /*yield*/, withTimeout(otp_1.emailOtpService.generateAndSendOtp({
                        userId: user_1.id,
                        email: email_2,
                        medium: ["EMAIL"],
                        transactionReference: transactionReference,
                        eventType: eventType_1,
                        metadata: {
                            userId: user_1.id,
                            name: user_1.name || "User",
                            role: user_1.role,
                            expiresAt: expiresAt.toLocaleString()
                        }
                    }), 10000)["catch"](function (otpError) {
                        var errorMessage = otpError instanceof Error ? otpError.message : "Unknown error";
                        logger.error("Failed to generate and send OTP", {
                            userId: user_1.id,
                            email: email_2,
                            error: errorMessage,
                            platform: platform,
                            eventType: eventType_1,
                            mappedEventType: mappedEventType_1,
                            userData: { id: user_1.id, email: user_1.email, role: user_1.role, name: user_1.name }
                        });
                        throw new Error("Failed to send OTP: " + errorMessage);
                    })];
            case 4:
                _a.sent();
                console.log("OTP sent successfully");
                contextRole = determineContextRole(user_1.role, platform);
                return [4 /*yield*/, __1.prismaClient.auditLog.create({
                        data: {
                            userId: user_1.id,
                            action: "PASSWORD_RESET_REQUEST",
                            entityType: "USER",
                            entityId: user_1.id,
                            details: {
                                platform: platform,
                                contextRole: contextRole,
                                email: email_2,
                                role: user_1.role,
                                ip: req.ip
                            }
                        }
                    })];
            case 5:
                _a.sent();
                _a.label = 6;
            case 6:
                _a.trys.push([6, 8, , 9]);
                isMigratedVendor = user_1.role === client_1.Role.VENDOR && user_1.migratedToVendor;
                isDeliveryRep = contextRole === client_1.Role.DELIVERY_REP;
                emailContent = (isMigratedVendor || isDeliveryRep)
                    ? "<p>Dear " + (user_1.name || "User") + ",</p>\n           <p>You\u2019ve requested to reset your Quicrefill account password. A one-time password (OTP) has been sent to your email.</p>\n           <p>Please check your inbox (and spam/junk folder) for the OTP and use it to reset your password.</p>\n           <p>Once reset, use your new password to log in to the delivery app (as a Delivery Rep) or the vendor dashboard at <a href=\"https://vendor.quicrefill.com\">vendor.quicrefill.com</a> (as a Vendor).</p>\n           <p>If you didn\u2019t request this OTP, please contact support at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n           <p>Best regards,<br>Quicrefill Team</p>"
                    : "<p>Dear " + (user_1.name || "User") + ",</p>\n           <p>You\u2019ve requested to reset your Quicrefill account password. A one-time password (OTP) has been sent to your email.</p>\n           <p>Please check your inbox (and spam/junk folder) for the OTP and use it to reset your password.</p>\n           <p>If you didn\u2019t request this OTP, please contact support at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n           <p>Best regards,<br>Quicrefill Team</p>";
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: mappedEventType_1,
                        userIds: [user_1.id],
                        customPayload: {
                            to: user_1.email,
                            subject: "Password Reset OTP for Your Quicrefill Account",
                            htmlContent: emailContent
                        },
                        metadata: {
                            userId: user_1.id,
                            name: user_1.name || "User",
                            email: user_1.email,
                            role: user_1.role,
                            contextRole: contextRole,
                            platform: platform,
                            expiresAt: expiresAt.toLocaleString()
                        }
                    })];
            case 7:
                _a.sent();
                logger.info("Password reset OTP notification email sent", { userId: user_1.id, email: email_2, platform: platform, eventType: mappedEventType_1 });
                return [3 /*break*/, 9];
            case 8:
                emailError_1 = _a.sent();
                errorMessage = emailError_1 instanceof Error ? emailError_1.message : "Unknown error";
                logger.error("Failed to send password reset OTP notification email", {
                    userId: user_1.id,
                    email: email_2,
                    error: errorMessage,
                    platform: platform,
                    eventType: mappedEventType_1
                });
                return [3 /*break*/, 9];
            case 9:
                // Success response
                http_util_1.HttpResponse.success(res, null, "Password reset OTP sent to " + (user_1.name || "User") + " on " + email_2);
                return [3 /*break*/, 11];
            case 10:
                error_1 = _a.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("Error in RequestPasswordReset", {
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
