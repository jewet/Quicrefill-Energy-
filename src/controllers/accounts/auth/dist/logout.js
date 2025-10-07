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
exports.logout = void 0;
var inMemoryStore_1 = require("../../../utils/inMemoryStore");
var db_1 = require("../../../config/db");
var http_util_1 = require("../../../utils/http.util");
var winston_1 = require("winston");
var client_1 = require("@prisma/client");
// Logger setup
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1["default"].transports.File({ filename: "logs/auth.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
// Define constant for two hours in seconds
var TWO_HOURS_IN_SECONDS = 2 * 60 * 60;
// Helper to determine contextRole (aligned with login controller)
var determineContextRole = function (role, platform, migratedToVendor) {
    if (role === client_1.Role.VENDOR && platform === "app" && migratedToVendor) {
        return client_1.Role.DELIVERY_REP;
    }
    if (role === client_1.Role.DELIVERY_REP && platform === "web") {
        return client_1.Role.VENDOR;
    }
    return role;
};
// Helper to check if role is elevated
var isElevatedRole = function (role) {
    var elevatedRoles = [client_1.Role.ADMIN, client_1.Role.MANAGER, client_1.Role.SUPERVISOR, client_1.Role.FINANCE_MANAGER];
    return elevatedRoles.includes(role);
};
/**
 * Logs out the user by clearing the JWT cookie, blacklisting the token, and logging the action.
 * Handles migrated DELIVERY_REP and elevated roles with specific audit logging.
 */
exports.logout = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var token, platform, user, userId, userRole, migratedToVendor, dbUser, contextRole, storeError_1, maskedToken, error_1, errorMessage;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 8, , 9]);
                token = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token) || ((_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.split(" ")[1]) || "";
                platform = typeof req.query.platform === "string" ? req.query.platform : "app";
                user = req.user;
                userId = user === null || user === void 0 ? void 0 : user.id;
                userRole = user === null || user === void 0 ? void 0 : user.role;
                if (!token) {
                    logger.info("Logout attempted with no token", { ip: req.ip, platform: platform, userId: userId });
                    return [2 /*return*/, http_util_1.HttpResponse.success(res, null, "No active session found")];
                }
                if (!userId || !userRole) {
                    logger.warn("Logout attempted with invalid user data", { ip: req.ip, platform: platform });
                    res.clearCookie("token", {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production",
                        sameSite: "strict"
                    });
                    return [2 /*return*/, http_util_1.HttpResponse.success(res, null, "Logged out successfully")];
                }
                migratedToVendor = false;
                if (!(userRole === client_1.Role.VENDOR || userRole === client_1.Role.DELIVERY_REP)) return [3 /*break*/, 2];
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({
                        where: { id: userId },
                        select: { migratedToVendor: true }
                    })];
            case 1:
                dbUser = _e.sent();
                migratedToVendor = (dbUser === null || dbUser === void 0 ? void 0 : dbUser.migratedToVendor) || false;
                _e.label = 2;
            case 2:
                contextRole = determineContextRole(userRole, platform, migratedToVendor);
                _e.label = 3;
            case 3:
                _e.trys.push([3, 5, , 6]);
                return [4 /*yield*/, inMemoryStore_1.setWithExpiry("blacklist:" + token, "true", TWO_HOURS_IN_SECONDS)];
            case 4:
                _e.sent();
                logger.info("Token blacklisted successfully", { userId: userId, role: userRole, platform: platform, contextRole: contextRole });
                return [3 /*break*/, 6];
            case 5:
                storeError_1 = _e.sent();
                logger.error("Failed to blacklist token", {
                    userId: userId,
                    role: userRole,
                    contextRole: contextRole,
                    error: storeError_1 instanceof Error ? storeError_1.message : "Unknown error",
                    platform: platform
                });
                return [3 /*break*/, 6];
            case 6:
                // Clear the token cookie
                res.clearCookie("token", {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict"
                });
                maskedToken = token.length > 12 ? token.slice(0, 8) + "..." + token.slice(-4) : "****";
                return [4 /*yield*/, db_1.prismaClient.auditLog.create({
                        data: {
                            userId: userId,
                            action: "LOGOUT",
                            entityType: "USER",
                            entityId: userId,
                            details: {
                                platform: platform,
                                role: userRole,
                                contextRole: contextRole,
                                migratedToVendor: userRole === client_1.Role.VENDOR || userRole === client_1.Role.DELIVERY_REP ? migratedToVendor : undefined,
                                isElevatedRole: isElevatedRole(userRole),
                                maskedToken: maskedToken,
                                ip: req.ip
                            }
                        }
                    })];
            case 7:
                _e.sent();
                logger.info("Logout audit log created", { userId: userId, role: userRole, contextRole: contextRole, platform: platform });
                // Send success response
                return [2 /*return*/, http_util_1.HttpResponse.success(res, null, "Logged out successfully")];
            case 8:
                error_1 = _e.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("Logout error", {
                    userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
                    role: (_d = req.user) === null || _d === void 0 ? void 0 : _d.role,
                    error: errorMessage,
                    ip: req.ip,
                    platform: req.query.platform || "app"
                });
                next(error_1);
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
