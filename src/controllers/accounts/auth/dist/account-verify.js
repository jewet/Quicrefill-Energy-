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
exports.AccountVerify = void 0;
var zod_1 = require("zod");
var __1 = require("../../../");
var otp_1 = require("../../../lib/utils/mail/otp"); // Import OtpRequest
var otp_service_1 = require("../../../services/otp.service");
var email_1 = require("../../../services/email");
var SMSTemplateService_1 = require("../../../services/SMSTemplateService");
var unauthorizedRequests_1 = require("../../../exceptions/unauthorizedRequests");
var http_util_1 = require("../../../utils/http.util");
var root_1 = require("../../../exceptions/root");
var winston_1 = require("winston");
var client_1 = require("@prisma/client");
var EventTypeDictionary_1 = require("../../../utils/EventTypeDictionary");
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1["default"].transports.File({ filename: "logs/combined.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
var determineContextRole = function (role, platform) {
    if (role === client_1.Role.VENDOR && platform === "app") {
        return client_1.Role.DELIVERY_REP;
    }
    if (role === client_1.Role.VENDOR && platform === "web") {
        return client_1.Role.VENDOR;
    }
    return role;
};
exports.AccountVerify = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var platform, platformRaw, schema, _a, medium, email, phoneNumber, otp, transactionReference, resend, normalizedPhoneNumber, user, isVerifiedField, newTransactionReference, otpRequest, otpRecord, verification, _b, error_1, errorMessage, contextRole, emailContent, smsContent, error_2, errorMessage, error_3, errorMessage;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                platform = "app";
                _c.label = 1;
            case 1:
                _c.trys.push([1, 21, , 22]);
                logger.info("Starting account verification", { body: req.body, query: req.query });
                platformRaw = req.query.platform;
                if (typeof platformRaw === "string") {
                    platform = platformRaw;
                }
                else if (platformRaw) {
                    logger.warn("Invalid platform query", { platformRaw: platformRaw, ip: req.ip });
                }
                schema = zod_1.z.object({
                    medium: zod_1.z["enum"](["EMAIL", "SMS"]),
                    email: zod_1.z.string().email().optional(),
                    phoneNumber: zod_1.z.string().regex(/^(\+?\d{10,15})$/).optional(),
                    otp: zod_1.z.string().or(zod_1.z.number()),
                    transactionReference: zod_1.z.string(),
                    resend: zod_1.z.boolean().optional()["default"](false)
                }).refine(function (data) { return (data.medium === "EMAIL" && data.email) || (data.medium === "SMS" && data.phoneNumber); }, { message: "Email required for EMAIL medium, phoneNumber required for SMS medium" });
                return [4 /*yield*/, schema.parseAsync(req.body)];
            case 2:
                _a = _c.sent(), medium = _a.medium, email = _a.email, phoneNumber = _a.phoneNumber, otp = _a.otp, transactionReference = _a.transactionReference, resend = _a.resend;
                logger.info("Input validated", { medium: medium, email: email, phoneNumber: phoneNumber, transactionReference: transactionReference, resend: resend });
                normalizedPhoneNumber = (phoneNumber === null || phoneNumber === void 0 ? void 0 : phoneNumber.startsWith("+")) ? phoneNumber : "+" + phoneNumber;
                return [4 /*yield*/, __1.prismaClient.user.findUnique({
                        where: medium === "EMAIL" ? { email: email } : { phoneNumber: normalizedPhoneNumber }
                    })];
            case 3:
                user = _c.sent();
                if (!user) {
                    logger.warn("User not found", { medium: medium, email: email, phoneNumber: phoneNumber, ip: req.ip, platform: platform });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User does not exist", root_1.AppErrorCode.USER_DOES_NOT_EXIST);
                }
                isVerifiedField = medium === "EMAIL" ? user.emailVerified : user.phoneVerified;
                if (isVerifiedField) {
                    logger.warn("User already verified", { medium: medium, email: email, phoneNumber: phoneNumber, ip: req.ip, platform: platform });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User already verified", root_1.AppErrorCode.USER_DOES_NOT_EXIST);
                }
                logger.info("User found", { userId: user.id, email: user.email, phoneNumber: user.phoneNumber });
                if (!resend) return [3 /*break*/, 5];
                newTransactionReference = transactionReference + "_" + Date.now();
                otpRequest = {
                    userId: user.id,
                    email: email,
                    medium: [medium],
                    transactionReference: newTransactionReference,
                    eventType: EventTypeDictionary_1.KnownEventTypes.OTP_VERIFICATION
                };
                return [4 /*yield*/, otp_1.emailOtpService.generateAndSendOtp(otpRequest)];
            case 4:
                otpRecord = _c.sent();
                logger.info("New OTP sent", { userId: user.id, email: email, newTransactionReference: newTransactionReference });
                return [2 /*return*/, http_util_1.HttpResponse.success(res, {
                        user: user,
                        newTransactionReference: otpRecord.transactionReference,
                        message: "New OTP sent. Please use the new transaction reference."
                    }, medium + " OTP resent successfully")];
            case 5:
                verification = void 0;
                _c.label = 6;
            case 6:
                _c.trys.push([6, 11, , 12]);
                if (!(medium === "EMAIL")) return [3 /*break*/, 8];
                return [4 /*yield*/, otp_1.emailOtpService.verifyOtp(transactionReference, otp.toString())];
            case 7:
                _b = _c.sent();
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, otp_service_1.OtpService.validateOtp({ transactionReference: transactionReference, otp: otp.toString() })];
            case 9:
                _b = _c.sent();
                _c.label = 10;
            case 10:
                verification = _b;
                return [3 /*break*/, 12];
            case 11:
                error_1 = _c.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("OTP verification failed", {
                    medium: medium,
                    email: email,
                    phoneNumber: phoneNumber,
                    transactionReference: transactionReference,
                    otp: otp,
                    error: errorMessage
                });
                // If OTP record not found or expired, suggest resending
                if (errorMessage.includes("OTP not found") || errorMessage.includes("OTP expired")) {
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "OTP not found or expired. Please request a new OTP.", 400, {
                            errorCode: root_1.AppErrorCode.INVALID_OTP,
                            resend: true
                        })];
                }
                // If maximum attempts exceeded, suggest resending
                if (errorMessage.includes("Maximum attempts exceeded")) {
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "Maximum OTP attempts exceeded. Please request a new OTP.", 400, {
                            errorCode: root_1.AppErrorCode.INVALID_OTP,
                            resend: true
                        })];
                }
                throw new unauthorizedRequests_1.UnauthorizedRequest("Invalid OTP", root_1.AppErrorCode.INVALID_OTP);
            case 12:
                if (!verification.verified) {
                    logger.warn("Invalid OTP verification result", { medium: medium, email: email, phoneNumber: phoneNumber, ip: req.ip, platform: platform });
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "Invalid OTP. Please try again or request a new OTP.", 400, {
                            errorCode: root_1.AppErrorCode.INVALID_OTP,
                            resend: true
                        })];
                }
                logger.info("OTP verified", { transactionReference: transactionReference, userId: user.id });
                contextRole = determineContextRole(user.role, platform);
                return [4 /*yield*/, __1.prismaClient.auditLog.create({
                        data: {
                            userId: user.id,
                            action: "ACCOUNT_VERIFICATION_COMPLETED",
                            entityType: "USER",
                            entityId: user.id,
                            details: {
                                platform: platform,
                                contextRole: contextRole,
                                medium: medium,
                                email: email || null,
                                phoneNumber: normalizedPhoneNumber || null,
                                role: user.role,
                                ip: req.ip,
                                transactionReference: transactionReference
                            }
                        }
                    })];
            case 13:
                _c.sent();
                _c.label = 14;
            case 14:
                _c.trys.push([14, 19, , 20]);
                if (!(medium === "EMAIL")) return [3 /*break*/, 16];
                emailContent = "<p>Dear " + (user.name || "User") + ",</p>\n          <p>Your Quicrefill account (" + user.role + ") is verified. Welcome to Quicrefill!</p>\n          <p>Start exploring our services now.</p>\n          <p>Best regards,<br>Quicrefill Team</p>";
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: EventTypeDictionary_1.KnownEventTypes.ACCOUNT_VERIFICATION,
                        customPayload: {
                            to: email,
                            subject: "Welcome to Quicrefill!",
                            htmlContent: emailContent
                        },
                        metadata: {
                            userId: user.id,
                            name: user.name || "User",
                            email: user.email,
                            role: user.role,
                            contextRole: contextRole,
                            platform: platform
                        }
                    })];
            case 15:
                _c.sent();
                logger.info("Verification email sent", { userId: user.id, email: email, platform: platform });
                return [3 /*break*/, 18];
            case 16:
                smsContent = "Welcome to Quicrefill, " + (user.name || "User") + "! Your " + user.role + " account is verified. Start exploring now.";
                return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.sendSMS({
                        eventType: EventTypeDictionary_1.KnownEventTypes.OTP_VERIFICATION,
                        customPayload: {
                            to: normalizedPhoneNumber,
                            content: smsContent
                        },
                        metadata: {
                            userId: user.id,
                            name: user.name || "User",
                            role: user.role,
                            contextRole: contextRole,
                            platform: platform
                        }
                    })];
            case 17:
                _c.sent();
                logger.info("Verification SMS sent", { userId: user.id, phoneNumber: normalizedPhoneNumber, platform: platform });
                _c.label = 18;
            case 18: return [3 /*break*/, 20];
            case 19:
                error_2 = _c.sent();
                errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                logger.error("Failed to send confirmation", { userId: user.id, medium: medium, error: errorMessage, platform: platform });
                return [3 /*break*/, 20];
            case 20: return [2 /*return*/, http_util_1.HttpResponse.success(res, { user: user }, medium + " verified successfully")];
            case 21:
                error_3 = _c.sent();
                errorMessage = error_3 instanceof Error ? error_3.message : "Unknown error";
                logger.error("AccountVerify error", {
                    medium: req.body.medium || "unknown",
                    email: req.body.email || "unknown",
                    phoneNumber: req.body.phoneNumber || "unknown",
                    transactionReference: req.body.transactionReference || "unknown",
                    error: errorMessage,
                    ip: req.ip || "unknown",
                    platform: platform
                });
                next(error_3);
                return [3 /*break*/, 22];
            case 22: return [2 /*return*/];
        }
    });
}); };
// Export both named and default for compatibility
exports["default"] = exports.AccountVerify;
