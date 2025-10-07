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
exports.smsTemplateService = exports.SMSTemplateService = void 0;
// customer-service/src/services/SMSTemplateService.ts
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
// Flutterwave SMS client
var flutterwaveSMS = {
    sendSMS: function (_a) {
        var to = _a.to, message = _a.message;
        return __awaiter(this, void 0, void 0, function () {
            var errorMessage;
            return __generator(this, function (_b) {
                try {
                    // TODO: Replace with actual Flutterwave SMS API integration
                    logger.info("Sending SMS via Flutterwave", { to: to, message: message });
                    return [2 /*return*/, { status: "success" }];
                }
                catch (error) {
                    errorMessage = error instanceof Error ? error.message : "Unknown error";
                    logger.error("Failed to send SMS via Flutterwave", { to: to, error: errorMessage });
                    throw new Error("Flutterwave SMS failed: " + errorMessage);
                }
                return [2 /*return*/];
            });
        });
    }
};
// Default SMS template for OTHERS
var defaultSMSTemplate = {
    id: "default",
    name: "Default SMS",
    content: "You have a notification: {message}",
    roles: [],
    eventTypeId: undefined,
    updatedBy: "system",
    updatedAt: new Date().toISOString(),
    isActive: true
};
var SMSTemplateService = /** @class */ (function () {
    function SMSTemplateService() {
        this.CACHE_TTL = 3600; // 1 hour
        this.ALL_TEMPLATES_CACHE_KEY = "sms_templates";
        this.TEMPLATE_CACHE_KEY = function (id) { return "sms_template:" + id; };
        this.RATE_LIMIT_KEY = function (identifier) { return "sms_rate_limit:" + identifier; };
        this.AUDIT_QUEUE_KEY = "audit:queue";
    }
    // Admin-only methods for template management
    SMSTemplateService.prototype.createTemplate = function (data, updatedBy) {
        return __awaiter(this, void 0, Promise, function () {
            var template, redis, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (data.content.length > 160) {
                            throw new Error("SMS content must not exceed 160 characters");
                        }
                        return [4 /*yield*/, prisma.sMSTemplate.create({
                                data: {
                                    name: data.name,
                                    content: data.content,
                                    roles: data.roles || [],
                                    eventTypeId: data.eventTypeId,
                                    updatedBy: updatedBy,
                                    isActive: data.isActive !== undefined ? data.isActive : true
                                }
                            })];
                    case 1:
                        template = _a.sent();
                        redis = redis_1.getRedisClient();
                        return [4 /*yield*/, Promise.all([
                                redis.del(this.ALL_TEMPLATES_CACHE_KEY),
                                this.queueAuditLog(updatedBy, "CREATE_SMS_TEMPLATE", "SMS_TEMPLATE", template.id, data),
                            ])];
                    case 2:
                        _a.sent();
                        logger.info("SMS template created", { name: data.name, updatedBy: updatedBy });
                        return [2 /*return*/, template];
                    case 3:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to create SMS template", { name: data.name, error: errorMessage });
                        throw new Error("Failed to create template: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.updateTemplate = function (id, data, updatedBy) {
        return __awaiter(this, void 0, Promise, function () {
            var template, redis, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        if (data.content && data.content.length > 160) {
                            throw new Error("SMS content must not exceed 160 characters");
                        }
                        return [4 /*yield*/, prisma.sMSTemplate.update({
                                where: { id: id },
                                data: {
                                    name: data.name,
                                    content: data.content,
                                    roles: data.roles,
                                    eventTypeId: data.eventTypeId,
                                    updatedBy: updatedBy,
                                    isActive: data.isActive,
                                    updatedAt: new Date()
                                }
                            })];
                    case 1:
                        template = _a.sent();
                        redis = redis_1.getRedisClient();
                        return [4 /*yield*/, Promise.all([
                                redis.del(this.ALL_TEMPLATES_CACHE_KEY),
                                redis.del(this.TEMPLATE_CACHE_KEY(id)),
                                this.queueAuditLog(updatedBy, "UPDATE_SMS_TEMPLATE", "SMS_TEMPLATE", id, data),
                            ])];
                    case 2:
                        _a.sent();
                        logger.info("SMS template updated", { id: id, updatedBy: updatedBy });
                        return [2 /*return*/, template];
                    case 3:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to update SMS template", { id: id, error: errorMessage });
                        throw new Error("Failed to update template: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.deleteTemplate = function (id, deletedBy) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma.sMSTemplate["delete"]({ where: { id: id } })];
                    case 1:
                        _a.sent();
                        redis = redis_1.getRedisClient();
                        return [4 /*yield*/, Promise.all([
                                redis.del(this.ALL_TEMPLATES_CACHE_KEY),
                                redis.del(this.TEMPLATE_CACHE_KEY(id)),
                                this.queueAuditLog(deletedBy, "DELETE_SMS_TEMPLATE", "SMS_TEMPLATE", id, {}),
                            ])];
                    case 2:
                        _a.sent();
                        logger.info("SMS template deleted", { id: id });
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : "Unknown error";
                        logger.error("Failed to delete SMS template", { id: id, error: errorMessage });
                        throw new Error("Failed to delete template: " + errorMessage);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.getTemplates = function () {
        return __awaiter(this, void 0, Promise, function () {
            var redis, cachedTemplates, templates, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        redis = redis_1.getRedisClient();
                        return [4 /*yield*/, redis.get(this.ALL_TEMPLATES_CACHE_KEY)];
                    case 1:
                        cachedTemplates = _a.sent();
                        if (cachedTemplates) {
                            logger.info("SMS templates retrieved from cache", { cacheKey: this.ALL_TEMPLATES_CACHE_KEY });
                            return [2 /*return*/, JSON.parse(cachedTemplates)];
                        }
                        return [4 /*yield*/, prisma.sMSTemplate.findMany({
                                select: {
                                    id: true,
                                    name: true,
                                    content: true,
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
                        logger.info("SMS templates retrieved", { count: templates.length });
                        return [2 /*return*/, templates];
                    case 4:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : "Unknown error";
                        logger.error("Failed to retrieve SMS templates", { error: errorMessage });
                        throw new Error("Failed to retrieve templates: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.getById = function (id) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, cacheKey, cachedTemplate, template, error_5, errorMessage;
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
                            logger.info("SMS template retrieved from cache", { id: id, cacheKey: cacheKey });
                            return [2 /*return*/, JSON.parse(cachedTemplate)];
                        }
                        return [4 /*yield*/, prisma.sMSTemplate.findUnique({
                                where: { id: id },
                                select: {
                                    id: true,
                                    name: true,
                                    content: true,
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
                        logger.info("SMS template retrieved", { id: id, found: !!template });
                        return [2 /*return*/, template];
                    case 5:
                        error_5 = _a.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : "Unknown error";
                        logger.error("Failed to retrieve SMS template", { id: id, error: errorMessage });
                        throw new Error("Failed to retrieve template: " + errorMessage);
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    // Method for sending OTP SMS using a specific template
    SMSTemplateService.prototype.sendOtpSMS = function (_a) {
        var phoneNumber = _a.phoneNumber, otpCode = _a.otpCode, _b = _a.eventType, eventType = _b === void 0 ? "OTP_VERIFICATION" : _b, _c = _a.metadata, metadata = _c === void 0 ? {} : _c;
        return __awaiter(this, void 0, Promise, function () {
            var redis, rateLimitKey, smsCount, normalizedPhoneNumber, content, mappedEventType, eventTypeRecord, template, error_6, errorMessage;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 7, , 9]);
                        redis = redis_1.getRedisClient();
                        rateLimitKey = this.RATE_LIMIT_KEY(phoneNumber);
                        return [4 /*yield*/, redis.incr(rateLimitKey)];
                    case 1:
                        smsCount = _d.sent();
                        return [4 /*yield*/, redis.expire(rateLimitKey, 60)];
                    case 2:
                        _d.sent();
                        if (smsCount > 5) {
                            throw new Error("SMS sending rate limit exceeded for this phone number");
                        }
                        normalizedPhoneNumber = phoneNumber.startsWith("+") ? phoneNumber : "+" + phoneNumber;
                        if (!normalizedPhoneNumber.match(/^\+\d{10,15}$/)) {
                            throw new Error("Invalid phone number format");
                        }
                        content = void 0;
                        mappedEventType = EventTypeDictionary_1.mapToEventType(eventType);
                        return [4 /*yield*/, prisma.eventType.findFirst({ where: { name: mappedEventType } })];
                    case 3:
                        eventTypeRecord = _d.sent();
                        return [4 /*yield*/, prisma.sMSTemplate.findFirst({
                                where: { eventTypeId: eventTypeRecord === null || eventTypeRecord === void 0 ? void 0 : eventTypeRecord.id, isActive: true }
                            })];
                    case 4:
                        template = _d.sent();
                        if (template) {
                            content = this.renderTemplate(template.content, __assign({ otpCode: otpCode }, metadata));
                        }
                        else {
                            content = this.renderTemplate("Your OTP code is {otpCode}. It expires in 5 minutes.", __assign({ otpCode: otpCode }, metadata));
                        }
                        // Log notification attempt
                        return [4 /*yield*/, prisma.notificationLog.create({
                                data: {
                                    userId: metadata.userId || null,
                                    channel: "SMS",
                                    eventType: mappedEventType,
                                    status: "SENT",
                                    recipient: normalizedPhoneNumber,
                                    templateId: (template === null || template === void 0 ? void 0 : template.id) || null
                                }
                            })];
                    case 5:
                        // Log notification attempt
                        _d.sent();
                        // Send SMS
                        return [4 /*yield*/, flutterwaveSMS.sendSMS({ to: normalizedPhoneNumber, message: content })];
                    case 6:
                        // Send SMS
                        _d.sent();
                        logger.info("OTP SMS sent", { phoneNumber: normalizedPhoneNumber, eventType: eventType });
                        return [3 /*break*/, 9];
                    case 7:
                        error_6 = _d.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : "Unknown error";
                        return [4 /*yield*/, prisma.notificationLog.create({
                                data: {
                                    userId: metadata.userId || null,
                                    channel: "SMS",
                                    eventType: EventTypeDictionary_1.mapToEventType(eventType),
                                    status: "FAILED",
                                    recipient: phoneNumber,
                                    templateId: null,
                                    error: errorMessage
                                }
                            })];
                    case 8:
                        _d.sent();
                        logger.error("Failed to send OTP SMS", { phoneNumber: phoneNumber, error: errorMessage });
                        throw new Error("Failed to send OTP SMS: " + errorMessage);
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    // General-purpose SMS sending method
    SMSTemplateService.prototype.sendSMS = function (_a) {
        var templateId = _a.templateId, eventType = _a.eventType, roles = _a.roles, customPayload = _a.customPayload, userIds = _a.userIds, _b = _a.metadata, metadata = _b === void 0 ? {} : _b;
        return __awaiter(this, void 0, Promise, function () {
            var content, recipients, redis, rateLimitKey, smsCount, validRecipients, template, mappedEventType, eventTypeRecord, template, _i, validRecipients_1, recipient, error_7, errorMessage;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 20, , 21]);
                        content = void 0;
                        recipients = [];
                        redis = redis_1.getRedisClient();
                        rateLimitKey = this.RATE_LIMIT_KEY(templateId || (customPayload === null || customPayload === void 0 ? void 0 : customPayload.to.toString()));
                        return [4 /*yield*/, redis.incr(rateLimitKey)];
                    case 1:
                        smsCount = _c.sent();
                        return [4 /*yield*/, redis.expire(rateLimitKey, 60)];
                    case 2:
                        _c.sent();
                        if (smsCount > 10) {
                            throw new Error("SMS sending rate limit exceeded");
                        }
                        if (!(userIds && userIds.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getPhoneNumbersByUserIds(userIds)];
                    case 3:
                        recipients = _c.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        if (!(roles && roles.length > 0)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.getPhoneNumbersByRoles(roles)];
                    case 5:
                        recipients = _c.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        if (customPayload) {
                            recipients = Array.isArray(customPayload.to) ? customPayload.to : [customPayload.to];
                        }
                        _c.label = 7;
                    case 7:
                        if (!recipients.length) {
                            throw new Error("No recipients found");
                        }
                        return [4 /*yield*/, this.filterValidSMSRecipients(recipients)];
                    case 8:
                        validRecipients = _c.sent();
                        if (!validRecipients.length) {
                            logger.info("No valid recipients after preference check", { recipients: recipients });
                            return [2 /*return*/];
                        }
                        if (!templateId) return [3 /*break*/, 10];
                        return [4 /*yield*/, prisma.sMSTemplate.findUnique({ where: { id: templateId } })];
                    case 9:
                        template = _c.sent();
                        if (!template || !template.isActive) {
                            throw new Error("Invalid or inactive template");
                        }
                        content = this.renderTemplate(template.content, metadata);
                        return [3 /*break*/, 14];
                    case 10:
                        if (!eventType) return [3 /*break*/, 13];
                        mappedEventType = EventTypeDictionary_1.mapToEventType(eventType);
                        return [4 /*yield*/, prisma.eventType.findFirst({ where: { name: mappedEventType } })];
                    case 11:
                        eventTypeRecord = _c.sent();
                        return [4 /*yield*/, prisma.sMSTemplate.findFirst({
                                where: { eventTypeId: eventTypeRecord === null || eventTypeRecord === void 0 ? void 0 : eventTypeRecord.id, isActive: true }
                            })];
                    case 12:
                        template = _c.sent();
                        if (template) {
                            content = this.renderTemplate(template.content, metadata);
                        }
                        else {
                            content = this.renderTemplate(defaultSMSTemplate.content, {
                                message: metadata.message || "You have a new notification."
                            });
                        }
                        return [3 /*break*/, 14];
                    case 13:
                        if (customPayload) {
                            content = customPayload.content;
                        }
                        else {
                            throw new Error("Either templateId, eventType, or customPayload is required");
                        }
                        _c.label = 14;
                    case 14:
                        _i = 0, validRecipients_1 = validRecipients;
                        _c.label = 15;
                    case 15:
                        if (!(_i < validRecipients_1.length)) return [3 /*break*/, 19];
                        recipient = validRecipients_1[_i];
                        return [4 /*yield*/, flutterwaveSMS.sendSMS({ to: recipient, message: content })];
                    case 16:
                        _c.sent();
                        return [4 /*yield*/, prisma.notificationLog.create({
                                data: {
                                    userId: (userIds === null || userIds === void 0 ? void 0 : userIds.find(function (id) { return true; })) || null,
                                    channel: "SMS",
                                    eventType: eventType || "CUSTOM",
                                    status: "SENT",
                                    recipient: recipient,
                                    templateId: templateId || null
                                }
                            })];
                    case 17:
                        _c.sent();
                        _c.label = 18;
                    case 18:
                        _i++;
                        return [3 /*break*/, 15];
                    case 19:
                        logger.info("SMS sent", { recipients: validRecipients, content: content });
                        return [3 /*break*/, 21];
                    case 20:
                        error_7 = _c.sent();
                        errorMessage = error_7 instanceof Error ? error_7.message : "Unknown error";
                        logger.error("Failed to send SMS", { error: errorMessage });
                        throw new Error("Failed to send SMS: " + errorMessage);
                    case 21: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.getPhoneNumbersByRoles = function (roles) {
        return __awaiter(this, void 0, Promise, function () {
            var users, phoneNumbers, error_8, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.user.findMany({
                                where: { role: { "in": roles } },
                                select: { phoneNumber: true }
                            })];
                    case 1:
                        users = _a.sent();
                        phoneNumbers = users
                            .map(function (u) { return u.phoneNumber; })
                            .filter(function (phone) { return Boolean(phone); });
                        logger.info("Phone numbers retrieved by roles", { roles: roles, count: phoneNumbers.length });
                        return [2 /*return*/, phoneNumbers];
                    case 2:
                        error_8 = _a.sent();
                        errorMessage = error_8 instanceof Error ? error_8.message : "Unknown error";
                        logger.error("Failed to retrieve phone numbers by roles", { roles: roles, error: errorMessage });
                        throw new Error("Failed to retrieve phone numbers: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.getPhoneNumbersByUserIds = function (userIds) {
        return __awaiter(this, void 0, Promise, function () {
            var users, phoneNumbers, error_9, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.user.findMany({
                                where: { id: { "in": userIds } },
                                select: { phoneNumber: true }
                            })];
                    case 1:
                        users = _a.sent();
                        phoneNumbers = users
                            .map(function (u) { return u.phoneNumber; })
                            .filter(function (phone) { return Boolean(phone); });
                        logger.info("Phone numbers retrieved by user IDs", { userIds: userIds, count: phoneNumbers.length });
                        return [2 /*return*/, phoneNumbers];
                    case 2:
                        error_9 = _a.sent();
                        errorMessage = error_9 instanceof Error ? error_9.message : "Unknown error";
                        logger.error("Failed to retrieve phone numbers by user IDs", { userIds: userIds, error: errorMessage });
                        throw new Error("Failed to retrieve phone numbers: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.filterValidSMSRecipients = function (phoneNumbers) {
        return __awaiter(this, void 0, Promise, function () {
            var users, error_10, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.user.findMany({
                                where: { phoneNumber: { "in": phoneNumbers } },
                                select: { phoneNumber: true, notificationsEnabled: true, notificationPreference: true }
                            })];
                    case 1:
                        users = _a.sent();
                        return [2 /*return*/, users
                                .filter(function (user) {
                                return user.notificationsEnabled &&
                                    (!user.notificationPreference ||
                                        user.notificationPreference === "SMS" ||
                                        user.notificationPreference === "ALL");
                            })
                                .map(function (user) { return user.phoneNumber; })
                                .filter(function (phone) { return Boolean(phone); })];
                    case 2:
                        error_10 = _a.sent();
                        errorMessage = error_10 instanceof Error ? error_10.message : "Unknown error";
                        logger.error("Failed to filter SMS recipients", { error: errorMessage });
                        throw new Error("Failed to filter recipients: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SMSTemplateService.prototype.renderTemplate = function (template, data) {
        return template.replace(/{(\w+)}/g, function (_, key) { return String(data[key] || ""); });
    };
    SMSTemplateService.prototype.queueAuditLog = function (userId, action, entityType, entityId, details) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, auditLog, error_11, errorMessage;
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
                        error_11 = _a.sent();
                        errorMessage = error_11 instanceof Error ? error_11.message : "Unknown error";
                        logger.error("Failed to queue audit log", { action: action, entityType: entityType, entityId: entityId, error: errorMessage });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return SMSTemplateService;
}());
exports.SMSTemplateService = SMSTemplateService;
exports.smsTemplateService = new SMSTemplateService();
