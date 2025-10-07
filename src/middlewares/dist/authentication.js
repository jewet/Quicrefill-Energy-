"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.rawBodySaver = exports.validatePaymentRequest = exports.checkPayOnDelivery = exports.restrictEmailTemplateAccess = exports.restrictEventTypeAccess = exports.authenticateAdmin = exports.restrictDeliveryRepRoutes = exports.authorizeRoles = exports.authenticateUser = exports.authenticationMiddleware = exports.loginRateLimiter = void 0;
var dotenv_1 = require("dotenv");
var fs_1 = require("fs");
var jsonwebtoken_1 = require("jsonwebtoken");
var path_1 = require("path");
var express_rate_limit_1 = require("express-rate-limit");
var client_1 = require("@prisma/client");
var inMemoryStore_1 = require("../utils/inMemoryStore");
var unauthorizedRequests_1 = require("../exceptions/unauthorizedRequests");
var root_1 = require("../exceptions/root");
var verifyToken_1 = require("../lib/utils/jwt/verifyToken");
var http_util_1 = require("../utils/http.util");
// Load environment variables
dotenv_1["default"].config();
// Initialize Prisma client
var prisma = new client_1.PrismaClient();
// Ensure logs directory exists
var logDir = path_1["default"].join(__dirname, '../../logs');
if (!fs_1["default"].existsSync(logDir)) {
    fs_1["default"].mkdirSync(logDir, { recursive: true });
}
// Log unauthorized access attempts
var logUnauthorizedAccess = function (ip, reason) {
    var logFile = path_1["default"].join(logDir, 'auth_attempts.log');
    var logEntry = "[" + new Date().toISOString() + "] Unauthorized attempt from IP: " + ip + " - Reason: " + reason + "\n";
    fs_1["default"].appendFileSync(logFile, logEntry, 'utf8');
};
// Rate limiter for login attempts
exports.loginRateLimiter = express_rate_limit_1["default"]({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Please try again later.' },
    headers: true
});
/**
 * Authentication Middleware
 */
exports.authenticationMiddleware = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var authHeader, token, decoded, cacheKey, error_1, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                authHeader = req.headers.authorization;
                token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) ? authHeader.slice(7) : (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
                if (!token) {
                    logUnauthorizedAccess(req.ip || 'unknown', 'No token provided');
                    throw new unauthorizedRequests_1.UnauthorizedRequest('User is not authenticated', root_1.AppErrorCode.UNAUTHENTICATED);
                }
                if (inMemoryStore_1.inMemoryStore.isTokenBlacklisted(token)) {
                    logUnauthorizedAccess(req.ip || 'unknown', 'Token is blacklisted');
                    throw new unauthorizedRequests_1.UnauthorizedRequest('Session expired. Please log in again.', root_1.AppErrorCode.INVALID_TOKEN);
                }
                return [4 /*yield*/, verifyToken_1.verifyToken(token)];
            case 1:
                decoded = (_b.sent());
                cacheKey = "user:" + decoded.userId;
                inMemoryStore_1.inMemoryStore.set(cacheKey, decoded, 3600);
                req.user = {
                    id: decoded.userId,
                    email: decoded.email,
                    role: decoded.role,
                    contextRole: decoded.contextRole
                };
                next();
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : 'Invalid token';
                logUnauthorizedAccess(req.ip || 'unknown', errorMessage);
                next(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
/**
 * Simple Authentication Middleware
 */
exports.authenticateUser = function (req, res, next) {
    var _a;
    var token = (_a = req.headers['authorization']) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
    if (!token) {
        logUnauthorizedAccess(req.ip || 'unknown', 'No token provided');
        http_util_1.HttpResponse.error(res, 'No token provided', 401);
        return;
    }
    try {
        var decoded = jsonwebtoken_1["default"].verify(token, process.env.JWT_ACCESS_SECRET);
        req.userId = decoded.userId;
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            contextRole: decoded.contextRole
        };
        next();
    }
    catch (error) {
        var errorMessage = error instanceof Error ? error.message : 'Invalid token';
        logUnauthorizedAccess(req.ip || 'unknown', errorMessage);
        http_util_1.HttpResponse.error(res, 'Invalid token', 401);
        return;
    }
};
/**
 * Role-Based Authorization Middleware Factory
 */
exports.authorizeRoles = function (roles) {
    return function (req, res, next) {
        var _a, _b;
        var checkRole = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.contextRole) && req.user.role !== client_1.Role.ADMIN ? req.user.contextRole : (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
        if (!checkRole || !roles.includes(checkRole)) {
            logUnauthorizedAccess(req.ip || 'unknown', "Insufficient permissions - Required roles: " + roles.join(', ') + ", Got: " + (checkRole || 'none'));
            http_util_1.HttpResponse.error(res, 'Forbidden - Insufficient permissions', 403);
            return;
        }
        next();
    };
};
/**
 * Restrict DELIVERY_REP Routes Middleware
 */
exports.restrictDeliveryRepRoutes = function (req, res, next) {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.contextRole) === client_1.Role.DELIVERY_REP) {
        var allowedPaths = [
            '/services',
            '/profile/self',
        ];
        var allowedMethods = ['POST', 'PUT', 'GET'];
        var requestPath_1 = req.path;
        var requestMethod = req.method;
        var isAllowedPath = allowedPaths.some(function (path) { return requestPath_1 === path || requestPath_1.startsWith(path); });
        var isAllowedMethod = allowedMethods.includes(requestMethod);
        if (!isAllowedPath || !isAllowedMethod) {
            logUnauthorizedAccess(req.ip || 'unknown', "DELIVERY_REP attempted restricted route - Path: " + requestPath_1 + ", Method: " + requestMethod);
            http_util_1.HttpResponse.error(res, 'Forbidden - DELIVERY_REP cannot access this route', 403);
            return;
        }
    }
    next();
};
/**
 * Admin Authentication Middleware
 */
exports.authenticateAdmin = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var adminRoleChecker;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                adminRoleChecker = exports.authorizeRoles([client_1.Role.ADMIN]);
                return [4 /*yield*/, exports.authenticationMiddleware(req, res, function (err) {
                        if (err) {
                            return next(err);
                        }
                        adminRoleChecker(req, res, next);
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
/**
 * Event Type Access Middleware
 */
exports.restrictEventTypeAccess = function (method) {
    return function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
        var error_2, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.authenticationMiddleware(req, res, function (err) {
                            var _a, _b;
                            if (err) {
                                return next(err);
                            }
                            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
                                if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) || req.user.role !== client_1.Role.ADMIN) {
                                    logUnauthorizedAccess(req.ip || 'unknown', "User attempted to " + method + " event type without admin role - Role: " + (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) || 'none'));
                                    http_util_1.HttpResponse.error(res, 'Forbidden - Admin access required to manage event types', 403);
                                    return;
                                }
                            }
                            else if (method.toUpperCase() === 'GET') {
                                if (!req.user) {
                                    logUnauthorizedAccess(req.ip || 'unknown', 'No user authenticated for viewing event types');
                                    http_util_1.HttpResponse.error(res, 'Unauthorized - Authentication required to view event types', 401);
                                    return;
                                }
                            }
                            else {
                                logUnauthorizedAccess(req.ip || 'unknown', "Invalid method for event type access: " + method);
                                http_util_1.HttpResponse.error(res, 'Method not allowed', 405);
                                return;
                            }
                            next();
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                    logUnauthorizedAccess(req.ip || 'unknown', "Error in event type access: " + errorMessage);
                    http_util_1.HttpResponse.error(res, "Failed to check event type access: " + errorMessage, 500);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
};
/**
 * Email Template Access Middleware
 */
exports.restrictEmailTemplateAccess = function (method) {
    return function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
        var error_3, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.authenticationMiddleware(req, res, function (err) {
                            var _a, _b;
                            if (err) {
                                return next(err);
                            }
                            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
                                if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) || req.user.role !== client_1.Role.ADMIN) {
                                    logUnauthorizedAccess(req.ip || 'unknown', "User attempted to " + method + " email template without admin role - Role: " + (((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) || 'none'));
                                    http_util_1.HttpResponse.error(res, 'Forbidden - Admin access required to manage email templates', 403);
                                    return;
                                }
                            }
                            else if (method.toUpperCase() === 'GET') {
                                if (!req.user) {
                                    logUnauthorizedAccess(req.ip || 'unknown', 'No user authenticated for viewing email templates');
                                    http_util_1.HttpResponse.error(res, 'Unauthorized - Authentication required to view email templates', 401);
                                    return;
                                }
                            }
                            else {
                                logUnauthorizedAccess(req.ip || 'unknown', "Invalid method for email template access: " + method);
                                http_util_1.HttpResponse.error(res, 'Method not allowed', 405);
                                return;
                            }
                            next();
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                    logUnauthorizedAccess(req.ip || 'unknown', "Error in email template access: " + errorMessage);
                    http_util_1.HttpResponse.error(res, "Failed to check email template access: " + errorMessage, 500);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
};
/**
 * Pay on Delivery Check Middleware
 */
exports.checkPayOnDelivery = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var userId, cacheKey, userOrders, cachedOrders, error_4, errorMessage;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || req.userId;
                if (!userId) {
                    http_util_1.HttpResponse.error(res, 'User not authenticated', 401);
                    return [2 /*return*/];
                }
                cacheKey = "user_orders:" + userId;
                userOrders = void 0;
                cachedOrders = inMemoryStore_1.inMemoryStore.get(cacheKey);
                if (!cachedOrders) return [3 /*break*/, 1];
                userOrders = parseInt(cachedOrders, 10);
                return [3 /*break*/, 3];
            case 1: return [4 /*yield*/, prisma.order.count({
                    where: {
                        userId: userId,
                        orderStatus: { "in": [client_1.OrderStatus.DELIVERED] }
                    }
                })];
            case 2:
                userOrders = _b.sent();
                inMemoryStore_1.inMemoryStore.set(cacheKey, userOrders.toString(), 3600);
                _b.label = 3;
            case 3:
                if (userOrders === 0) {
                    http_util_1.HttpResponse.error(res, 'Pay on delivery not available for new customers', 403);
                    return [2 /*return*/];
                }
                next();
                return [3 /*break*/, 5];
            case 4:
                error_4 = _b.sent();
                errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error';
                http_util_1.HttpResponse.error(res, "Failed to check pay on delivery eligibility: " + errorMessage, 500);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
/**
 * Payment Request Validation Middleware
 */
exports.validatePaymentRequest = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var _a, amount, paymentMethod, transactionRef, paymentMethods, allowedPaymentMethods, error_5, errorMessage;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, amount = _a.amount, paymentMethod = _a.paymentMethod, transactionRef = _a.transactionRef;
                if (!amount || !paymentMethod) {
                    http_util_1.HttpResponse.error(res, 'Missing payment details', 400);
                    return [2 /*return*/];
                }
                if (typeof amount !== 'number' || amount <= 0) {
                    http_util_1.HttpResponse.error(res, 'Invalid payment amount. Must be a positive number.', 400);
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      SELECT unnest(enum_range(NULL::\"public\".\"PaymentMethod\")) AS value\n    "], ["\n      SELECT unnest(enum_range(NULL::\"public\".\"PaymentMethod\")) AS value\n    "])))];
            case 1:
                paymentMethods = _b.sent();
                allowedPaymentMethods = paymentMethods.map(function (row) { return row.value; });
                if (!allowedPaymentMethods.includes(paymentMethod)) {
                    http_util_1.HttpResponse.error(res, "Invalid payment method. Must be one of: " + allowedPaymentMethods.join(', ') + ".", 400);
                    return [2 /*return*/];
                }
                if (transactionRef && (typeof transactionRef !== 'string' || !/^[a-zA-Z0-9-_]+$/.test(transactionRef))) {
                    http_util_1.HttpResponse.error(res, 'Invalid transaction reference format. Use alphanumeric characters, hyphens, and underscores only.', 400);
                    return [2 /*return*/];
                }
                next();
                return [3 /*break*/, 3];
            case 2:
                error_5 = _b.sent();
                errorMessage = error_5 instanceof Error ? error_5.message : 'Unknown error';
                http_util_1.HttpResponse.error(res, "Failed to validate payment request: " + errorMessage, 500);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
/**
 * Raw Body Saver Middleware
 */
exports.rawBodySaver = function (req, res, next) {
    if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body; // Store as Buffer
        console.log('Raw Body Set:', {
            body: req.body.toString('utf8').slice(0, 100),
            length: req.body.length,
            headers: req.headers
        });
    }
    else {
        console.warn('Raw body is not a Buffer:', {
            bodyType: typeof req.body,
            body: req.body,
            headers: req.headers
        });
        req.rawBody = null; // Explicitly set to null if invalid
    }
    // Reparse body as JSON for downstream use
    if (req.body && Buffer.isBuffer(req.body)) {
        try {
            req.body = JSON.parse(req.body.toString('utf8'));
        }
        catch (error) {
            console.error('Failed to parse raw body as JSON:', error);
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    next();
};
var templateObject_1;
