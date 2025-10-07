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
exports.smsTemplateController = exports.SMSTemplateController = void 0;
var express_validator_1 = require("express-validator");
var client_1 = require("@prisma/client");
var SMSTemplateService_1 = require("../../services/SMSTemplateService");
var winston_1 = require("winston");
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
var SMSTemplateController = /** @class */ (function () {
    function SMSTemplateController() {
    }
    // Create a new SMS template
    SMSTemplateController.prototype.createTemplate = function (req, res, next) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var errors, data, updatedBy, template, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        errors = express_validator_1.validationResult(req);
                        if (!errors.isEmpty()) {
                            res.status(400).json({ errors: errors.array() });
                            return [2 /*return*/];
                        }
                        data = req.body;
                        updatedBy = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || "system";
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.createTemplate(data, updatedBy)];
                    case 1:
                        template = _b.sent();
                        logger.info("SMS template created via controller", { name: data.name, updatedBy: updatedBy });
                        res.status(201).json(template);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Failed to create SMS template via controller", { error: errorMessage });
                        next(error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Update an existing SMS template
    SMSTemplateController.prototype.updateTemplate = function (req, res, next) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var errors, id, data, updatedBy, template, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        errors = express_validator_1.validationResult(req);
                        if (!errors.isEmpty()) {
                            res.status(400).json({ errors: errors.array() });
                            return [2 /*return*/];
                        }
                        id = req.params.id;
                        data = req.body;
                        updatedBy = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || "system";
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.updateTemplate(id, data, updatedBy)];
                    case 1:
                        template = _b.sent();
                        logger.info("SMS template updated via controller", { id: id, updatedBy: updatedBy });
                        res.status(200).json(template);
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Failed to update SMS template via controller", { id: req.params.id, error: errorMessage });
                        next(error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Delete an SMS template
    SMSTemplateController.prototype.deleteTemplate = function (req, res, next) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var id, deletedBy, error_3, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        deletedBy = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || "system";
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.deleteTemplate(id, deletedBy)];
                    case 1:
                        _b.sent();
                        logger.info("SMS template deleted via controller", { id: id, deletedBy: deletedBy });
                        res.status(204).send();
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _b.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : "Unknown error";
                        logger.error("Failed to delete SMS template via controller", { id: req.params.id, error: errorMessage });
                        next(error_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get all SMS templates
    SMSTemplateController.prototype.getTemplates = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var templates, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.getTemplates()];
                    case 1:
                        templates = _a.sent();
                        logger.info("SMS templates retrieved via controller", { count: templates.length });
                        res.status(200).json(templates);
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : "Unknown error";
                        logger.error("Failed to retrieve SMS templates via controller", { error: errorMessage });
                        next(error_4);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Get a single SMS template by ID
    SMSTemplateController.prototype.getTemplateById = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var id, template, error_5, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.getById(id)];
                    case 1:
                        template = _a.sent();
                        if (!template) {
                            res.status(404).json({ message: "Template not found" });
                            return [2 /*return*/];
                        }
                        logger.info("SMS template retrieved via controller", { id: id });
                        res.status(200).json(template);
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : "Unknown error";
                        logger.error("Failed to retrieve SMS template via controller", { id: req.params.id, error: errorMessage });
                        next(error_5);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Send OTP SMS
    SMSTemplateController.prototype.sendOtpSMS = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var errors, _a, phoneNumber, otpCode, eventType, metadata, error_6, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        errors = express_validator_1.validationResult(req);
                        if (!errors.isEmpty()) {
                            res.status(400).json({ errors: errors.array() });
                            return [2 /*return*/];
                        }
                        _a = req.body, phoneNumber = _a.phoneNumber, otpCode = _a.otpCode, eventType = _a.eventType, metadata = _a.metadata;
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.sendOtpSMS({ phoneNumber: phoneNumber, otpCode: otpCode, eventType: eventType, metadata: metadata })];
                    case 1:
                        _b.sent();
                        logger.info("OTP SMS sent via controller", { phoneNumber: phoneNumber, eventType: eventType });
                        res.status(200).json({ message: "OTP SMS sent successfully" });
                        return [3 /*break*/, 3];
                    case 2:
                        error_6 = _b.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : "Unknown error";
                        logger.error("Failed to send OTP SMS via controller", { phoneNumber: req.body.phoneNumber, error: errorMessage });
                        next(error_6);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Send bulk SMS
    SMSTemplateController.prototype.sendBulkSMS = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var errors, data, error_7, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        errors = express_validator_1.validationResult(req);
                        if (!errors.isEmpty()) {
                            res.status(400).json({ errors: errors.array() });
                            return [2 /*return*/];
                        }
                        data = req.body;
                        return [4 /*yield*/, SMSTemplateService_1.smsTemplateService.sendSMS(data)];
                    case 1:
                        _a.sent();
                        logger.info("Bulk SMS sent via controller", { templateId: data.templateId, eventType: data.eventType });
                        res.status(200).json({ message: "Bulk SMS sent successfully" });
                        return [3 /*break*/, 3];
                    case 2:
                        error_7 = _a.sent();
                        errorMessage = error_7 instanceof Error ? error_7.message : "Unknown error";
                        logger.error("Failed to send bulk SMS via controller", { error: errorMessage });
                        next(error_7);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Validation middleware for creating/updating templates
    SMSTemplateController.validateTemplate = [
        express_validator_1.body("name").isString().notEmpty().withMessage("Name is required"),
        express_validator_1.body("content").isString().notEmpty().withMessage("Content is required"),
        express_validator_1.body("roles").optional().isArray().withMessage("Roles must be an array"),
        express_validator_1.body("roles.*").isIn(Object.values(client_1.Role)).withMessage("Invalid role"),
        express_validator_1.body("eventTypeId").optional().isString().withMessage("EventTypeId must be a string"),
        express_validator_1.body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    ];
    // Validation middleware for sending OTP
    SMSTemplateController.validateOtpSMS = [
        express_validator_1.body("phoneNumber").isString().notEmpty().withMessage("Phone number is required"),
        express_validator_1.body("otpCode").isString().notEmpty().withMessage("OTP code is required"),
        express_validator_1.body("eventType").optional().isString().withMessage("Event type must be a string"),
        express_validator_1.body("metadata").optional().isObject().withMessage("Metadata must be an object"),
    ];
    // Validation middleware for sending bulk SMS
    SMSTemplateController.validateBulkSMS = [
        express_validator_1.body("templateId").optional().isString().withMessage("Template ID must be a string"),
        express_validator_1.body("eventType").optional().isString().withMessage("Event type must be a string"),
        express_validator_1.body("roles").optional().isArray().withMessage("Roles must be an array"),
        express_validator_1.body("roles.*").isIn(Object.values(client_1.Role)).withMessage("Invalid role"),
        express_validator_1.body("customPayload").optional().isObject().withMessage("Custom payload must be an object"),
        express_validator_1.body("customPayload.content").optional().isString().withMessage("Custom payload content must be a string"),
        express_validator_1.body("customPayload.to")
            .optional()
            .custom(function (value) {
            if (Array.isArray(value)) {
                return value.every(function (item) { return typeof item === "string"; });
            }
            return typeof value === "string";
        })
            .withMessage("Custom payload 'to' must be a string or array of strings"),
        express_validator_1.body("userIds").optional().isArray().withMessage("User IDs must be an array"),
        express_validator_1.body("userIds.*").isString().withMessage("User ID must be a string"),
        express_validator_1.body("metadata").optional().isObject().withMessage("Metadata must be an object"),
    ];
    return SMSTemplateController;
}());
exports.SMSTemplateController = SMSTemplateController;
exports.smsTemplateController = new SMSTemplateController();
