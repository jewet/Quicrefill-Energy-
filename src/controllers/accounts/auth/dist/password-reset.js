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
exports.PasswordReset = void 0;
var zod_1 = require("zod");
var root_1 = require("../../../exceptions/root");
var validation_1 = require("../../../exceptions/validation");
var db_1 = require("../../../config/db");
var unauthorizedRequests_1 = require("../../../exceptions/unauthorizedRequests");
var bcryptjs_1 = require("bcryptjs");
var email_1 = require("../../../services/email");
var http_util_1 = require("../../../utils/http.util");
var winston_1 = require("winston");
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
// Validation schema
var PasswordResetSchema = zod_1.z.object({
    email: zod_1.z.string().email({ message: "Invalid email format" }),
    token: zod_1.z.string({ message: "Token is required" }),
    password: zod_1.z.string().min(6, { message: "Password must be at least 6 characters" })
});
/**
 * Resets the user's password using an OTP, sends a confirmation email, and logs the action.
 */
exports.PasswordReset = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var validatedData, email_2, token, password, platform_1, user_1, otpRecord_1, newPasswordHash_1, eventType, mappedEventType, isMigratedVendor, isDeliveryRep, emailContent, emailError_1, errorMessage, error_1, errorMessage;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 10, , 11]);
                return [4 /*yield*/, PasswordResetSchema.parseAsync(req.body)["catch"](function (err) {
                        logger.error("Validation error in password reset", { errors: err.issues, ip: req.ip });
                        throw new validation_1.UnprocessableEntity("Unprocessable Entity", root_1.AppErrorCode.UNPROCESSABLE_ENTITY, err.issues);
                    })];
            case 1:
                validatedData = _d.sent();
                email_2 = validatedData.email, token = validatedData.token, password = validatedData.password;
                platform_1 = typeof req.query.platform === "string" ? req.query.platform : "app";
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({
                        where: { email: email_2.toLowerCase() },
                        include: { profile: true }
                    })];
            case 2:
                user_1 = _d.sent();
                if (!user_1) {
                    logger.warn("Password reset attempted for non-existent user", { email: email_2, ip: req.ip, platform: platform_1 });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("User does not exist", root_1.AppErrorCode.USER_DOES_NOT_EXIST);
                }
                return [4 /*yield*/, db_1.prismaClient.otp.findFirst({
                        where: {
                            code: token,
                            userId: user_1.id,
                            expiresAt: { gt: new Date() },
                            eventType: EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET
                        }
                    })];
            case 3:
                otpRecord_1 = _d.sent();
                if (!otpRecord_1) {
                    logger.warn("Invalid or expired OTP for password reset", {
                        userId: user_1.id,
                        email: email_2,
                        ip: req.ip,
                        platform: platform_1,
                        eventType: EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET
                    });
                    throw new unauthorizedRequests_1.UnauthorizedRequest("Invalid or expired reset token", root_1.AppErrorCode.INVALID_TOKEN);
                }
                return [4 /*yield*/, bcryptjs_1["default"].hash(password, 10)];
            case 4:
                newPasswordHash_1 = _d.sent();
                // Update password and invalidate OTP
                return [4 /*yield*/, db_1.prismaClient.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: 
                                // Update user password
                                return [4 /*yield*/, tx.user.update({
                                        where: { id: user_1.id },
                                        data: { password: newPasswordHash_1 }
                                    })];
                                case 1:
                                    // Update user password
                                    _b.sent();
                                    // Invalidate OTP
                                    return [4 /*yield*/, tx.otp["delete"]({
                                            where: { id: otpRecord_1.id }
                                        })];
                                case 2:
                                    // Invalidate OTP
                                    _b.sent();
                                    // Log audit
                                    return [4 /*yield*/, tx.auditLog.create({
                                            data: {
                                                userId: user_1.id,
                                                action: "PASSWORD_RESET",
                                                entityType: "USER",
                                                entityId: user_1.id,
                                                details: {
                                                    platform: platform_1,
                                                    contextRole: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.contextRole) || user_1.role,
                                                    email: email_2,
                                                    ip: req.ip
                                                }
                                            }
                                        })];
                                case 3:
                                    // Log audit
                                    _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 5:
                // Update password and invalidate OTP
                _d.sent();
                logger.info("Password reset successful", {
                    userId: user_1.id,
                    email: email_2,
                    platform: platform_1,
                    contextRole: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.contextRole) || user_1.role,
                    eventType: EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET
                });
                _d.label = 6;
            case 6:
                _d.trys.push([6, 8, , 9]);
                eventType = "password reset";
                mappedEventType = EventTypeDictionary_1.mapToEventType(eventType);
                if (mappedEventType !== EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET) {
                    logger.error("Unexpected event type mapping", {
                        input: eventType,
                        mapped: mappedEventType,
                        expected: EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET
                    });
                    throw new Error("Invalid event type mapping: expected " + EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET + ", got " + mappedEventType);
                }
                isMigratedVendor = user_1.role === "VENDOR" && user_1.migratedToVendor;
                isDeliveryRep = (((_b = req.user) === null || _b === void 0 ? void 0 : _b.contextRole) || user_1.role) === "DELIVERY_REP";
                emailContent = (isMigratedVendor || isDeliveryRep)
                    ? "\n            <!DOCTYPE html>\n            <html lang=\"en\">\n            <head>\n              <meta charset=\"UTF-8\">\n              <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n              <title>Password Reset Successful</title>\n              <style>\n                body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n                .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n                .header { background: #4a90e2; padding: 20px; text-align: center; }\n                .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n                .content { padding: 30px; text-align: left; }\n                .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n                .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n                .footer a { color: #4a90e2; text-decoration: none; }\n              </style>\n            </head>\n            <body>\n              <div class=\"container\">\n                <div class=\"header\">\n                  <h1>Password Reset Successful</h1>\n                </div>\n                <div class=\"content\">\n                  <p>Dear " + (user_1.name || "User") + ",</p>\n                  <p>Your Quicrefill account password has been successfully reset.</p>\n                  <p>You can now use your new password to log in to the delivery app (as a Delivery Rep) or the vendor dashboard at <a href=\"https://vendor.quicrefill.com\">vendor.quicrefill.com</a> (as a Vendor).</p>\n                  <p>If you did not initiate this password reset, please contact our support team immediately at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n                  <p>Best regards,<br>Quicrefill Team</p>\n                </div>\n                <div class=\"footer\">\n                  <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n                  <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n                </div>\n              </div>\n            </body>\n            </html>"
                    : "\n            <!DOCTYPE html>\n            <html lang=\"en\">\n            <head>\n              <meta charset=\"UTF-8\">\n              <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n              <title>Password Reset Successful</title>\n              <style>\n                body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n                .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n                .header { background: #4a90e2; padding: 20px; text-align: center; }\n                .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n                .content { padding: 30px; text-align: left; }\n                .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n                .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n                .footer a { color: #4a90e2; text-decoration: none; }\n              </style>\n            </head>\n            <body>\n              <div class=\"container\">\n                <div class=\"header\">\n                  <h1>Password Reset Successful</h1>\n                </div>\n                <div class=\"content\">\n                  <p>Dear " + (user_1.name || "User") + ",</p>\n                  <p>Your Quicrefill account password has been successfully reset.</p>\n                  <p>You can now use your new password to log in to your account at <a href=\"https://quicrefill.com\">quicrefill.com</a>.</p>\n                  <p>If you did not initiate this password reset, please contact our support team immediately at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n                  <p>Best regards,<br>Quicrefill Team</p>\n                </div>\n                <div class=\"footer\">\n                  <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n                  <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n                </div>\n              </div>\n            </body>\n            </html>";
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: eventType,
                        userIds: [user_1.id],
                        customPayload: {
                            to: user_1.email,
                            subject: "Your Quicrefill Password Has Been Reset",
                            htmlContent: emailContent
                        },
                        metadata: {
                            userId: user_1.id,
                            name: user_1.name || "User",
                            email: user_1.email,
                            platform: platform_1,
                            contextRole: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.contextRole) || user_1.role
                        }
                    })];
            case 7:
                _d.sent();
                logger.info("Password reset confirmation email sent", {
                    userId: user_1.id,
                    email: email_2,
                    platform: platform_1,
                    eventType: mappedEventType
                });
                return [3 /*break*/, 9];
            case 8:
                emailError_1 = _d.sent();
                errorMessage = emailError_1 instanceof Error ? emailError_1.message : "Unknown error";
                logger.error("Failed to send password reset confirmation email", {
                    userId: user_1.id,
                    email: email_2,
                    error: errorMessage,
                    platform: platform_1,
                    eventType: EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET
                });
                return [3 /*break*/, 9];
            case 9:
                // Send success response
                http_util_1.HttpResponse.success(res, null, "Password reset successful");
                return [3 /*break*/, 11];
            case 10:
                error_1 = _d.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("Password reset error", {
                    email: req.body.email || "unknown",
                    error: errorMessage,
                    ip: req.ip || "unknown",
                    platform: req.query.platform || "app"
                });
                next(error_1);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); };
