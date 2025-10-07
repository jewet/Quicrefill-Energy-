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
exports.fraudDetectionController = exports.FraudDetectionController = void 0;
var fraudDetectionService_1 = require("../../services/fraudDetectionService");
var joi_1 = require("joi");
var winston_1 = require("winston");
var client_1 = require("@prisma/client");
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
var fraudCheckSchema = joi_1["default"].object({
    userId: joi_1["default"].string().uuid().required().messages({
        "any.required": "User ID is required"
    }),
    amount: joi_1["default"].number().positive().required().messages({
        "number.positive": "Amount must be positive",
        "any.required": "Amount is required"
    }),
    type: joi_1["default"].string().required().messages({
        "any.required": "Transaction type is required"
    }),
    entityType: joi_1["default"].string().required().messages({
        "any.required": "Entity type is required"
    }),
    entityId: joi_1["default"].string().uuid().required().messages({
        "any.required": "Entity ID is required"
    }),
    vendorId: joi_1["default"].string().uuid().optional()
});
var logFilterSchema = joi_1["default"].object({
    userId: joi_1["default"].string().uuid().optional(),
    vendorId: joi_1["default"].string().uuid().optional(),
    type: joi_1["default"].string().optional(),
    entityType: joi_1["default"].string().optional(),
    entityId: joi_1["default"].string().uuid().optional(),
    status: joi_1["default"].string().optional(),
    startDate: joi_1["default"].date().iso().optional(),
    endDate: joi_1["default"].date().iso().optional()
});
var FraudDetectionController = /** @class */ (function () {
    function FraudDetectionController() {
    }
    /**
     * Checks for suspicious activity in a transaction
     */
    FraudDetectionController.prototype.checkFraud = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var _a, error, value, fraudCheckRequest, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        if (!req.user || !req.user.id) {
                            logger.warn("Unauthorized access attempt to checkFraud", { userId: "unknown" });
                            res.status(401).json({ error: "Unauthorized" });
                            return [2 /*return*/];
                        }
                        _a = fraudCheckSchema.validate(req.body), error = _a.error, value = _a.value;
                        if (error) {
                            logger.warn("Validation failed for checkFraud", { error: error.details });
                            res.status(400).json({ error: error.details[0].message });
                            return [2 /*return*/];
                        }
                        fraudCheckRequest = value;
                        return [4 /*yield*/, fraudDetectionService_1.fraudDetectionService.checkForSuspiciousActivity(fraudCheckRequest.userId, fraudCheckRequest.amount, fraudCheckRequest.type, fraudCheckRequest.entityType, fraudCheckRequest.entityId, fraudCheckRequest.vendorId)];
                    case 1:
                        _b.sent();
                        logger.info("Fraud check passed", { userId: fraudCheckRequest.userId, type: fraudCheckRequest.type });
                        res.status(200).json({ message: "No suspicious activity detected" });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Fraud check failed", { error: errorMessage });
                        res.status(400).json({ error: "Fraud check failed: " + errorMessage });
                        next(error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Retrieves fraud alerts with filters
     */
    FraudDetectionController.prototype.getFraudAlerts = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var _a, error, value, filters, alerts, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        if (!req.user || !req.user.id) {
                            logger.warn("Unauthorized access attempt to getFraudAlerts", { userId: "unknown" });
                            res.status(401).json({ error: "Unauthorized" });
                            return [2 /*return*/];
                        }
                        _a = logFilterSchema.validate(req.query), error = _a.error, value = _a.value;
                        if (error) {
                            logger.warn("Validation failed for getFraudAlerts", { error: error.details });
                            res.status(400).json({ error: error.details[0].message });
                            return [2 /*return*/];
                        }
                        filters = value;
                        return [4 /*yield*/, prisma.fraudAlert.findMany({
                                where: {
                                    userId: filters.userId,
                                    vendorId: filters.vendorId,
                                    type: filters.type,
                                    entityType: filters.entityType,
                                    entityId: filters.entityId,
                                    status: filters.status,
                                    createdAt: {
                                        gte: filters.startDate ? new Date(filters.startDate) : undefined,
                                        lte: filters.endDate ? new Date(filters.endDate) : undefined
                                    }
                                },
                                take: 100,
                                skip: 0,
                                orderBy: { createdAt: "desc" }
                            })];
                    case 1:
                        alerts = _b.sent();
                        logger.info("Fraud alerts retrieved", { filter: filters, count: alerts.length });
                        res.status(200).json({ alerts: alerts });
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Error retrieving fraud alerts", { error: errorMessage });
                        res.status(500).json({ error: "Failed to retrieve fraud alerts: " + errorMessage });
                        next(error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return FraudDetectionController;
}());
exports.FraudDetectionController = FraudDetectionController;
exports.fraudDetectionController = new FraudDetectionController();
