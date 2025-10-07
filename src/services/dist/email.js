"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.startEmailQueue = exports.emailTemplateService = exports.EmailTemplateService = void 0;
var nodemailer_1 = require("nodemailer");
var client_1 = require("@prisma/client");
var winston_1 = require("winston");
var redis_1 = require("../config/redis");
var EventTypeDictionary_1 = require("../utils/EventTypeDictionary");
// Initialize Prisma client
var prisma = new client_1.PrismaClient();
// Initialize Winston logger
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1["default"].transports.File({ filename: "logs/combined.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
// Fetch email settings from database with fallback to environment variables
var getEmailConfig = function () { return __awaiter(void 0, void 0, Promise, function () {
    var emailSettings, error_1, errorMessage, requiredVars, _i, _a, _b, key, value;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, prisma.emailSettings.findFirst({
                        orderBy: { updatedAt: "desc" },
                        select: {
                            smtpHost: true,
                            smtpPort: true,
                            smtpUser: true,
                            smtpPassword: true,
                            emailFrom: true
                        }
                    })];
            case 1:
                emailSettings = _c.sent();
                if (emailSettings &&
                    emailSettings.smtpHost &&
                    emailSettings.smtpPort &&
                    emailSettings.smtpUser &&
                    emailSettings.smtpPassword &&
                    emailSettings.emailFrom) {
                    logger.info("Using email settings from database");
                    return [2 /*return*/, {
                            smtpHost: emailSettings.smtpHost,
                            smtpPort: emailSettings.smtpPort,
                            smtpUser: emailSettings.smtpUser,
                            smtpPassword: emailSettings.smtpPassword,
                            emailFrom: emailSettings.emailFrom
                        }];
                }
                else {
                    logger.warn("Incomplete or no email settings found in database, falling back to environment variables");
                }
                return [3 /*break*/, 3];
            case 2:
                error_1 = _c.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("Failed to fetch email settings from database", { error: errorMessage });
                logger.warn("Falling back to environment variables for email configuration");
                return [3 /*break*/, 3];
            case 3:
                requiredVars = {
                    SMTP_HOST: process.env.SMTP_HOST,
                    SMTP_PORT: process.env.SMTP_PORT,
                    SMTP_USER: process.env.SMTP_USER,
                    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
                    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS
                };
                for (_i = 0, _a = Object.entries(requiredVars); _i < _a.length; _i++) {
                    _b = _a[_i], key = _b[0], value = _b[1];
                    if (!value) {
                        logger.error("Missing required environment variable: " + key);
                        throw new Error("Missing required environment variable: " + key);
                    }
                }
                return [2 /*return*/, {
                        smtpHost: process.env.SMTP_HOST,
                        smtpPort: parseInt(process.env.SMTP_PORT, 10),
                        smtpUser: process.env.SMTP_USER,
                        smtpPassword: process.env.SMTP_PASSWORD,
                        emailFrom: process.env.EMAIL_FROM_ADDRESS
                    }];
        }
    });
}); };
// Configure Nodemailer transporter
var configureTransporter = function () { return __awaiter(void 0, void 0, Promise, function () {
    var config, transporter, error_2, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getEmailConfig()];
            case 1:
                config = _a.sent();
                transporter = nodemailer_1["default"].createTransport({
                    host: config.smtpHost,
                    port: config.smtpPort,
                    secure: config.smtpPort === 465,
                    auth: {
                        user: config.smtpUser,
                        pass: config.smtpPassword
                    },
                    tls: {
                        minVersion: "TLSv1.2",
                        rejectUnauthorized: process.env.NODE_ENV === "production"
                    },
                    service: config.smtpHost.includes("gmail") ? "gmail" : undefined,
                    logger: true
                });
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, transporter.verify()];
            case 3:
                _a.sent();
                logger.info("SMTP transporter is ready", { host: config.smtpHost, port: config.smtpPort });
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                logger.error("SMTP transporter verification failed", { error: errorMessage });
                logger.warn("Application will continue without SMTP until resolved");
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/, transporter];
        }
    });
}); };
// Initialize transporter
var initializeTransporter = function () { return __awaiter(void 0, void 0, void 0, function () {
    var transporter;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, configureTransporter()];
            case 1:
                transporter = _a.sent();
                return [2 /*return*/, transporter];
        }
    });
}); };
var transporterPromise = initializeTransporter();
// Retry configuration
var MAX_RETRIES = 3;
var RETRY_DELAY = 3000; // 3 seconds
// Send email with retry and queue fallback
var sendMail = function (to, options, retryCount) {
    if (retryCount === void 0) { retryCount = 0; }
    return __awaiter(void 0, void 0, Promise, function () {
        var recipients, config, transporter, message, error_3, errorMessage, redis, queueError_1, queueErrorMessage;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    recipients = Array.isArray(to) ? to.join(", ") : to;
                    return [4 /*yield*/, getEmailConfig()];
                case 1:
                    config = _g.sent();
                    return [4 /*yield*/, transporterPromise];
                case 2:
                    transporter = _g.sent();
                    _g.label = 3;
                case 3:
                    _g.trys.push([3, 6, , 13]);
                    return [4 /*yield*/, transporter.sendMail({
                            from: options.from ? "\"Quicrefill\" <" + options.from + ">" : "\"Quicrefill\" <" + config.emailFrom + ">",
                            to: recipients,
                            subject: options.subject,
                            html: options.htmlBody
                        })];
                case 4:
                    message = _g.sent();
                    return [4 /*yield*/, prisma.notificationLog.create({
                            data: {
                                userId: (_a = options.metadata) === null || _a === void 0 ? void 0 : _a.userId,
                                type: "EMAIL",
                                channel: "EMAIL",
                                recipient: recipients,
                                eventTypeId: (_b = options.metadata) === null || _b === void 0 ? void 0 : _b.eventTypeId,
                                status: "SENT",
                                payload: {
                                    recipient: recipients,
                                    subject: options.subject,
                                    from: options.from || config.emailFrom,
                                    templateId: (_c = options.metadata) === null || _c === void 0 ? void 0 : _c.templateId
                                },
                                vendorId: null
                            }
                        })];
                case 5:
                    _g.sent();
                    logger.info("Email sent successfully", {
                        messageId: message.messageId,
                        to: recipients,
                        from: options.from || config.emailFrom,
                        accepted: message.accepted,
                        rejected: message.rejected
                    });
                    return [3 /*break*/, 13];
                case 6:
                    error_3 = _g.sent();
                    errorMessage = error_3 instanceof Error ? error_3.message : "Unknown error";
                    logger.error("Failed to send email", {
                        to: recipients,
                        from: options.from || config.emailFrom,
                        subject: options.subject,
                        error: errorMessage,
                        retryCount: retryCount
                    });
                    return [4 /*yield*/, prisma.notificationLog.create({
                            data: {
                                userId: (_d = options.metadata) === null || _d === void 0 ? void 0 : _d.userId,
                                type: "EMAIL",
                                channel: "EMAIL",
                                recipient: recipients,
                                eventTypeId: (_e = options.metadata) === null || _e === void 0 ? void 0 : _e.eventTypeId,
                                status: "FAILED",
                                payload: {
                                    recipient: recipients,
                                    subject: options.subject,
                                    from: options.from || config.emailFrom,
                                    error: errorMessage,
                                    templateId: (_f = options.metadata) === null || _f === void 0 ? void 0 : _f.templateId
                                },
                                vendorId: null
                            }
                        })];
                case 7:
                    _g.sent();
                    if (!(retryCount < MAX_RETRIES)) return [3 /*break*/, 9];
                    logger.info("Retrying email send (" + (retryCount + 1) + "/" + MAX_RETRIES + ")", {
                        to: recipients,
                        subject: options.subject
                    });
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)); })];
                case 8:
                    _g.sent();
                    return [2 /*return*/, sendMail(to, options, retryCount + 1)];
                case 9:
                    _g.trys.push([9, 11, , 12]);
                    redis = redis_1.getRedisClient();
                    return [4 /*yield*/, redis.lPush("email_queue", JSON.stringify({
                            to: to,
                            subject: options.subject,
                            htmlBody: options.htmlBody,
                            from: options.from,
                            metadata: options.metadata
                        }))];
                case 10:
                    _g.sent();
                    logger.info("Email queued for retry", { to: recipients, subject: options.subject });
                    return [3 /*break*/, 12];
                case 11:
                    queueError_1 = _g.sent();
                    queueErrorMessage = queueError_1 instanceof Error ? queueError_1.message : "Unknown error";
                    logger.error("Failed to queue email", {
                        to: recipients,
                        subject: options.subject,
                        error: queueErrorMessage
                    });
                    throw new Error("Failed to send or queue email: " + errorMessage);
                case 12: return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
};
// Default email template
var defaultEmailTemplate = {
    id: "default",
    name: "Default Email",
    subject: "Quicrefill Notification",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Quicrefill Notification</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Quicrefill Notification</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>{message}</p>\n          <p>If you have any questions, please contact our support team at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default OTP email template
var defaultOtpTemplate = {
    id: "default-otp",
    name: "Default OTP Email",
    subject: "Your Quicrefill Verification Code",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Your Verification Code</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: center; }\n        .otp-code { font-size: 32px; font-weight: bold; color: #4a90e2; letter-spacing: 2px; margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 4px; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n        @media (max-width: 600px) { .container { margin: 10px; } .content { padding: 20px; } .otp-code { font-size: 28px; } }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Your Verification Code</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>Use the following code to verify your Quicrefill account:</p>\n          <div class=\"otp-code\">{otpCode}</div>\n          <p>This code will expire at {expiresAt}. Please do not share it with anyone.</p>\n          <p>If you didn\u2019t request this code, please contact our support team at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default Password Reset OTP email template
var defaultPasswordResetTemplate = {
    id: "default-password-reset",
    name: "Default Password Reset OTP Email",
    subject: "Reset Your Quicrefill Password",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Reset Your Password</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .otp-code { font-size: 24px; font-weight: bold; color: #4a90e2; letter-spacing: 2px; margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 4px; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Reset Your Password</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>You\u2019ve requested to reset your Quicrefill account password. Use the following one-time code to proceed:</p>\n          <div class=\"otp-code\">{otpCode}</div>\n          <p>This code will expire at {expiresAt}. Please enter it in the password reset form to set a new password.</p>\n          <p>If you didn\u2019t request this, please contact our support team immediately at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default Password Reset Confirmation email template
var defaultPasswordResetConfirmationTemplate = {
    id: "default-password-reset-confirmation",
    name: "Default Password Reset Confirmation Email",
    subject: "Your Quicrefill Password Has Been Reset",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Password Reset Successful</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Password Reset Successful</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>Your Quicrefill account password has been successfully reset.</p>\n          <p>You can now log in to your account at <a href=\"https://quicrefill.com\">quicrefill.com</a> using your new password.</p>\n          <p>If you did not initiate this password reset, please contact our support team immediately at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default Account Verification email template
var defaultAccountVerificationTemplate = {
    id: "default-account-verification",
    name: "Default Account Verification Email",
    subject: "Verify Your Quicrefill Account",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Verify Your Account</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .otp-code { font-size: 24px; font-weight: bold; color: #4a90e2; letter-spacing: 2px; margin: 20px 0; background: #f0f8ff; padding: 15px; border-radius: 4px; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Verify Your Account</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>Thank you for joining Quicrefill! To activate your account, please use the following verification code:</p>\n          <div class=\"otp-code\">{otpCode}</div>\n          <p>This code will expire at {expiresAt}. Enter it in the verification form to complete your account setup.</p>\n          <p>If you didn\u2019t sign up for a Quicrefill account, please contact our support team at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default Registration Success email template
var defaultRegistrationSuccessTemplate = {
    id: "default-registration-success",
    name: "Default Registration Success Email",
    subject: "Welcome to Quicrefill!",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Welcome to Quicrefill</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Welcome to Quicrefill</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>Welcome to Quicrefill! Your account has been successfully created, and you\u2019re ready to start exploring our services.</p>\n          <p>Log in to your account at <a href=\"https://quicrefill.com\">quicrefill.com</a> to get started.</p>\n          <p>If you have any questions, feel free to reach out to our support team at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Happy refilling!<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
var defaultAccountDeletionRequestTemplate = {
    id: "default-account-deletion-request",
    name: "Default Account Deletion Request OTP Email",
    subject: "Verify Your Quicrefill Account Deletion Request",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Verify Account Deletion</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #d9534f; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: center; }\n        .otp-code { font-size: 32px; font-weight: bold; color: #d9534f; letter-spacing: 2px; margin: 20px 0; background: #f9ecec; padding: 15px; border-radius: 4px; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #d9534f; text-decoration: none; }\n        @media (max-width: 600px) { .container { margin: 10px; } .content { padding: 20px; } .otp-code { font-size: 28px; } }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Verify Account Deletion</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>You have requested to delete your Quicrefill account. Use the following code to verify this request:</p>\n          <div class=\"otp-code\">{otpCode}</div>\n          <p>This code will expire at {expiresAt}. Please enter it in the Quicrefill app or website to confirm your account deletion.</p>\n          <p>If you did not initiate this request, please contact our support team at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a> immediately.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.ADMIN,
        client_1.Role.MANAGER,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default Registration Failure email template
var defaultRegistrationFailureTemplate = {
    id: "default-registration-failed",
    name: "Default Registration Failed Email",
    subject: "Issue with Your Quicrefill Registration",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Registration Issue</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #d9534f; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .content p { font-size: 16px; line-height: 1.6; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Registration Issue</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear User,</p>\n          <p>We\u2019re sorry, but we encountered an issue while creating your Quicrefill account.</p>\n          <p>Please try registering again, or contact our support team at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a> for assistance.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
// Default Login Success email template
var defaultLoginSuccessTemplate = {
    id: "default-login-success",
    name: "Default Login Success Email",
    subject: "Successful Login to Quicrefill",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Successful Login</title>\n      <style>\n        body { margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4; color: #333; }\n        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }\n        .header { background: #4a90e2; padding: 20px; text-align: center; }\n        .header h1 { margin: 0; color: #ffffff; font-size: 24px; }\n        .content { padding: 30px; text-align: left; }\n        .content p { font-size: 16px; line-height: 1.5; margin: 10px 0; }\n        .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }\n        .footer a { color: #4a90e2; text-decoration: none; }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Successful Login</h1>\n        </div>\n        <div class=\"content\">\n          <p>Dear {name},</p>\n          <p>You have successfully logged in to your Quicrefill account on {platform} at {loginTime}.</p>\n          <p>If you did not initiate this login, please contact our support team immediately at <a href=\"mailto:support@quicrefill.com\">support@quicrefill.com</a>.</p>\n          <p>Best regards,<br>Quicrefill Team</p>\n        </div>\n        <div class=\"footer\">\n          <p>\u00A9 2025 Quicrefill. All rights reserved.</p>\n          <p><a href=\"https://quicrefill.com\">Visit our website</a> | <a href=\"mailto:support@quicrefill.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  ",
    roles: [
        client_1.Role.CUSTOMER,
        client_1.Role.VENDOR,
        client_1.Role.DELIVERY_AGENT,
        client_1.Role.MANAGER,
        client_1.Role.SUPERVISOR,
        client_1.Role.FINANCE_MANAGER,
        client_1.Role.STAFF,
        client_1.Role.SERVICE_REP,
        client_1.Role.DELIVERY_REP,
    ],
    eventTypeId: null,
    updatedBy: "system",
    updatedAt: new Date(),
    isActive: true
};
var EmailTemplateService = /** @class */ (function () {
    function EmailTemplateService() {
        this.CACHE_TTL = 3600; // 1 hour
        this.ALL_TEMPLATES_CACHE_KEY = "email_templates";
        this.TEMPLATE_CACHE_KEY = function (id) { return "email_template:" + id; };
        this.RATE_LIMIT_KEY = function (identifier) { return "email_rate_limit:" + identifier; };
        this.AUDIT_QUEUE_KEY = "audit:queue";
    }
    EmailTemplateService.prototype.ensureEventType = function (name, createdBy) {
        return __awaiter(this, void 0, Promise, function () {
            var mappedEventType, eventType, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        mappedEventType = EventTypeDictionary_1.mapToEventType(name);
                        return [4 /*yield*/, prisma.eventType.findUnique({ where: { name: mappedEventType } })];
                    case 1:
                        eventType = _a.sent();
                        if (!!eventType) return [3 /*break*/, 3];
                        return [4 /*yield*/, prisma.eventType.create({
                                data: {
                                    name: mappedEventType,
                                    createdBy: createdBy,
                                    description: "Event type for " + mappedEventType
                                }
                            })];
                    case 2:
                        eventType = _a.sent();
                        logger.info("EventType created", { name: mappedEventType, createdBy: createdBy });
                        _a.label = 3;
                    case 3: return [2 /*return*/, eventType.id];
                    case 4:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : "Unknown error";
                        logger.error("Failed to ensure EventType", { name: name, error: errorMessage });
                        throw new Error("Failed to ensure EventType: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.createTemplate = function (data, updatedBy) {
        return __awaiter(this, void 0, Promise, function () {
            var template, redis, auditDetails, error_5, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma.emailTemplate.create({
                                data: {
                                    name: data.name,
                                    subject: data.subject,
                                    htmlContent: data.htmlContent,
                                    roles: data.roles || [],
                                    eventTypeId: data.eventTypeId || null,
                                    updatedBy: updatedBy,
                                    isActive: data.isActive !== undefined ? data.isActive : true
                                }
                            })];
                    case 1:
                        template = _a.sent();
                        redis = redis_1.getRedisClient();
                        auditDetails = {
                            template: {
                                name: data.name,
                                subject: data.subject,
                                htmlContent: data.htmlContent,
                                roles: data.roles ? data.roles.map(function (role) { return role.toString(); }) : [],
                                eventTypeId: data.eventTypeId || null,
                                isActive: data.isActive !== undefined ? data.isActive : true
                            }
                        };
                        return [4 /*yield*/, Promise.all([
                                redis.del(this.ALL_TEMPLATES_CACHE_KEY),
                                this.queueAuditLog(updatedBy, "CREATE_EMAIL_TEMPLATE", "EMAIL_TEMPLATE", template.id, auditDetails),
                            ])];
                    case 2:
                        _a.sent();
                        logger.info("Email template created", { name: data.name, updatedBy: updatedBy });
                        return [2 /*return*/, template];
                    case 3:
                        error_5 = _a.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : "Unknown error";
                        logger.error("Failed to create email template", { name: data.name, error: errorMessage });
                        throw new Error("Failed to create template: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.updateTemplate = function (id, data, updatedBy) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, Promise, function () {
            var template, redis, auditDetails, error_6, errorMessage;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma.emailTemplate.update({
                                where: { id: id },
                                data: {
                                    name: data.name,
                                    subject: data.subject,
                                    htmlContent: data.htmlContent,
                                    roles: data.roles,
                                    eventTypeId: data.eventTypeId || null,
                                    updatedBy: updatedBy,
                                    isActive: data.isActive,
                                    updatedAt: new Date()
                                }
                            })];
                    case 1:
                        template = _f.sent();
                        redis = redis_1.getRedisClient();
                        auditDetails = {
                            changes: {
                                name: (_a = data.name) !== null && _a !== void 0 ? _a : null,
                                subject: (_b = data.subject) !== null && _b !== void 0 ? _b : null,
                                htmlContent: (_c = data.htmlContent) !== null && _c !== void 0 ? _c : null,
                                roles: data.roles ? data.roles.map(function (role) { return role.toString(); }) : null,
                                eventTypeId: (_d = data.eventTypeId) !== null && _d !== void 0 ? _d : null,
                                isActive: (_e = data.isActive) !== null && _e !== void 0 ? _e : null
                            }
                        };
                        return [4 /*yield*/, Promise.all([
                                redis.del(this.ALL_TEMPLATES_CACHE_KEY),
                                redis.del(this.TEMPLATE_CACHE_KEY(id)),
                                this.queueAuditLog(updatedBy, "UPDATE_EMAIL_TEMPLATE", "EMAIL_TEMPLATE", id, auditDetails),
                            ])];
                    case 2:
                        _f.sent();
                        logger.info("Email template updated", { id: id, updatedBy: updatedBy });
                        return [2 /*return*/, template];
                    case 3:
                        error_6 = _f.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : "Unknown error";
                        logger.error("Failed to update email template", { id: id, error: errorMessage });
                        throw new Error("Failed to update template: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.deleteTemplate = function (id, deletedBy) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, error_7, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma.emailTemplate["delete"]({ where: { id: id } })];
                    case 1:
                        _a.sent();
                        redis = redis_1.getRedisClient();
                        return [4 /*yield*/, Promise.all([
                                redis.del(this.ALL_TEMPLATES_CACHE_KEY),
                                redis.del(this.TEMPLATE_CACHE_KEY(id)),
                                this.queueAuditLog(deletedBy, "DELETE_EMAIL_TEMPLATE", "EMAIL_TEMPLATE", id, { deleted: true }),
                            ])];
                    case 2:
                        _a.sent();
                        logger.info("Email template deleted", { id: id });
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        errorMessage = error_7 instanceof Error ? error_7.message : "Unknown error";
                        logger.error("Failed to delete email template", { id: id, error: errorMessage });
                        throw new Error("Failed to delete template: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.getTemplates = function () {
        return __awaiter(this, void 0, Promise, function () {
            var redis, cachedTemplates, templates, error_8, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        redis = redis_1.getRedisClient();
                        return [4 /*yield*/, redis.get(this.ALL_TEMPLATES_CACHE_KEY)];
                    case 1:
                        cachedTemplates = _a.sent();
                        if (cachedTemplates) {
                            logger.info("Email templates retrieved from cache", { cacheKey: this.ALL_TEMPLATES_CACHE_KEY });
                            return [2 /*return*/, JSON.parse(cachedTemplates)];
                        }
                        return [4 /*yield*/, prisma.emailTemplate.findMany({
                                select: {
                                    id: true,
                                    name: true,
                                    subject: true,
                                    htmlContent: true,
                                    roles: true,
                                    eventTypeId: true,
                                    updatedBy: true,
                                    updatedAt: true,
                                    isActive: true
                                }
                            })];
                    case 2:
                        templates = _a.sent();
                        return [4 /*yield*/, redis.setEx(this.ALL_TEMPLATES_CACHE_KEY, this.CACHE_TTL, JSON.stringify(templates))];
                    case 3:
                        _a.sent();
                        logger.info("Email templates retrieved", { count: templates.length });
                        return [2 /*return*/, templates];
                    case 4:
                        error_8 = _a.sent();
                        errorMessage = error_8 instanceof Error ? error_8.message : "Unknown error";
                        logger.error("Failed to retrieve email templates", { error: errorMessage });
                        throw new Error("Failed to retrieve templates: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.getById = function (id) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, cacheKey, cachedTemplate, template, error_9, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        redis = redis_1.getRedisClient();
                        cacheKey = this.TEMPLATE_CACHE_KEY(id);
                        return [4 /*yield*/, redis.get(cacheKey)];
                    case 1:
                        cachedTemplate = _a.sent();
                        if (cachedTemplate) {
                            logger.info("Email template retrieved from cache", { id: id, cacheKey: cacheKey });
                            return [2 /*return*/, JSON.parse(cachedTemplate)];
                        }
                        return [4 /*yield*/, prisma.emailTemplate.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    name: true,
                                    subject: true,
                                    htmlContent: true,
                                    roles: true,
                                    eventTypeId: true,
                                    updatedBy: true,
                                    updatedAt: true,
                                    isActive: true
                                }
                            })];
                    case 2:
                        template = _a.sent();
                        if (!template) return [3 /*break*/, 4];
                        return [4 /*yield*/, redis.setEx(cacheKey, this.CACHE_TTL, JSON.stringify(template))];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        logger.info("Email template retrieved", { id: id, found: !!template });
                        return [2 /*return*/, template];
                    case 5:
                        error_9 = _a.sent();
                        errorMessage = error_9 instanceof Error ? error_9.message : "Unknown error";
                        logger.error("Failed to retrieve email template", { id: id, error: errorMessage });
                        throw new Error("Failed to retrieve template: " + errorMessage);
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.sendOtpEmail = function (_a) {
        var email = _a.email, otpCode = _a.otpCode, _b = _a.eventType, eventType = _b === void 0 ? "otp verification" : _b, _c = _a.metadata, metadata = _c === void 0 ? {} : _c;
        return __awaiter(this, void 0, Promise, function () {
            var redis, rateLimitKey, emailCount, mappedEventType, validEventTypes, applicableRoles, userRole, eventTypeId, template, subject, htmlContent, payload, validRecipients, error_10, errorMessage, mappedEventType, eventTypeId;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 8, , 11]);
                        redis = redis_1.getRedisClient();
                        rateLimitKey = this.RATE_LIMIT_KEY(email);
                        return [4 /*yield*/, redis.incr(rateLimitKey)];
                    case 1:
                        emailCount = _d.sent();
                        return [4 /*yield*/, redis.expire(rateLimitKey, 60)];
                    case 2:
                        _d.sent();
                        if (emailCount > 5) {
                            throw new Error("Email sending rate limit exceeded for this email address");
                        }
                        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                            throw new Error("Invalid email format");
                        }
                        mappedEventType = EventTypeDictionary_1.mapToEventType(eventType);
                        validEventTypes = [
                            EventTypeDictionary_1.KnownEventTypes.OTP_VERIFICATION,
                            EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET,
                            EventTypeDictionary_1.KnownEventTypes.ACCOUNT_VERIFICATION,
                            EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST,
                            EventTypeDictionary_1.KnownEventTypes.MIGRATION_VERIFICATION,
                        ];
                        if (!validEventTypes.includes(mappedEventType)) {
                            throw new Error("Invalid event type for OTP email: " + mappedEventType);
                        }
                        if (metadata.role) {
                            applicableRoles = EventTypeDictionary_1.RoleEventApplicability[mappedEventType];
                            userRole = metadata.role;
                            if (!applicableRoles.includes(userRole)) {
                                throw new Error("Role " + userRole + " is not applicable for " + mappedEventType);
                            }
                        }
                        return [4 /*yield*/, this.ensureEventType(mappedEventType, metadata.userId || "system")];
                    case 3:
                        eventTypeId = _d.sent();
                        return [4 /*yield*/, prisma.emailTemplate.findFirst({
                                where: { eventTypeId: eventTypeId, isActive: true }
                            })];
                    case 4:
                        template = _d.sent();
                        subject = void 0;
                        htmlContent = void 0;
                        if (template) {
                            subject = this.renderTemplate(template.subject, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt }, metadata));
                            htmlContent = this.renderTemplate(template.htmlContent, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt }, metadata));
                        }
                        else {
                            switch (mappedEventType) {
                                case EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET:
                                    subject = defaultPasswordResetTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultPasswordResetTemplate.htmlContent, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt || new Date().toLocaleString() }, metadata));
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.ACCOUNT_VERIFICATION:
                                    subject = defaultAccountVerificationTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultAccountVerificationTemplate.htmlContent, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt || new Date().toLocaleString() }, metadata));
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST:
                                    subject = defaultAccountDeletionRequestTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultAccountDeletionRequestTemplate.htmlContent, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt || new Date().toLocaleString() }, metadata));
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.MIGRATION_VERIFICATION: // Added case for MIGRATION_VERIFICATION
                                    subject = "Verify Your Quicrefill Account Migration";
                                    htmlContent = this.renderTemplate(defaultOtpTemplate.htmlContent, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt || new Date().toLocaleString() }, metadata));
                                    break;
                                default:
                                    subject = defaultOtpTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultOtpTemplate.htmlContent, __assign({ otpCode: otpCode, expiresAt: metadata.expiresAt || new Date().toLocaleString() }, metadata));
                            }
                        }
                        payload = {
                            to: email,
                            subject: subject,
                            htmlContent: htmlContent
                        };
                        return [4 /*yield*/, this.filterValidEmailRecipients([email])];
                    case 5:
                        validRecipients = _d.sent();
                        if (!validRecipients.length) {
                            logger.info("No valid recipients after preference check", { email: email });
                            return [2 /*return*/, payload];
                        }
                        return [4 /*yield*/, sendMail(validRecipients, {
                                subject: subject,
                                htmlBody: htmlContent,
                                metadata: {
                                    userId: metadata.userId,
                                    eventType: mappedEventType,
                                    templateId: template === null || template === void 0 ? void 0 : template.id,
                                    eventTypeId: eventTypeId
                                }
                            })];
                    case 6:
                        _d.sent();
                        return [4 /*yield*/, prisma.notificationLog.create({
                                data: {
                                    userId: metadata.userId,
                                    type: "EMAIL",
                                    channel: "EMAIL",
                                    recipient: email,
                                    eventTypeId: eventTypeId,
                                    status: "SENT",
                                    payload: {
                                        templateId: (template === null || template === void 0 ? void 0 : template.id) || null,
                                        content: htmlContent,
                                        metadata: metadata
                                    }
                                }
                            })];
                    case 7:
                        _d.sent();
                        logger.info("OTP email sent", { email: email, eventType: mappedEventType });
                        return [2 /*return*/, payload];
                    case 8:
                        error_10 = _d.sent();
                        errorMessage = error_10 instanceof Error ? error_10.message : "Unknown error";
                        mappedEventType = EventTypeDictionary_1.mapToEventType(eventType);
                        return [4 /*yield*/, this.ensureEventType(mappedEventType, metadata.userId || "system")];
                    case 9:
                        eventTypeId = _d.sent();
                        return [4 /*yield*/, prisma.notificationLog.create({
                                data: {
                                    userId: metadata.userId,
                                    type: "EMAIL",
                                    channel: "EMAIL",
                                    recipient: email,
                                    eventTypeId: eventTypeId,
                                    status: "FAILED",
                                    payload: {
                                        templateId: null,
                                        error: errorMessage,
                                        metadata: metadata
                                    }
                                }
                            })];
                    case 10:
                        _d.sent();
                        logger.error("Failed to send OTP email", { email: email, error: errorMessage });
                        throw new Error("Failed to send OTP email: " + errorMessage);
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    // File: src/services/email.ts
    // Replace the sendEmail method inside EmailTemplateService class
    EmailTemplateService.prototype.sendEmail = function (_a) {
        var templateId = _a.templateId, eventType = _a.eventType, roles = _a.roles, customPayload = _a.customPayload, userIds = _a.userIds, _b = _a.metadata, metadata = _b === void 0 ? {} : _b;
        return __awaiter(this, void 0, Promise, function () {
            var recipients, redis, rateLimitIdentifier, rateLimitKey, emailCount, validRecipients, mappedEventType, applicableRoles, filteredRecipients, subject, htmlContent, eventTypeId, template, template, emailPayload, _c, _d, _e, _f, _g, _h, error_11, errorMessage, eventTypeId, _j, _k, _l, _m, _o, _p;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0:
                        recipients = [];
                        _q.label = 1;
                    case 1:
                        _q.trys.push([1, 23, , 28]);
                        redis = redis_1.getRedisClient();
                        rateLimitIdentifier = templateId || (customPayload === null || customPayload === void 0 ? void 0 : customPayload.to.toString()) || (userIds === null || userIds === void 0 ? void 0 : userIds.join(",")) || "default";
                        rateLimitKey = this.RATE_LIMIT_KEY(rateLimitIdentifier);
                        return [4 /*yield*/, redis.incr(rateLimitKey)];
                    case 2:
                        emailCount = _q.sent();
                        return [4 /*yield*/, redis.expire(rateLimitKey, 60)];
                    case 3:
                        _q.sent();
                        if (emailCount > 10) {
                            throw new Error("Email sending rate limit exceeded");
                        }
                        if (!(userIds && userIds.length > 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getEmailsByUserIds(userIds)];
                    case 4:
                        recipients = _q.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        if (!(roles && roles.length > 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.getEmailsByRoles(roles)];
                    case 6:
                        recipients = _q.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        if (customPayload) {
                            recipients = Array.isArray(customPayload.to) ? customPayload.to : [customPayload.to];
                        }
                        _q.label = 8;
                    case 8:
                        if (!recipients.length) {
                            throw new Error("No recipients found");
                        }
                        validRecipients = recipients.filter(function (email) { return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); });
                        if (!validRecipients.length) {
                            throw new Error("No valid email addresses found");
                        }
                        mappedEventType = eventType ? EventTypeDictionary_1.mapToEventType(eventType) : EventTypeDictionary_1.KnownEventTypes.OTHERS;
                        applicableRoles = EventTypeDictionary_1.RoleEventApplicability[mappedEventType] || [];
                        return [4 /*yield*/, this.filterValidEmailRecipients(validRecipients, applicableRoles)];
                    case 9:
                        filteredRecipients = _q.sent();
                        if (!filteredRecipients.length) {
                            logger.info("No valid recipients after preference and role applicability check", {
                                recipients: validRecipients,
                                eventType: mappedEventType
                            });
                            return [2 /*return*/, {
                                    to: validRecipients,
                                    subject: (customPayload === null || customPayload === void 0 ? void 0 : customPayload.subject) || defaultEmailTemplate.subject,
                                    htmlContent: (customPayload === null || customPayload === void 0 ? void 0 : customPayload.htmlContent) || defaultEmailTemplate.htmlContent
                                }];
                        }
                        subject = void 0;
                        htmlContent = void 0;
                        eventTypeId = void 0;
                        if (!(customPayload && customPayload.subject && customPayload.htmlContent)) return [3 /*break*/, 11];
                        subject = this.renderTemplate(customPayload.subject, metadata);
                        htmlContent = this.renderTemplate(customPayload.htmlContent, metadata);
                        return [4 /*yield*/, this.ensureEventType(mappedEventType, metadata.userId || "system")];
                    case 10:
                        eventTypeId = _q.sent();
                        return [3 /*break*/, 18];
                    case 11:
                        if (!templateId) return [3 /*break*/, 14];
                        return [4 /*yield*/, prisma.emailTemplate.findUnique({ where: { id: templateId } })];
                    case 12:
                        template = _q.sent();
                        if (!template || !template.isActive) {
                            throw new Error("Invalid or inactive template");
                        }
                        subject = this.renderTemplate(template.subject, metadata);
                        htmlContent = this.renderTemplate(template.htmlContent, metadata);
                        return [4 /*yield*/, this.ensureEventType(EventTypeDictionary_1.KnownEventTypes.OTHERS, metadata.userId || "system")];
                    case 13:
                        eventTypeId = _q.sent();
                        return [3 /*break*/, 18];
                    case 14:
                        if (!eventType) return [3 /*break*/, 17];
                        return [4 /*yield*/, this.ensureEventType(mappedEventType, metadata.userId || "system")];
                    case 15:
                        eventTypeId = _q.sent();
                        return [4 /*yield*/, prisma.emailTemplate.findFirst({
                                where: { eventTypeId: eventTypeId, isActive: true }
                            })];
                    case 16:
                        template = _q.sent();
                        if (template) {
                            subject = this.renderTemplate(template.subject, metadata);
                            htmlContent = this.renderTemplate(template.htmlContent, metadata);
                        }
                        else {
                            switch (mappedEventType) {
                                case EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET:
                                    subject = defaultPasswordResetConfirmationTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultPasswordResetConfirmationTemplate.htmlContent, metadata);
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.ACCOUNT_VERIFICATION:
                                    subject = defaultAccountVerificationTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultAccountVerificationTemplate.htmlContent, metadata);
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.REGISTRATION_SUCCESS:
                                    subject = defaultRegistrationSuccessTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultRegistrationSuccessTemplate.htmlContent, metadata);
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.REGISTRATION_FAILED:
                                    subject = defaultRegistrationFailureTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultRegistrationFailureTemplate.htmlContent, metadata);
                                    break;
                                case EventTypeDictionary_1.KnownEventTypes.LOGIN_SUCCESS:
                                    subject = defaultLoginSuccessTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultLoginSuccessTemplate.htmlContent, metadata);
                                    break;
                                default:
                                    subject = defaultEmailTemplate.subject;
                                    htmlContent = this.renderTemplate(defaultEmailTemplate.htmlContent, __assign({ message: metadata.message || "You have a new notification." }, metadata));
                            }
                        }
                        return [3 /*break*/, 18];
                    case 17: throw new Error("Either templateId, eventType, or customPayload with subject and htmlContent is required");
                    case 18:
                        emailPayload = {
                            to: filteredRecipients,
                            subject: subject,
                            htmlContent: htmlContent
                        };
                        return [4 /*yield*/, sendMail(filteredRecipients, {
                                subject: subject,
                                htmlBody: htmlContent,
                                from: customPayload === null || customPayload === void 0 ? void 0 : customPayload.from,
                                metadata: {
                                    userId: (userIds === null || userIds === void 0 ? void 0 : userIds[0]) || metadata.userId,
                                    eventType: mappedEventType,
                                    templateId: templateId,
                                    eventTypeId: eventTypeId
                                }
                            })];
                    case 19:
                        _q.sent();
                        _d = (_c = prisma.notificationLog).create;
                        _e = {};
                        _f = {
                            userId: (userIds === null || userIds === void 0 ? void 0 : userIds[0]) || metadata.userId,
                            type: "EMAIL",
                            channel: "EMAIL",
                            recipient: filteredRecipients.join(","),
                            eventTypeId: eventTypeId,
                            status: "SENT"
                        };
                        _g = {
                            templateId: templateId || null,
                            content: htmlContent
                        };
                        _h = (customPayload === null || customPayload === void 0 ? void 0 : customPayload.from);
                        if (_h) return [3 /*break*/, 21];
                        return [4 /*yield*/, getEmailConfig()];
                    case 20:
                        _h = (_q.sent()).emailFrom;
                        _q.label = 21;
                    case 21: return [4 /*yield*/, _d.apply(_c, [(_e.data = (_f.payload = (_g.from = _h,
                                _g.metadata = metadata,
                                _g),
                                _f),
                                _e)])];
                    case 22:
                        _q.sent();
                        logger.info("Email sent", { recipients: filteredRecipients, subject: subject, eventType: mappedEventType, from: customPayload === null || customPayload === void 0 ? void 0 : customPayload.from });
                        return [2 /*return*/, emailPayload];
                    case 23:
                        error_11 = _q.sent();
                        errorMessage = error_11 instanceof Error ? error_11.message : "Unknown error";
                        return [4 /*yield*/, this.ensureEventType(EventTypeDictionary_1.KnownEventTypes.OTHERS, metadata.userId || "system")];
                    case 24:
                        eventTypeId = _q.sent();
                        _k = (_j = prisma.notificationLog).create;
                        _l = {};
                        _m = {
                            userId: (userIds === null || userIds === void 0 ? void 0 : userIds[0]) || metadata.userId,
                            type: "EMAIL",
                            channel: "EMAIL",
                            recipient: recipients.join(",") || null,
                            eventTypeId: eventTypeId,
                            status: "FAILED"
                        };
                        _o = {
                            templateId: templateId || null,
                            error: errorMessage
                        };
                        _p = (customPayload === null || customPayload === void 0 ? void 0 : customPayload.from);
                        if (_p) return [3 /*break*/, 26];
                        return [4 /*yield*/, getEmailConfig()];
                    case 25:
                        _p = (_q.sent()).emailFrom;
                        _q.label = 26;
                    case 26: return [4 /*yield*/, _k.apply(_j, [(_l.data = (_m.payload = (_o.from = _p,
                                _o.metadata = metadata,
                                _o),
                                _m),
                                _l)])];
                    case 27:
                        _q.sent();
                        logger.error("Failed to send email", { error: errorMessage, recipients: recipients, eventType: eventType, from: customPayload === null || customPayload === void 0 ? void 0 : customPayload.from });
                        throw new Error("Failed to send email: " + errorMessage);
                    case 28: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.getEmailsByRoles = function (roles) {
        return __awaiter(this, void 0, Promise, function () {
            var users, emails, error_12, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.user.findMany({
                                where: { role: { "in": roles } },
                                select: { email: true }
                            })];
                    case 1:
                        users = _a.sent();
                        emails = users.map(function (u) { return u.email; }).filter(function (email) { return Boolean(email); });
                        logger.info("Emails retrieved by roles", { roles: roles, count: emails.length });
                        return [2 /*return*/, emails];
                    case 2:
                        error_12 = _a.sent();
                        errorMessage = error_12 instanceof Error ? error_12.message : "Unknown error";
                        logger.error("Failed to retrieve emails by roles", { roles: roles, error: errorMessage });
                        throw new Error("Failed to retrieve emails: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.getEmailsByUserIds = function (userIds) {
        return __awaiter(this, void 0, Promise, function () {
            var users, emails, error_13, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.user.findMany({
                                where: { id: { "in": userIds } },
                                select: { email: true }
                            })];
                    case 1:
                        users = _a.sent();
                        emails = users.map(function (u) { return u.email; }).filter(function (email) { return Boolean(email); });
                        logger.info("Emails retrieved by user IDs", { userIds: userIds, count: emails.length });
                        return [2 /*return*/, emails];
                    case 2:
                        error_13 = _a.sent();
                        errorMessage = error_13 instanceof Error ? error_13.message : "Unknown error";
                        logger.error("Failed to retrieve emails by user IDs", { userIds: userIds, error: errorMessage });
                        throw new Error("Failed to retrieve emails: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.filterValidEmailRecipients = function (emails, applicableRoles) {
        if (applicableRoles === void 0) { applicableRoles = []; }
        return __awaiter(this, void 0, Promise, function () {
            var users, error_14, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.user.findMany({
                                where: __assign({ email: { "in": emails }, notificationsEnabled: true, OR: [
                                        { notificationPreference: null },
                                        { notificationPreference: { "in": ["EMAIL", "ALL"] } },
                                    ] }, (applicableRoles.length > 0 && { role: { "in": applicableRoles } })),
                                select: { email: true }
                            })];
                    case 1:
                        users = _a.sent();
                        return [2 /*return*/, users.map(function (u) { return u.email; }).filter(function (email) { return Boolean(email); })];
                    case 2:
                        error_14 = _a.sent();
                        errorMessage = error_14 instanceof Error ? error_14.message : "Unknown error";
                        logger.error("Failed to filter email recipients", { error: errorMessage });
                        throw new Error("Failed to filter recipients: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EmailTemplateService.prototype.renderTemplate = function (template, data) {
        return template.replace(/{(\w+)}/g, function (_, key) { var _a; return String((_a = data[key]) !== null && _a !== void 0 ? _a : ""); });
    };
    EmailTemplateService.prototype.queueAuditLog = function (userId, action, entityType, entityId, details) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, auditLog, error_15, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        redis = redis_1.getRedisClient();
                        auditLog = {
                            userId: userId,
                            action: action,
                            entityType: entityType,
                            entityId: entityId,
                            details: JSON.stringify(details),
                            timestamp: new Date().toISOString()
                        };
                        return [4 /*yield*/, redis.lPush(this.AUDIT_QUEUE_KEY, JSON.stringify(auditLog))];
                    case 1:
                        _a.sent();
                        logger.info("Audit log queued", { action: action, entityType: entityType, entityId: entityId });
                        return [3 /*break*/, 3];
                    case 2:
                        error_15 = _a.sent();
                        errorMessage = error_15 instanceof Error ? error_15.message : "Unknown error";
                        logger.error("Failed to queue audit log", { action: action, entityType: entityType, entityId: entityId, error: errorMessage });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return EmailTemplateService;
}());
exports.EmailTemplateService = EmailTemplateService;
exports.emailTemplateService = new EmailTemplateService();
var processEmailQueue = function () { return __awaiter(void 0, void 0, void 0, function () {
    var redis, emailJob, _a, to, subject, htmlBody, from, metadata, error_16, errorMessage;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!true) return [3 /*break*/, 9];
                _b.label = 1;
            case 1:
                _b.trys.push([1, 6, , 8]);
                redis = redis_1.getRedisClient();
                return [4 /*yield*/, redis.rPop("email_queue")];
            case 2:
                emailJob = _b.sent();
                if (!emailJob) return [3 /*break*/, 4];
                _a = JSON.parse(emailJob), to = _a.to, subject = _a.subject, htmlBody = _a.htmlBody, from = _a.from, metadata = _a.metadata;
                return [4 /*yield*/, sendMail(to, { subject: subject, htmlBody: htmlBody, from: from, metadata: metadata })];
            case 3:
                _b.sent();
                logger.info("Processed queued email", { to: to, subject: subject, from: from });
                _b.label = 4;
            case 4: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
            case 5:
                _b.sent();
                return [3 /*break*/, 8];
            case 6:
                error_16 = _b.sent();
                errorMessage = error_16 instanceof Error ? error_16.message : "Unknown error";
                logger.error("Failed to process queued email", { error: errorMessage });
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
            case 7:
                _b.sent();
                return [3 /*break*/, 8];
            case 8: return [3 /*break*/, 0];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.startEmailQueue = function () {
    processEmailQueue()["catch"](function (error) {
        var errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("Email queue processing failed", { error: errorMessage });
    });
};
