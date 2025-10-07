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
exports.smsSettingsController = exports.SMSSettingsController = void 0;
var express_validator_1 = require("express-validator");
var SMSSettingsService_1 = require("../../services/SMSSettingsService");
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
var SMSSettingsController = /** @class */ (function () {
    function SMSSettingsController() {
    }
    // Get SMS settings for admin dashboard or settings form
    SMSSettingsController.prototype.getSMSSettings = function (req, res, next) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var user, settings, smsSettings, response, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        user = req.user;
                        if (!user || user.role !== client_1.Role.ADMIN) {
                            res.status(403).json({ message: "Access denied: Admin role required" });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, prisma.sMSSettings.findFirst({
                                include: {
                                    updatedByUser: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            email: true
                                        }
                                    }
                                }
                            })];
                    case 1:
                        settings = _b.sent();
                        return [4 /*yield*/, SMSSettingsService_1.smsSettingsService.getSMSSettings()];
                    case 2:
                        smsSettings = _b.sent();
                        response = {
                            enableNotifications: smsSettings.enableNotifications,
                            senderId: smsSettings.senderId,
                            deliveryTimeStart: smsSettings.deliveryTimeStart,
                            deliveryTimeEnd: smsSettings.deliveryTimeEnd,
                            smsProvider: smsSettings.smsProvider,
                            serviceType: smsSettings.serviceType,
                            user: smsSettings.user,
                            password: "********",
                            host: smsSettings.host,
                            port: smsSettings.port,
                            lastUpdated: (settings === null || settings === void 0 ? void 0 : settings.updatedAt) ? settings.updatedAt.toISOString() : null,
                            updatedBy: (settings === null || settings === void 0 ? void 0 : settings.updatedByUser) ? {
                                id: settings.updatedByUser.id,
                                name: settings.updatedByUser.firstName + " " + settings.updatedByUser.lastName,
                                email: settings.updatedByUser.email
                            }
                                : null
                        };
                        logger.info("SMS settings retrieved", { userId: user.id });
                        res.status(200).json(response);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to retrieve SMS settings", {
                            error: errorMessage,
                            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id
                        });
                        next(error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Update SMS settings (admin only)
    SMSSettingsController.prototype.updateSMSSettings = function (req, res, next) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var errors, user, data, updatedSettings, settings, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        errors = express_validator_1.validationResult(req);
                        if (!errors.isEmpty()) {
                            res.status(400).json({ errors: errors.array() });
                            return [2 /*return*/];
                        }
                        user = req.user;
                        if (!user || user.role !== client_1.Role.ADMIN) {
                            res.status(403).json({ message: "Access denied: Admin role required" });
                            return [2 /*return*/];
                        }
                        data = req.body;
                        return [4 /*yield*/, SMSSettingsService_1.smsSettingsService.updateSMSSettings(data, user.id)];
                    case 1:
                        updatedSettings = _b.sent();
                        return [4 /*yield*/, prisma.sMSSettings.findFirst({
                                include: {
                                    updatedByUser: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            email: true
                                        }
                                    }
                                }
                            })];
                    case 2:
                        settings = _b.sent();
                        logger.info("SMS settings updated", {
                            updatedBy: user.id,
                            smsProvider: updatedSettings.smsProvider
                        });
                        res.status(200).json({
                            enableNotifications: updatedSettings.enableNotifications,
                            senderId: updatedSettings.senderId,
                            deliveryTimeStart: updatedSettings.deliveryTimeStart,
                            deliveryTimeEnd: updatedSettings.deliveryTimeEnd,
                            smsProvider: updatedSettings.smsProvider,
                            serviceType: updatedSettings.serviceType,
                            user: updatedSettings.user,
                            password: "********",
                            host: updatedSettings.host,
                            port: updatedSettings.port,
                            lastUpdated: (settings === null || settings === void 0 ? void 0 : settings.updatedAt) ? settings.updatedAt.toISOString() : null,
                            updatedBy: (settings === null || settings === void 0 ? void 0 : settings.updatedByUser) ? {
                                id: settings.updatedByUser.id,
                                name: settings.updatedByUser.firstName + " " + settings.updatedByUser.lastName,
                                email: settings.updatedByUser.email
                            }
                                : null
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to update SMS settings", {
                            error: errorMessage,
                            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id
                        });
                        next(error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Validation middleware for updating SMS settings
    SMSSettingsController.validateSMSSettings = [
        express_validator_1.body("enableNotifications")
            .optional()
            .isBoolean()
            .withMessage("Enable notifications must be a boolean"),
        express_validator_1.body("senderId")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .isLength({ max: 50 })
            .withMessage("Sender ID must be a non-empty string, max 50 characters"),
        express_validator_1.body("deliveryTimeStart")
            .optional()
            .matches(/^\d{2}:\d{2}$/)
            .withMessage("Delivery time start must be in HH:mm format"),
        express_validator_1.body("deliveryTimeEnd")
            .optional()
            .matches(/^\d{2}:\d{2}$/)
            .withMessage("Delivery time end must be in HH:mm format"),
        express_validator_1.body("smsProvider")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage("SMS provider must be a non-empty string"),
        express_validator_1.body("serviceType")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Service type must be a non-empty string"),
        express_validator_1.body("user")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage("User must be a non-empty string"),
        express_validator_1.body("password")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Password must be a non-empty string"),
        express_validator_1.body("host")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Host must be a non-empty string"),
        express_validator_1.body("port")
            .optional()
            .isInt({ min: 1, max: 65535 })
            .withMessage("Port must be an integer between 1 and 65535"),
    ];
    return SMSSettingsController;
}());
exports.SMSSettingsController = SMSSettingsController;
exports.smsSettingsController = new SMSSettingsController();
