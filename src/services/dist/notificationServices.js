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
exports.dispatchWebhookNotification = exports.dispatchSMSNotification = exports.dispatchEmailNotification = exports.dispatchPushNotification = exports.dispatchNotification = void 0;
// src/services/notificationService.ts
var client_1 = require("@prisma/client");
var async_retry_1 = require("async-retry");
var firebase_1 = require("../config/firebase");
var axios_1 = require("axios");
var templateRenderer_1 = require("../utils/templateRenderer");
var notificationUtils_1 = require("../utils/notificationUtils");
var EventTypeDictionary_1 = require("../utils/EventTypeDictionary");
var notificationLimiterMiddleware_1 = require("../middlewares/notificationLimiterMiddleware");
var email_1 = require("./email");
var SMSTemplateService_1 = require("./SMSTemplateService");
var prisma = new client_1.PrismaClient();
function dispatchPushNotification(payload, req) {
    return __awaiter(this, void 0, Promise, function () {
        var eventTypeName, dynamicData, userIds, roles, eventType, applicableRoles, notificationType, template, _a, body, title, safeBody, safeTitle, batchSize, users, _loop_1, i;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        notificationLimiterMiddleware_1.notificationLimiter(req, {}, function (err) { return (err ? reject(err) : resolve()); });
                    })];
                case 1:
                    _b.sent();
                    eventTypeName = payload.eventTypeName, dynamicData = payload.dynamicData, userIds = payload.userIds, roles = payload.roles;
                    return [4 /*yield*/, prisma.eventType.findFirst({
                            where: { name: eventTypeName }
                        })];
                case 2:
                    eventType = _b.sent();
                    if (!eventType) {
                        throw new Error("Event type " + eventTypeName + " not found");
                    }
                    applicableRoles = roles || EventTypeDictionary_1.RoleEventApplicability[eventTypeName] || [];
                    notificationType = mapEventTypeToNotificationType(eventTypeName);
                    return [4 /*yield*/, prisma.pushTemplate.findFirst({
                            where: {
                                eventType: { name: eventTypeName },
                                isActive: true,
                                roles: { hasSome: applicableRoles }
                            }
                        })];
                case 3:
                    template = _b.sent();
                    if (!template) {
                        throw new Error("No active push template found for event " + eventTypeName);
                    }
                    _a = templateRenderer_1.renderTemplate(template, dynamicData, "PUSH"), body = _a.content, title = _a.title;
                    safeBody = body || "Notification: " + (dynamicData.message || "You have a new notification.");
                    safeTitle = title || "Quicrefill Notification";
                    batchSize = 500;
                    return [4 /*yield*/, prisma.user.findMany({
                            where: {
                                OR: [
                                    userIds ? { id: { "in": userIds } } : {},
                                    { role: { "in": applicableRoles } },
                                ].filter(Boolean),
                                pushToken: { not: null },
                                notificationPreferences: __assign({ pushEnabled: true, notificationTypes: { has: notificationType } }, (eventTypeName === EventTypeDictionary_1.KnownEventTypes.PASSWORD_CHANGE && { passwordChangeEnabled: true }))
                            },
                            select: { id: true, pushToken: true }
                        })];
                case 4:
                    users = _b.sent();
                    if (!users.length) {
                        console.warn("No users with push tokens and enabled preferences found for event " + eventTypeName);
                        return [2 /*return*/];
                    }
                    _loop_1 = function (i) {
                        var batch, tokens, message_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    batch = users.slice(i, i + batchSize);
                                    tokens = batch.map(function (user) { return user.pushToken; }).filter(function (token) { return !!token; });
                                    if (!tokens.length) return [3 /*break*/, 2];
                                    message_1 = {
                                        notification: {
                                            title: safeTitle,
                                            body: safeBody
                                        },
                                        tokens: tokens
                                    };
                                    return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                            var response, _i, batch_1, user;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, firebase_1.messaging.sendMulticast(message_1)];
                                                    case 1:
                                                        response = _a.sent();
                                                        console.log("Sent " + response.successCount + " push notifications in batch " + (i / batchSize + 1));
                                                        _i = 0, batch_1 = batch;
                                                        _a.label = 2;
                                                    case 2:
                                                        if (!(_i < batch_1.length)) return [3 /*break*/, 5];
                                                        user = batch_1[_i];
                                                        return [4 /*yield*/, notificationUtils_1.logNotification(user.id, eventType.id, "PUSH", JSON.stringify({ title: safeTitle, body: safeBody }), response.successCount > 0 ? "SENT" : "FAILED", safeTitle + ": " + safeBody)];
                                                    case 3:
                                                        _a.sent();
                                                        _a.label = 4;
                                                    case 4:
                                                        _i++;
                                                        return [3 /*break*/, 2];
                                                    case 5:
                                                        if (response.failureCount) {
                                                            throw new Error("Failed to send " + response.failureCount + " push notifications in batch");
                                                        }
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); }, {
                                            retries: 3,
                                            factor: 2,
                                            minTimeout: 1000,
                                            maxTimeout: 5000,
                                            onRetry: function (err) { return console.warn("Retrying push notification batch: " + err.message); }
                                        })["catch"](function (error) {
                                            console.error("Error sending push batch " + (i / batchSize + 1) + ": " + error.message);
                                            for (var _i = 0, batch_2 = batch; _i < batch_2.length; _i++) {
                                                var user = batch_2[_i];
                                                notificationUtils_1.logNotification(user.id, eventType.id, "PUSH", JSON.stringify({ title: safeTitle, body: safeBody }), "FAILED", safeTitle + ": " + safeBody);
                                            }
                                        })];
                                case 1:
                                    _a.sent();
                                    _a.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _b.label = 5;
                case 5:
                    if (!(i < users.length)) return [3 /*break*/, 8];
                    return [5 /*yield**/, _loop_1(i)];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7:
                    i += batchSize;
                    return [3 /*break*/, 5];
                case 8: return [2 /*return*/];
            }
        });
    });
}
exports.dispatchPushNotification = dispatchPushNotification;
function dispatchEmailNotification(payload, req) {
    return __awaiter(this, void 0, Promise, function () {
        var eventTypeName, dynamicData, userIds, roles, eventType, applicableRoles, notificationType, users, _i, users_1, user, template, _a, body, subject, safeBody, safeSubject;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        notificationLimiterMiddleware_1.notificationLimiter(req, {}, function (err) { return (err ? reject(err) : resolve()); });
                    })];
                case 1:
                    _b.sent();
                    eventTypeName = payload.eventTypeName, dynamicData = payload.dynamicData, userIds = payload.userIds, roles = payload.roles;
                    return [4 /*yield*/, prisma.eventType.findFirst({
                            where: { name: eventTypeName }
                        })];
                case 2:
                    eventType = _b.sent();
                    if (!eventType) {
                        throw new Error("Event type " + eventTypeName + " not found");
                    }
                    applicableRoles = roles || EventTypeDictionary_1.RoleEventApplicability[eventTypeName] || [];
                    notificationType = mapEventTypeToNotificationType(eventTypeName);
                    return [4 /*yield*/, prisma.user.findMany({
                            where: {
                                OR: [
                                    userIds ? { id: { "in": userIds } } : {},
                                    { role: { "in": applicableRoles } },
                                ].filter(Boolean),
                                email: { not: null },
                                notificationPreferences: __assign({ emailEnabled: true, notificationTypes: { has: notificationType } }, (eventTypeName === EventTypeDictionary_1.KnownEventTypes.PASSWORD_CHANGE && { passwordChangeEnabled: true }))
                            },
                            select: { id: true, email: true }
                        })];
                case 3:
                    users = _b.sent();
                    if (!users.length) {
                        console.warn("No users with emails and enabled preferences found for event " + eventTypeName);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                            eventType: eventTypeName,
                            userIds: users.map(function (user) { return user.id; }),
                            metadata: dynamicData
                        })];
                case 4:
                    _b.sent();
                    _i = 0, users_1 = users;
                    _b.label = 5;
                case 5:
                    if (!(_i < users_1.length)) return [3 /*break*/, 9];
                    user = users_1[_i];
                    return [4 /*yield*/, prisma.emailTemplate.findFirst({
                            where: { eventType: { name: eventTypeName }, isActive: true }
                        })];
                case 6:
                    template = _b.sent();
                    _a = template
                        ? templateRenderer_1.renderTemplate(template, dynamicData, "EMAIL")
                        : { content: "Notification: " + (dynamicData.message || "You have a new notification."), title: "Quicrefill Notification" }, body = _a.content, subject = _a.title;
                    safeBody = body || "Notification: " + (dynamicData.message || "You have a new notification.");
                    safeSubject = subject || "Quicrefill Notification";
                    return [4 /*yield*/, notificationUtils_1.logNotification(user.id, eventType.id, "EMAIL", JSON.stringify({ eventType: eventTypeName, email: user.email, subject: safeSubject, body: safeBody }), "SENT", safeSubject + ": " + safeBody)];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 5];
                case 9: return [2 /*return*/];
            }
        });
    });
}
exports.dispatchEmailNotification = dispatchEmailNotification;
function dispatchSMSNotification(payload, req) {
    return __awaiter(this, void 0, Promise, function () {
        var eventTypeName, dynamicData, userIds, roles, eventType, applicableRoles, notificationType, users, template, body, safeBody, _i, users_2, user, error_1, errorMessage, template, body, safeBody, _a, users_3, user;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        notificationLimiterMiddleware_1.notificationLimiter(req, {}, function (err) { return (err ? reject(err) : resolve()); });
                    })];
                case 1:
                    _b.sent();
                    eventTypeName = payload.eventTypeName, dynamicData = payload.dynamicData, userIds = payload.userIds, roles = payload.roles;
                    return [4 /*yield*/, prisma.eventType.findFirst({
                            where: { name: eventTypeName }
                        })];
                case 2:
                    eventType = _b.sent();
                    if (!eventType) {
                        throw new Error("Event type " + eventTypeName + " not found");
                    }
                    applicableRoles = roles || EventTypeDictionary_1.RoleEventApplicability[eventTypeName] || [];
                    notificationType = mapEventTypeToNotificationType(eventTypeName);
                    return [4 /*yield*/, prisma.user.findMany({
                            where: {
                                OR: [
                                    userIds ? { id: { "in": userIds } } : {},
                                    { role: { "in": applicableRoles } },
                                ].filter(Boolean),
                                phoneNumber: { not: null },
                                notificationPreferences: __assign({ smsEnabled: true, notificationTypes: { has: notificationType } }, (eventTypeName === EventTypeDictionary_1.KnownEventTypes.PASSWORD_CHANGE && { passwordChangeEnabled: true }))
                            },
                            select: { id: true, phoneNumber: true }
                        })];
                case 3:
                    users = _b.sent();
                    if (!users.length) {
                        console.warn("No users with phone numbers and enabled preferences found for event " + eventTypeName);
                        return [2 /*return*/];
                    }
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 11, , 17]);
                    return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.sendSMS({
                            eventType: eventTypeName,
                            userIds: users.map(function (user) { return user.id; }),
                            metadata: dynamicData
                        })];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, prisma.sMSTemplate.findFirst({
                            where: { eventTypeId: eventType.id, isActive: true }
                        })];
                case 6:
                    template = _b.sent();
                    body = (template
                        ? templateRenderer_1.renderTemplate(template, dynamicData, "SMS")
                        : { content: "Notification: " + (dynamicData.message || "You have a new notification.") }).content;
                    safeBody = body || "Notification: " + (dynamicData.message || "You have a new notification.");
                    _i = 0, users_2 = users;
                    _b.label = 7;
                case 7:
                    if (!(_i < users_2.length)) return [3 /*break*/, 10];
                    user = users_2[_i];
                    return [4 /*yield*/, notificationUtils_1.logNotification(user.id, eventType.id, "SMS", JSON.stringify({ eventType: eventTypeName, phoneNumber: user.phoneNumber, body: safeBody }), "SENT", safeBody)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10: return [3 /*break*/, 17];
                case 11:
                    error_1 = _b.sent();
                    errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                    console.error("Error sending SMS notifications: " + errorMessage);
                    return [4 /*yield*/, prisma.sMSTemplate.findFirst({
                            where: { eventTypeId: eventType.id, isActive: true }
                        })];
                case 12:
                    template = _b.sent();
                    body = (template
                        ? templateRenderer_1.renderTemplate(template, dynamicData, "SMS")
                        : { content: "Notification: " + (dynamicData.message || "You have a new notification.") }).content;
                    safeBody = body || "Notification: " + (dynamicData.message || "You have a new notification.");
                    _a = 0, users_3 = users;
                    _b.label = 13;
                case 13:
                    if (!(_a < users_3.length)) return [3 /*break*/, 16];
                    user = users_3[_a];
                    return [4 /*yield*/, notificationUtils_1.logNotification(user.id, eventType.id, "SMS", JSON.stringify({ eventType: eventTypeName, phoneNumber: user.phoneNumber, body: safeBody, error: errorMessage }), "FAILED", safeBody)];
                case 14:
                    _b.sent();
                    _b.label = 15;
                case 15:
                    _a++;
                    return [3 /*break*/, 13];
                case 16: return [3 /*break*/, 17];
                case 17: return [2 /*return*/];
            }
        });
    });
}
exports.dispatchSMSNotification = dispatchSMSNotification;
function dispatchWebhookNotification(payload, req) {
    return __awaiter(this, void 0, Promise, function () {
        var eventTypeName, dynamicData, userIds, roles, eventType, applicableRoles, webhooks, users, message, _loop_2, _i, webhooks_1, webhook;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                        notificationLimiterMiddleware_1.notificationLimiter(req, {}, function (err) { return (err ? reject(err) : resolve()); });
                    })];
                case 1:
                    _a.sent();
                    eventTypeName = payload.eventTypeName, dynamicData = payload.dynamicData, userIds = payload.userIds, roles = payload.roles;
                    return [4 /*yield*/, prisma.eventType.findFirst({
                            where: { name: eventTypeName }
                        })];
                case 2:
                    eventType = _a.sent();
                    if (!eventType) {
                        throw new Error("Event type " + eventTypeName + " not found");
                    }
                    applicableRoles = roles || EventTypeDictionary_1.RoleEventApplicability[eventTypeName] || [];
                    return [4 /*yield*/, prisma.webhook.findMany({
                            where: {
                                eventType: { name: eventTypeName },
                                isActive: true,
                                roles: { hasSome: applicableRoles }
                            }
                        })];
                case 3:
                    webhooks = _a.sent();
                    if (!webhooks.length) {
                        console.warn("No active webhooks found for event " + eventTypeName);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, prisma.user.findMany({
                            where: {
                                OR: [
                                    userIds ? { id: { "in": userIds } } : {},
                                    { role: { "in": applicableRoles } },
                                ].filter(Boolean)
                            },
                            select: { id: true, email: true, phoneNumber: true }
                        })];
                case 4:
                    users = _a.sent();
                    message = JSON.stringify({ eventType: eventTypeName, users: users, dynamicData: dynamicData });
                    _loop_2 = function (webhook) {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, axios_1["default"].post(webhook.url, {
                                                        eventType: eventTypeName,
                                                        users: users.map(function (user) { return ({
                                                            id: user.id,
                                                            email: user.email,
                                                            phoneNumber: user.phoneNumber
                                                        }); }),
                                                        dynamicData: dynamicData
                                                    })];
                                                case 1:
                                                    _a.sent();
                                                    return [4 /*yield*/, notificationUtils_1.logNotification(webhook.createdBy, eventType.id, "WEBHOOK", JSON.stringify({ url: webhook.url, eventType: eventTypeName, dynamicData: dynamicData }), "SENT", message)];
                                                case 2:
                                                    _a.sent();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); }, {
                                        retries: 3,
                                        factor: 2,
                                        minTimeout: 1000,
                                        maxTimeout: 5000,
                                        onRetry: function (err) { return console.warn("Retrying webhook to " + webhook.url + ": " + err.message); }
                                    })["catch"](function (error) {
                                        console.error("Error sending webhook to " + webhook.url + ": " + error.message);
                                        notificationUtils_1.logNotification(webhook.createdBy, eventType.id, "WEBHOOK", JSON.stringify({ url: webhook.url, eventType: eventTypeName, dynamicData: dynamicData }), "FAILED", message);
                                    })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, webhooks_1 = webhooks;
                    _a.label = 5;
                case 5:
                    if (!(_i < webhooks_1.length)) return [3 /*break*/, 8];
                    webhook = webhooks_1[_i];
                    return [5 /*yield**/, _loop_2(webhook)];
                case 6:
                    _a.sent();
                    _a.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8: return [2 /*return*/];
            }
        });
    });
}
exports.dispatchWebhookNotification = dispatchWebhookNotification;
function dispatchNotification(payload, req) {
    return __awaiter(this, void 0, Promise, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        dispatchPushNotification(payload, req),
                        dispatchEmailNotification(payload, req),
                        dispatchSMSNotification(payload, req),
                        dispatchWebhookNotification(payload, req),
                    ])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
exports.dispatchNotification = dispatchNotification;
function mapEventTypeToNotificationType(eventType) {
    switch (eventType) {
        case EventTypeDictionary_1.KnownEventTypes.NEW_ORDER:
        case EventTypeDictionary_1.KnownEventTypes.ORDER_UPDATE:
        case EventTypeDictionary_1.KnownEventTypes.ORDER_CONFIRMED:
            return client_1.NotificationType.NEW_ORDER;
        case EventTypeDictionary_1.KnownEventTypes.ORDER_CANCELLED:
            return client_1.NotificationType.ORDER_CANCELLED;
        case EventTypeDictionary_1.KnownEventTypes.PASSWORD_CHANGE:
            return client_1.NotificationType.PASSWORD_CHANGE;
        case EventTypeDictionary_1.KnownEventTypes.FEEDBACK_SUBMITTED:
            return client_1.NotificationType.FEEDBACK_SUBMITTED;
        case EventTypeDictionary_1.KnownEventTypes.PREFERENCE_UPDATE:
        case EventTypeDictionary_1.KnownEventTypes.PROFILE_UPDATE:
            return client_1.NotificationType.PREFERENCE_UPDATE;
        case EventTypeDictionary_1.KnownEventTypes.WALLET_EVENT:
        case EventTypeDictionary_1.KnownEventTypes.WALLET_TRANSACTION:
            return client_1.NotificationType.WALLET_EVENT;
        case EventTypeDictionary_1.KnownEventTypes.DISCOUNT:
        case EventTypeDictionary_1.KnownEventTypes.PROMO_OFFER:
        case EventTypeDictionary_1.KnownEventTypes.FLASH_SALE:
            return client_1.NotificationType.DISCOUNT;
        default:
            return client_1.NotificationType.ALL;
    }
}
