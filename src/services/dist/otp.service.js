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
exports.OtpService = void 0;
// src/services/OtpService.ts
var client_1 = require("@prisma/client");
var SMSTemplateService_1 = require("./SMSTemplateService");
var email_1 = require("./email");
var crypto_1 = require("crypto");
var winston_1 = require("winston");
var prisma = new client_1.PrismaClient();
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "info" }),
        new winston_1["default"].transports.File({ filename: "logs/combined.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
var OtpService = /** @class */ (function () {
    function OtpService() {
    }
    OtpService.createOtp = function (userId, _a) {
        var phoneNumber = _a.phoneNumber, email = _a.email, _b = _a.medium, medium = _b === void 0 ? ["sms"] : _b;
        return __awaiter(this, void 0, Promise, function () {
            var user, userRole, validMediums_1, normalizedPhoneNumber, normalizedEmail, otpCode, expiresAt, transactionReference, existingOtp, otpRecord, error_1, errorMessage;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 10, , 11]);
                        return [4 /*yield*/, prisma.user.findUnique({
                                where: { id: userId },
                                select: {
                                    id: true,
                                    email: true,
                                    name: true,
                                    phoneNumber: true,
                                    role: true
                                }
                            })];
                    case 1:
                        user = _c.sent();
                        if (!user)
                            throw new Error("User not found");
                        if (!user.name)
                            throw new Error("User must have a name");
                        userRole = user.role;
                        validMediums_1 = ["sms", "email", "whatsapp"];
                        if (!medium.every(function (m) { return validMediums_1.includes(m); })) {
                            throw new Error("Medium must be an array containing 'sms', 'email', or 'whatsapp'");
                        }
                        if (medium.includes("sms") && !phoneNumber) {
                            throw new Error("Phone number is required for SMS medium");
                        }
                        if (medium.includes("email") && !email && !user.email) {
                            throw new Error("Email is required for email medium");
                        }
                        if (phoneNumber && !phoneNumber.match(/^(\+?\d{10,15})$/)) {
                            logger.error("Invalid phone number format", { phoneNumber: phoneNumber });
                            throw new Error("Phone number must be 10-15 digits, with or without + prefix (e.g., +2349069284815 or 2349069284815)");
                        }
                        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                            logger.error("Invalid email format", { email: email });
                            throw new Error("Invalid email format");
                        }
                        normalizedPhoneNumber = (phoneNumber === null || phoneNumber === void 0 ? void 0 : phoneNumber.startsWith("+")) ? phoneNumber : "+" + phoneNumber;
                        normalizedEmail = email || user.email;
                        otpCode = crypto_1["default"].randomInt(1000000, 9999999).toString();
                        expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                        transactionReference = crypto_1["default"].randomBytes(16).toString("hex");
                        return [4 /*yield*/, prisma.otp.findFirst({
                                where: {
                                    userId: userId,
                                    OR: [{ phoneNumber: normalizedPhoneNumber }, { email: normalizedEmail }],
                                    verified: false
                                }
                            })];
                    case 2:
                        existingOtp = _c.sent();
                        if (!existingOtp) return [3 /*break*/, 4];
                        return [4 /*yield*/, prisma.otp["delete"]({ where: { id: existingOtp.id } })];
                    case 3:
                        _c.sent();
                        logger.info("Deleted stale OTP", { otpId: existingOtp.id });
                        _c.label = 4;
                    case 4: return [4 /*yield*/, prisma.otp.create({
                            data: {
                                userId: userId,
                                transactionReference: transactionReference,
                                phoneNumber: normalizedPhoneNumber,
                                email: normalizedEmail,
                                code: otpCode,
                                medium: medium,
                                expiresAt: expiresAt,
                                verified: false
                            }
                        })];
                    case 5:
                        otpRecord = _c.sent();
                        if (!(medium.includes("sms") && normalizedPhoneNumber)) return [3 /*break*/, 7];
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.sendOtpSMS({
                                phoneNumber: normalizedPhoneNumber,
                                otpCode: otpCode,
                                eventType: "OTP_VERIFICATION",
                                metadata: { userId: userId, name: user.name, role: userRole }
                            })];
                    case 6:
                        _c.sent();
                        _c.label = 7;
                    case 7:
                        if (!(medium.includes("email") && normalizedEmail)) return [3 /*break*/, 9];
                        return [4 /*yield*/, email_1.emailTemplateService.sendOtpEmail({
                                email: normalizedEmail,
                                otpCode: otpCode,
                                eventType: "OTP_VERIFICATION",
                                metadata: { userId: userId, name: user.name, role: userRole }
                            })];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9: 
                    // TODO: Implement WhatsApp OTP delivery
                    return [2 /*return*/, {
                            id: otpRecord.id,
                            userId: otpRecord.userId,
                            transactionReference: otpRecord.transactionReference,
                            phoneNumber: otpRecord.phoneNumber || "",
                            email: otpRecord.email || "",
                            expiresAt: otpRecord.expiresAt,
                            verified: otpRecord.verified
                        }];
                    case 10:
                        error_1 = _c.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to create OTP", {
                            userId: userId,
                            phoneNumber: phoneNumber,
                            email: email,
                            error: errorMessage
                        });
                        throw new Error("Failed to send OTP: " + errorMessage);
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    OtpService.validateOtp = function (_a) {
        var transactionReference = _a.transactionReference, otp = _a.otp;
        return __awaiter(this, void 0, Promise, function () {
            var otpRecord, updatedOtpRecord, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, prisma.otp.findUnique({
                                where: { transactionReference: transactionReference },
                                include: { user: true }
                            })];
                    case 1:
                        otpRecord = _b.sent();
                        if (!otpRecord)
                            throw new Error("Invalid transaction reference");
                        if (new Date() > otpRecord.expiresAt)
                            throw new Error("OTP expired");
                        if (otpRecord.verified)
                            throw new Error("OTP already verified");
                        if (otpRecord.code !== otp)
                            throw new Error("Invalid OTP");
                        return [4 /*yield*/, prisma.otp.update({
                                where: { transactionReference: transactionReference },
                                data: {
                                    verified: true,
                                    updatedAt: new Date()
                                }
                            })];
                    case 2:
                        updatedOtpRecord = _b.sent();
                        // Update user's phone number or email if verified
                        return [4 /*yield*/, prisma.user.update({
                                where: { id: otpRecord.userId },
                                data: {
                                    phoneNumber: otpRecord.phoneNumber || undefined,
                                    email: otpRecord.email || undefined,
                                    phoneVerified: otpRecord.phoneNumber ? true : undefined,
                                    emailVerified: otpRecord.email ? true : undefined
                                }
                            })];
                    case 3:
                        // Update user's phone number or email if verified
                        _b.sent();
                        logger.info("OTP validated", { transactionReference: transactionReference, userId: otpRecord.userId });
                        return [2 /*return*/, {
                                id: updatedOtpRecord.id,
                                userId: updatedOtpRecord.userId,
                                transactionReference: updatedOtpRecord.transactionReference,
                                phoneNumber: updatedOtpRecord.phoneNumber || "",
                                email: updatedOtpRecord.email || "",
                                expiresAt: updatedOtpRecord.expiresAt,
                                verified: updatedOtpRecord.verified
                            }];
                    case 4:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to validate OTP", { transactionReference: transactionReference, error: errorMessage });
                        throw new Error("Failed to validate OTP: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return OtpService;
}());
exports.OtpService = OtpService;
