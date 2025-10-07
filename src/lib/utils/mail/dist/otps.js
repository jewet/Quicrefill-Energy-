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
exports.otpService = exports.OtpService = void 0;
var client_1 = require("@prisma/client");
var winston_1 = require("winston");
var nodemailer_1 = require("nodemailer");
var secrets_1 = require("../../../secrets");
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
// Configure Nodemailer transporter (temporary, to be replaced by EmailService)
var transporter = nodemailer_1["default"].createTransport({
    host: secrets_1.SMTP_HOST,
    port: secrets_1.SMTP_PORT || 465,
    secure: true,
    auth: {
        user: secrets_1.SMTP_USER,
        pass: secrets_1.SMTP_PASSWORD
    }
});
// Default OTP email template with enhanced styling
var defaultOtpTemplate = {
    subject: "Your OTP Code",
    htmlContent: "\n    <!DOCTYPE html>\n    <html lang=\"en\">\n    <head>\n      <meta charset=\"UTF-8\">\n      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n      <title>Your OTP Code</title>\n      <style>\n        body {\n          margin: 0;\n          padding: 0;\n          font-family: 'Arial', sans-serif;\n          background-color: #f4f4f4;\n          color: #333;\n        }\n        .container {\n          max-width: 600px;\n          margin: 20px auto;\n          background: #ffffff;\n          border-radius: 8px;\n          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\n          overflow: hidden;\n        }\n        .header {\n          background: #4a90e2;\n          padding: 20px;\n          text-align: center;\n        }\n        .header h1 {\n          margin: 0;\n          color: #ffffff;\n          font-size: 24px;\n        }\n        .content {\n          padding: 30px;\n          text-align: center;\n        }\n        .otp-code {\n          font-size: 32px;\n          font-weight: bold;\n          color: #4a90e2;\n          letter-spacing: 2px;\n          margin: 20px 0;\n          background: #f0f8ff;\n          padding: 15px;\n          border-radius: 4px;\n        }\n        .content p {\n          font-size: 16px;\n          line-height: 1.5;\n          margin: 10px 0;\n        }\n        .footer {\n          background: #f4f4f4;\n          padding: 20px;\n          text-align: center;\n          font-size: 14px;\n          color: #666;\n        }\n        .footer a {\n          color: #4a90e2;\n          text-decoration: none;\n        }\n        @media (max-width: 600px) {\n          .container {\n            margin: 10px;\n          }\n          .content {\n            padding: 20px;\n          }\n          .otp-code {\n            font-size: 28px;\n          }\n        }\n      </style>\n    </head>\n    <body>\n      <div class=\"container\">\n        <div class=\"header\">\n          <h1>Your OTP Code</h1>\n        </div>\n        <div class=\"content\">\n          <p>Please use the following OTP to verify your account:</p>\n          <div class=\"otp-code\">{otp}</div>\n          <p>This OTP will expire at {expiresAt}.</p>\n          <p>If you didn't request this OTP, please ignore this email or <a href=\"mailto:support@example.com\">contact support</a>.</p>\n        </div>\n        <div class=\"footer\">\n          <p>&copy; 2025 Your Company. All rights reserved.</p>\n          <p><a href=\"https://example.com\">Visit our website</a> | <a href=\"mailto:support@example.com\">Support</a></p>\n        </div>\n      </div>\n    </body>\n    </html>\n  "
};
var OtpService = /** @class */ (function () {
    function OtpService() {
    }
    /**
     * Generates and stores an OTP, then sends it via the specified medium
     * @param request - OTP request data
     * @returns OTP record
     */
    OtpService.prototype.generateAndSendOtp = function (request) {
        return __awaiter(this, void 0, Promise, function () {
            var userId, email, phoneNumber, medium, transactionReference, otpCode, expiresAt, otp, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userId = request.userId, email = request.email, phoneNumber = request.phoneNumber, medium = request.medium, transactionReference = request.transactionReference;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                        expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                        return [4 /*yield*/, prisma.otp.create({
                                data: {
                                    code: otpCode,
                                    userId: userId,
                                    email: email,
                                    phoneNumber: phoneNumber,
                                    medium: medium,
                                    transactionReference: transactionReference,
                                    expiresAt: expiresAt,
                                    verified: false,
                                    attempts: 0
                                }
                            })];
                    case 2:
                        otp = _a.sent();
                        logger.info("OTP generated and stored", { userId: userId, transactionReference: transactionReference });
                        if (!(medium.includes("EMAIL") && email)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.sendOtpEmail(email, otpCode, expiresAt)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        // TODO: Implement SMS sending logic if medium includes "SMS"
                        if (medium.includes("SMS") && phoneNumber) {
                            logger.warn("SMS sending not implemented", { phoneNumber: phoneNumber });
                            // Placeholder for SMS service integration
                        }
                        return [2 /*return*/, otp];
                    case 5:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to generate and send OTP", { userId: userId, transactionReference: transactionReference, error: errorMessage });
                        throw new Error("Failed to generate OTP: " + errorMessage);
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sends an OTP email using a template from the database or the default template
     * @param email - Recipient email
     * @param otpCode - OTP code
     * @param expiresAt - OTP expiry date
     */
    OtpService.prototype.sendOtpEmail = function (email, otpCode, expiresAt) {
        return __awaiter(this, void 0, Promise, function () {
            var template, subject, htmlContent, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.getEmailTemplateByEventType("OTP")];
                    case 1:
                        template = _a.sent();
                        subject = void 0;
                        htmlContent = void 0;
                        if (template && template.isActive) {
                            // Use admin-created template
                            subject = template.subject;
                            htmlContent = template.htmlContent
                                .replace("{otp}", otpCode)
                                .replace("{expiresAt}", expiresAt.toLocaleString());
                            logger.info("Using admin-created OTP email template", { templateId: template.id });
                        }
                        else {
                            // Fallback to default template
                            subject = defaultOtpTemplate.subject;
                            htmlContent = defaultOtpTemplate.htmlContent
                                .replace("{otp}", otpCode)
                                .replace("{expiresAt}", expiresAt.toLocaleString());
                            logger.info("Using default OTP email template", { email: email });
                        }
                        // Send email (temporary, to be replaced by EmailService)
                        return [4 /*yield*/, transporter.sendMail({
                                from: "Your Company " + secrets_1.EMAIL_FROM,
                                to: email,
                                subject: subject,
                                html: htmlContent
                            })];
                    case 2:
                        // Send email (temporary, to be replaced by EmailService)
                        _a.sent();
                        logger.info("OTP email sent successfully", { email: email, subject: subject });
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to send OTP email", { email: email, error: errorMessage });
                        throw new Error("Failed to send OTP email: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetches an email template by event type
     * @param eventType - The event type (e.g., OTP)
     * @returns Template or null if not found
     */
    OtpService.prototype.getEmailTemplateByEventType = function (eventType) {
        return __awaiter(this, void 0, Promise, function () {
            var template, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.emailTemplate.findFirst({
                                where: {
                                    eventType: eventType,
                                    isActive: true
                                }
                            })];
                    case 1:
                        template = _a.sent();
                        logger.info("Email template fetched by event type", { eventType: eventType, found: !!template });
                        return [2 /*return*/, template];
                    case 2:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : "Unknown error";
                        logger.error("Failed to fetch email template by event type", { eventType: eventType, error: errorMessage });
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verifies an OTP
     * @param transactionReference - Transaction reference
     * @param code - OTP code to verify
     * @returns Verification result
     */
    OtpService.prototype.verifyOtp = function (transactionReference, code) {
        return __awaiter(this, void 0, Promise, function () {
            var otp, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, prisma.otp.findUnique({
                                where: { transactionReference: transactionReference }
                            })];
                    case 1:
                        otp = _a.sent();
                        if (!otp) {
                            logger.error("OTP not found", { transactionReference: transactionReference });
                            throw new Error("OTP not found");
                        }
                        if (otp.verified) {
                            logger.error("OTP already verified", { transactionReference: transactionReference });
                            throw new Error("OTP already verified");
                        }
                        if (otp.expiresAt < new Date()) {
                            logger.error("OTP expired", { transactionReference: transactionReference });
                            throw new Error("OTP expired");
                        }
                        if (otp.attempts >= 3) {
                            logger.error("Maximum OTP attempts exceeded", { transactionReference: transactionReference });
                            throw new Error("Maximum attempts exceeded");
                        }
                        if (!(otp.code !== code)) return [3 /*break*/, 3];
                        return [4 /*yield*/, prisma.otp.update({
                                where: { transactionReference: transactionReference },
                                data: { attempts: otp.attempts + 1 }
                            })];
                    case 2:
                        _a.sent();
                        logger.error("Invalid OTP code", { transactionReference: transactionReference });
                        throw new Error("Invalid OTP code");
                    case 3: return [4 /*yield*/, prisma.otp.update({
                            where: { transactionReference: transactionReference },
                            data: { verified: true }
                        })];
                    case 4:
                        _a.sent();
                        logger.info("OTP verified successfully", { transactionReference: transactionReference });
                        return [2 /*return*/, true];
                    case 5:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : "Unknown error";
                        logger.error("Failed to verify OTP", { transactionReference: transactionReference, error: errorMessage });
                        throw new Error("Failed to verify OTP: " + errorMessage);
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return OtpService;
}());
exports.OtpService = OtpService;
exports.otpService = new OtpService();
