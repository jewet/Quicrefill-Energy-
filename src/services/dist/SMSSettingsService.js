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
exports.smsSettingsService = exports.SMSSettingsService = void 0;
var client_1 = require("@prisma/client");
var winston_1 = require("winston");
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
var SMSSettingsService = /** @class */ (function () {
    function SMSSettingsService() {
        // Define default settings as a class-level constant
        this.defaultSettings = {
            enableNotifications: process.env.SMS_NOTIFICATIONS_ENABLED === "true" || true,
            senderId: process.env.SMS_SENDER_ID || "Quicrefil",
            deliveryTimeStart: process.env.SMS_DELIVERY_TIME_START || "06:00",
            deliveryTimeEnd: process.env.SMS_DELIVERY_TIME_END || "18:00",
            smsProvider: process.env.SMS_PROVIDER || "Twilio",
            serviceType: process.env.SMS_SERVICE_TYPE || "API",
            user: process.env.SMS_USER || "admin",
            password: process.env.SMS_PASSWORD || "default_password",
            host: process.env.SMS_HOST || "api.twilio.com",
            port: parseInt(process.env.SMS_PORT || "443", 10)
        };
    }
    // Get SMS settings, falling back to environment variables if necessary
    SMSSettingsService.prototype.getSMSSettings = function () {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var settings, result, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.sMSSettings.findFirst()];
                    case 1:
                        settings = _b.sent();
                        if (!settings) {
                            logger.info("No SMS settings found in database, using environment variables");
                            return [2 /*return*/, this.defaultSettings];
                        }
                        result = {
                            enableNotifications: (_a = settings.enableNotifications) !== null && _a !== void 0 ? _a : this.defaultSettings.enableNotifications,
                            senderId: settings.senderId || this.defaultSettings.senderId,
                            deliveryTimeStart: settings.deliveryTimeStart || this.defaultSettings.deliveryTimeStart,
                            deliveryTimeEnd: settings.deliveryTimeEnd || this.defaultSettings.deliveryTimeEnd,
                            smsProvider: settings.smsProvider || this.defaultSettings.smsProvider,
                            serviceType: settings.serviceType || this.defaultSettings.serviceType,
                            user: settings.user || this.defaultSettings.user,
                            password: settings.password || this.defaultSettings.password,
                            host: settings.host || this.defaultSettings.host,
                            port: settings.port || this.defaultSettings.port
                        };
                        logger.info("Retrieved SMS settings", { smsProvider: result.smsProvider });
                        return [2 /*return*/, result];
                    case 2:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to retrieve SMS settings", { error: errorMessage });
                        throw new Error("Failed to retrieve SMS settings: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Update SMS settings (admin only)
    SMSSettingsService.prototype.updateSMSSettings = function (data, updatedBy) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var existingSettings, updatedSettings, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        // Validate time format for deliveryTimeStart and deliveryTimeEnd
                        if (data.deliveryTimeStart && !/^\d{2}:\d{2}$/.test(data.deliveryTimeStart)) {
                            throw new Error("Invalid deliveryTimeStart format; use HH:mm");
                        }
                        if (data.deliveryTimeEnd && !/^\d{2}:\d{2}$/.test(data.deliveryTimeEnd)) {
                            throw new Error("Invalid deliveryTimeEnd format; use HH:mm");
                        }
                        return [4 /*yield*/, prisma.sMSSettings.findFirst()];
                    case 1:
                        existingSettings = _b.sent();
                        updatedSettings = void 0;
                        if (!existingSettings) return [3 /*break*/, 3];
                        return [4 /*yield*/, prisma.sMSSettings.update({
                                where: { id: existingSettings.id },
                                data: {
                                    enableNotifications: data.enableNotifications,
                                    senderId: data.senderId,
                                    deliveryTimeStart: data.deliveryTimeStart,
                                    deliveryTimeEnd: data.deliveryTimeEnd,
                                    smsProvider: data.smsProvider,
                                    serviceType: data.serviceType,
                                    user: data.user,
                                    password: data.password,
                                    host: data.host,
                                    port: data.port,
                                    updatedBy: updatedBy,
                                    updatedAt: new Date()
                                }
                            })];
                    case 2:
                        updatedSettings = _b.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, prisma.sMSSettings.create({
                            data: {
                                enableNotifications: (_a = data.enableNotifications) !== null && _a !== void 0 ? _a : true,
                                senderId: data.senderId,
                                deliveryTimeStart: data.deliveryTimeStart,
                                deliveryTimeEnd: data.deliveryTimeEnd,
                                smsProvider: data.smsProvider,
                                serviceType: data.serviceType,
                                user: data.user,
                                password: data.password,
                                host: data.host,
                                port: data.port,
                                updatedBy: updatedBy,
                                createdAt: new Date()
                            }
                        })];
                    case 4:
                        updatedSettings = _b.sent();
                        _b.label = 5;
                    case 5:
                        logger.info("SMS settings updated", { updatedBy: updatedBy, smsProvider: updatedSettings.smsProvider });
                        return [2 /*return*/, {
                                enableNotifications: updatedSettings.enableNotifications,
                                senderId: updatedSettings.senderId || this.defaultSettings.senderId,
                                deliveryTimeStart: updatedSettings.deliveryTimeStart || this.defaultSettings.deliveryTimeStart,
                                deliveryTimeEnd: updatedSettings.deliveryTimeEnd || this.defaultSettings.deliveryTimeEnd,
                                smsProvider: updatedSettings.smsProvider || this.defaultSettings.smsProvider,
                                serviceType: updatedSettings.serviceType || this.defaultSettings.serviceType,
                                user: updatedSettings.user || this.defaultSettings.user,
                                password: updatedSettings.password || this.defaultSettings.password,
                                host: updatedSettings.host || this.defaultSettings.host,
                                port: updatedSettings.port || this.defaultSettings.port
                            }];
                    case 6:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to update SMS settings", { error: errorMessage });
                        throw new Error("Failed to update SMS settings: " + errorMessage);
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    return SMSSettingsService;
}());
exports.SMSSettingsService = SMSSettingsService;
exports.smsSettingsService = new SMSSettingsService();
