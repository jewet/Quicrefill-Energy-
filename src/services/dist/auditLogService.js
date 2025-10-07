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
exports.auditLogService = exports.AuditLogService = void 0;
// auditLogService.ts
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
var AuditLogService = /** @class */ (function () {
    function AuditLogService() {
    }
    /**
     * Logs an audit event
     * @param request - Audit log request
     */
    AuditLogService.prototype.log = function (request) {
        return __awaiter(this, void 0, Promise, function () {
            var userId, action, details, entityType, entityId, notes, investigationStatus, investigatedBy, investigatedAt, user, validEntityId, uuidRegex, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        userId = request.userId, action = request.action, details = request.details, entityType = request.entityType, entityId = request.entityId, notes = request.notes, investigationStatus = request.investigationStatus, investigatedBy = request.investigatedBy, investigatedAt = request.investigatedAt;
                        if (!action || !details) {
                            throw new Error("Action and details are required");
                        }
                        // Handle system actions
                        if (userId === "SYSTEM") {
                            userId = null; // Set to null for system actions
                        }
                        if (!(userId !== null)) return [3 /*break*/, 2];
                        // Validate userId as UUID
                        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
                            throw new Error("Invalid userId format: must be a valid UUID");
                        }
                        return [4 /*yield*/, prisma.user.findUnique({ where: { id: userId } })];
                    case 1:
                        user = _a.sent();
                        if (!user) {
                            throw new Error("User with ID " + userId + " does not exist");
                        }
                        _a.label = 2;
                    case 2:
                        validEntityId = null;
                        if (entityId) {
                            uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                            if (uuidRegex.test(entityId)) {
                                validEntityId = entityId;
                            }
                            else {
                                logger.warn("Invalid entityId format, setting to null", { entityId: entityId, entityType: entityType });
                            }
                        }
                        return [4 /*yield*/, prisma.auditLog.create({
                                data: {
                                    userId: userId,
                                    action: action,
                                    details: details,
                                    entityType: entityType,
                                    entityId: validEntityId,
                                    notes: notes,
                                    investigationStatus: investigationStatus,
                                    investigatedBy: investigatedBy,
                                    investigatedAt: investigatedAt
                                }
                            })];
                    case 3:
                        _a.sent();
                        logger.info("Audit log created", { userId: userId, action: action, entityType: entityType, entityId: validEntityId });
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                        logger.error("Error creating audit log", { error: errorMessage, request: JSON.stringify(request) });
                        throw new Error("Failed to create audit log: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // getLogs method remains unchanged
    AuditLogService.prototype.getLogs = function (filters) {
        return __awaiter(this, void 0, Promise, function () {
            var whereClause_1, logs, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        whereClause_1 = {
                            userId: filters.userId,
                            action: filters.action,
                            entityType: filters.entityType,
                            entityId: filters.entityId,
                            investigationStatus: filters.investigationStatus,
                            createdAt: {
                                gte: filters.startDate ? new Date(filters.startDate) : undefined,
                                lte: filters.endDate ? new Date(filters.endDate) : undefined
                            }
                        };
                        Object.keys(whereClause_1).forEach(function (key) {
                            if (whereClause_1[key] === undefined) {
                                delete whereClause_1[key];
                            }
                        });
                        return [4 /*yield*/, prisma.auditLog.findMany({
                                where: whereClause_1,
                                take: 100,
                                skip: 0,
                                orderBy: { createdAt: "desc" },
                                include: {
                                    user: { select: { id: true } },
                                    order: { select: { id: true } }
                                }
                            })];
                    case 1:
                        logs = _a.sent();
                        logger.info("Audit logs retrieved", { filters: filters, count: logs.length });
                        return [2 /*return*/, logs];
                    case 2:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                        logger.error("Error retrieving audit logs", { error: errorMessage, filters: filters });
                        throw new Error("Failed to retrieve audit logs: " + errorMessage);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return AuditLogService;
}());
exports.AuditLogService = AuditLogService;
exports.auditLogService = new AuditLogService();
