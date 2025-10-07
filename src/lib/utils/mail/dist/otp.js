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
exports.emailOtpService = exports.EmailOtpService = void 0;
var client_1 = require("@prisma/client");
var winston_1 = require("winston");
var email_1 = require("../../../services/email");
var EventTypeDictionary_1 = require("../../../utils/EventTypeDictionary");
var redis_1 = require("../../../config/redis");
var prisma = new client_1.PrismaClient();
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1["default"].transports.File({ filename: "logs/combined.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
var EmailOtpService = /** @class */ (function () {
    function EmailOtpService() {
        this.RATE_LIMIT_KEY = function (email) { return "otp_email_rate_limit:" + email; };
        this.RATE_LIMIT_TTL = 60;
        this.MAX_OTP_ATTEMPTS = 5;
    }
    EmailOtpService.prototype.generateAndSendOtp = function (request) {
        return __awaiter(this, void 0, Promise, function () {
            var userId, email, medium, transactionReference, eventType, _a, metadata, mappedEventType, validEventTypes, redis, rateLimitKey, otpCount, user, userRole, applicableRoles, otpCode, expiresAt, _b, _, otpRecord, otpEmailEventType, mappedOtpEmailEventType, payload, error_1, errorMessage;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        userId = request.userId, email = request.email, medium = request.medium, transactionReference = request.transactionReference, eventType = request.eventType, _a = request.metadata, metadata = _a === void 0 ? {} : _a;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 7, , 8]);
                        if (!medium.includes("EMAIL") || medium.length !== 1) {
                            throw new Error("Medium must be ['EMAIL'] for this service");
                        }
                        if (!email) {
                            throw new Error("Email is required");
                        }
                        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                            throw new Error("Invalid email format");
                        }
                        mappedEventType = EventTypeDictionary_1.mapToEventType(eventType);
                        validEventTypes = [
                            EventTypeDictionary_1.KnownEventTypes.ACCOUNT_VERIFICATION,
                            EventTypeDictionary_1.KnownEventTypes.PHONE_VERIFICATION,
                            EventTypeDictionary_1.KnownEventTypes.MIGRATION_VERIFICATION,
                            EventTypeDictionary_1.KnownEventTypes.OTP_VERIFICATION,
                            EventTypeDictionary_1.KnownEventTypes.PASSWORD_RESET,
                            EventTypeDictionary_1.KnownEventTypes.ACCOUNT_DELETION_REQUEST,
                        ];
                        if (!validEventTypes.includes(mappedEventType)) {
                            throw new Error("Invalid OTP event type: " + eventType + " (mapped to " + mappedEventType + ")");
                        }
                        redis = redis_1.getRedisClient();
                        rateLimitKey = this.RATE_LIMIT_KEY(email);
                        return [4 /*yield*/, redis.incr(rateLimitKey)];
                    case 2:
                        otpCount = _c.sent();
                        return [4 /*yield*/, redis.expire(rateLimitKey, this.RATE_LIMIT_TTL)];
                    case 3:
                        _c.sent();
                        if (otpCount > this.MAX_OTP_ATTEMPTS) {
                            throw new Error("OTP generation rate limit exceeded for this email");
                        }
                        return [4 /*yield*/, prisma.user.findUnique({
                                where: { id: userId },
                                select: { id: true, email: true, name: true, role: true }
                            })];
                    case 4:
                        user = _c.sent();
                        if (!user)
                            throw new Error("User not found");
                        if (!user.name)
                            throw new Error("User must have a name");
                        userRole = user.role;
                        applicableRoles = EventTypeDictionary_1.RoleEventApplicability[mappedEventType];
                        if (!applicableRoles.includes(userRole)) {
                            throw new Error("Role " + userRole + " is not applicable for " + mappedEventType);
                        }
                        otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                        expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                        return [4 /*yield*/, prisma.$transaction([
                                prisma.otp.deleteMany({
                                    where: { userId: userId, email: email, verified: false, eventType: mappedEventType }
                                }),
                                prisma.otp.create({
                                    data: {
                                        userId: userId,
                                        transactionReference: transactionReference,
                                        email: email,
                                        code: otpCode,
                                        medium: medium,
                                        expiresAt: expiresAt,
                                        verified: false,
                                        attempts: 0,
                                        eventType: mappedEventType
                                    }
                                }),
                            ])];
                    case 5:
                        _b = _c.sent(), _ = _b[0], otpRecord = _b[1];
                        logger.info("OTP record created", { otpId: otpRecord.id, transactionReference: transactionReference, userId: userId, email: email, code: otpCode });
                        otpEmailEventType = eventType;
                        mappedOtpEmailEventType = EventTypeDictionary_1.mapToEventType(otpEmailEventType);
                        if (!validEventTypes.includes(mappedOtpEmailEventType)) {
                            throw new Error("Invalid OTP email event type: " + otpEmailEventType + " (mapped to " + mappedOtpEmailEventType + ")");
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.sendOtpEmail({
                                email: email,
                                otpCode: otpCode,
                                eventType: otpEmailEventType,
                                metadata: __assign({ userId: userId, name: user.name, role: userRole, expiresAt: expiresAt.toLocaleString(), eventType: mappedEventType }, metadata)
                            })];
                    case 6:
                        payload = _c.sent();
                        logger.info("OTP email sent", { email: email, subject: payload.subject, eventType: otpEmailEventType, mappedEventType: mappedOtpEmailEventType });
                        return [2 /*return*/, {
                                id: otpRecord.id,
                                userId: otpRecord.userId,
                                transactionReference: otpRecord.transactionReference,
                                email: otpRecord.email || "",
                                expiresAt: otpRecord.expiresAt,
                                verified: otpRecord.verified,
                                eventType: otpRecord.eventType
                            }];
                    case 7:
                        error_1 = _c.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to generate and send OTP", {
                            userId: userId,
                            transactionReference: transactionReference,
                            eventType: eventType,
                            email: email,
                            error: errorMessage
                        });
                        throw new Error("Failed to generate OTP: " + errorMessage);
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    EmailOtpService.prototype.verifyOtp = function (transactionReference, code) {
        return __awaiter(this, void 0, Promise, function () {
            var otpRecord, updatedOtpRecord, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        logger.info("Attempting to verify OTP", { transactionReference: transactionReference, code: code });
                        return [4 /*yield*/, prisma.otp.findUnique({
                                where: { transactionReference: transactionReference },
                                include: { user: true }
                            })];
                    case 1:
                        otpRecord = _a.sent();
                        if (!otpRecord) {
                            logger.warn("OTP record not found", { transactionReference: transactionReference });
                            throw new Error("OTP not found");
                        }
                        logger.info("OTP record found", {
                            otpId: otpRecord.id,
                            userId: otpRecord.userId,
                            email: otpRecord.email,
                            expiresAt: otpRecord.expiresAt,
                            verified: otpRecord.verified,
                            attempts: otpRecord.attempts
                        });
                        if (otpRecord.verified) {
                            logger.warn("OTP already verified", { transactionReference: transactionReference });
                            throw new Error("OTP already verified");
                        }
                        if (otpRecord.expiresAt < new Date()) {
                            logger.warn("OTP expired", { transactionReference: transactionReference, expiresAt: otpRecord.expiresAt });
                            throw new Error("OTP expired");
                        }
                        if (otpRecord.attempts >= 3) {
                            logger.warn("Maximum attempts exceeded", { transactionReference: transactionReference, attempts: otpRecord.attempts });
                            throw new Error("Maximum attempts exceeded");
                        }
                        if (!(otpRecord.code !== code)) return [3 /*break*/, 3];
                        return [4 /*yield*/, prisma.otp.update({
                                where: { id: otpRecord.id },
                                data: { attempts: otpRecord.attempts + 1 }
                            })];
                    case 2:
                        _a.sent();
                        logger.warn("Invalid OTP code", { transactionReference: transactionReference, providedCode: code });
                        throw new Error("Invalid OTP code");
                    case 3: return [4 /*yield*/, prisma.otp.update({
                            where: { transactionReference: transactionReference },
                            data: { verified: true, updatedAt: new Date() }
                        })];
                    case 4:
                        updatedOtpRecord = _a.sent();
                        if (!(otpRecord.email && updatedOtpRecord.eventType === EventTypeDictionary_1.KnownEventTypes.OTP_VERIFICATION)) return [3 /*break*/, 6];
                        return [4 /*yield*/, prisma.user.update({
                                where: { id: otpRecord.userId },
                                data: { emailVerified: true }
                            })];
                    case 5:
                        _a.sent();
                        logger.info("User email verified", { userId: otpRecord.userId, email: otpRecord.email });
                        _a.label = 6;
                    case 6:
                        logger.info("OTP verified successfully", {
                            transactionReference: transactionReference,
                            userId: otpRecord.userId,
                            eventType: updatedOtpRecord.eventType
                        });
                        return [2 /*return*/, {
                                id: updatedOtpRecord.id,
                                userId: updatedOtpRecord.userId,
                                transactionReference: updatedOtpRecord.transactionReference,
                                email: updatedOtpRecord.email || "",
                                expiresAt: updatedOtpRecord.expiresAt,
                                verified: updatedOtpRecord.verified,
                                eventType: updatedOtpRecord.eventType
                            }];
                    case 7:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to verify OTP", { transactionReference: transactionReference, code: code, error: errorMessage });
                        throw new Error("Failed to verify OTP: " + errorMessage);
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return EmailOtpService;
}());
exports.EmailOtpService = EmailOtpService;
exports.emailOtpService = new EmailOtpService();
