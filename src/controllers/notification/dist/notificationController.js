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
exports.validateNotificationPayload = exports.sendNotification = void 0;
var client_1 = require("@prisma/client");
var zod_1 = require("zod");
var notificationServices_1 = require("../../services/notificationServices");
var EventTypeDictionary_1 = require("../../utils/EventTypeDictionary");
// Initialize Prisma client
var prisma = new client_1.PrismaClient();
// Define the schema for request body validation using zod
var NotificationSchema = zod_1.z.object({
    eventTypeName: zod_1.z["enum"]([
        EventTypeDictionary_1.KnownEventTypes.NEW_ORDER,
        EventTypeDictionary_1.KnownEventTypes.ORDER_UPDATE,
        EventTypeDictionary_1.KnownEventTypes.ORDER_CONFIRMED,
        EventTypeDictionary_1.KnownEventTypes.ORDER_CANCELLED,
        EventTypeDictionary_1.KnownEventTypes.PASSWORD_CHANGE,
        EventTypeDictionary_1.KnownEventTypes.FEEDBACK_SUBMITTED,
        EventTypeDictionary_1.KnownEventTypes.PREFERENCE_UPDATE,
        EventTypeDictionary_1.KnownEventTypes.PROFILE_UPDATE,
        EventTypeDictionary_1.KnownEventTypes.WALLET_EVENT,
        EventTypeDictionary_1.KnownEventTypes.WALLET_TRANSACTION,
        EventTypeDictionary_1.KnownEventTypes.DISCOUNT,
        EventTypeDictionary_1.KnownEventTypes.PROMO_OFFER,
        EventTypeDictionary_1.KnownEventTypes.FLASH_SALE,
    ], {
        errorMap: function () { return ({ message: "Invalid event type" }); }
    }),
    dynamicData: zod_1.z.record(zod_1.z.any())["default"]({}),
    userIds: zod_1.z.array(zod_1.z.string()).optional(),
    roles: zod_1.z.array(zod_1.z["enum"](Object.values(client_1.Role))).optional()
});
// Middleware to validate the request body
var validateNotificationPayload = function (req, res, next) {
    try {
        NotificationSchema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                status: "error",
                message: "Invalid request payload",
                errors: error.errors
            });
        }
        next(error);
    }
};
exports.validateNotificationPayload = validateNotificationPayload;
// Controller function to trigger notifications
var sendNotification = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var _a, eventTypeName, dynamicData, userIds, roles, existingUsers, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                _a = NotificationSchema.parse(req.body), eventTypeName = _a.eventTypeName, dynamicData = _a.dynamicData, userIds = _a.userIds, roles = _a.roles;
                if (!(userIds && userIds.length > 0)) return [3 /*break*/, 2];
                return [4 /*yield*/, prisma.user.count({
                        where: { id: { "in": userIds } }
                    })];
            case 1:
                existingUsers = _b.sent();
                if (existingUsers !== userIds.length) {
                    res.status(400).json({
                        status: "error",
                        message: "One or more user IDs are invalid"
                    });
                    return [2 /*return*/];
                }
                _b.label = 2;
            case 2: 
            // Trigger the notification dispatch
            return [4 /*yield*/, notificationServices_1.dispatchNotification({
                    eventTypeName: eventTypeName,
                    dynamicData: dynamicData,
                    userIds: userIds,
                    roles: roles
                }, req)];
            case 3:
                // Trigger the notification dispatch
                _b.sent();
                res.status(200).json({
                    status: "success",
                    message: "Notifications for event " + eventTypeName + " dispatched successfully"
                });
                return [3 /*break*/, 5];
            case 4:
                error_1 = _b.sent();
                console.error("Error dispatching notification: " + error_1);
                res.status(500).json({
                    status: "error",
                    message: "Failed to dispatch notifications"
                });
                next(error_1);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.sendNotification = sendNotification;
