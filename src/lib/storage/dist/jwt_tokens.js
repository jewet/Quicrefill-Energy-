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
exports.testRedisPerformance = exports.verifyAccessToken = exports.storeAccessToken = void 0;
var root_1 = require("../../exceptions/root");
var unauthorizedRequests_1 = require("../../exceptions/unauthorizedRequests");
var redis_1 = require("../../config/redis");
var generateTokenPair_1 = require("../utils/jwt/generateTokenPair");
var winston_1 = require("winston");
var env_1 = require("../../config/env");
var bcryptjs_1 = require("bcryptjs");
var jsonwebtoken_1 = require("jsonwebtoken");
// Initialize logger
var logger = winston_1["default"].createLogger({
    level: env_1.ENV.LOG_LEVEL || 'info',
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({
            filename: (env_1.ENV.LOG_DIR || './logs') + "/customer-error.log",
            level: 'error'
        }),
        new winston_1["default"].transports.File({
            filename: (env_1.ENV.LOG_DIR || './logs') + "/customer-combined.log"
        }),
    ]
});
if (env_1.ENV.NODE_ENV !== 'production') {
    logger.add(new winston_1["default"].transports.Console({
        format: winston_1["default"].format.combine(winston_1["default"].format.colorize(), winston_1["default"].format.simple())
    }));
}
// Configurable Redis command timeout (in milliseconds)
var REDIS_COMMAND_TIMEOUT = parseInt(env_1.ENV.REDIS_COMMAND_TIMEOUT || '2000', 10); // 2s for faster retries
var isRedisError = function (error) {
    return error instanceof Error && 'code' in error;
};
/**
 * Stores a hashed access token in Redis for a given user with retry logic.
 */
exports.storeAccessToken = function (accessToken, userId, retries) {
    if (retries === void 0) { retries = 3; }
    return __awaiter(void 0, void 0, Promise, function () {
        var decoded, key, hashedToken, redis, start, _loop_1, attempt, state_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // Validate inputs
                    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
                        logger.error('Invalid userId provided', { userId: userId });
                        throw new unauthorizedRequests_1.UnauthorizedRequest('Invalid user ID', root_1.AppErrorCode.INVALID_TOKEN);
                    }
                    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
                        logger.error('Invalid accessToken provided', { userId: userId });
                        throw new unauthorizedRequests_1.UnauthorizedRequest('Invalid access token', root_1.AppErrorCode.INVALID_TOKEN);
                    }
                    // Validate JWT format
                    if (!accessToken.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
                        logger.error('Malformed token provided for storage', { userId: userId, accessToken: accessToken.slice(0, 10) + '...' });
                        throw new unauthorizedRequests_1.UnauthorizedRequest('Malformed token', root_1.AppErrorCode.INVALID_TOKEN);
                    }
                    decoded = jsonwebtoken_1["default"].decode(accessToken, { complete: true });
                    if (!decoded || !decoded.payload || decoded.payload.userId !== userId || typeof decoded.payload.iat !== 'number' || typeof decoded.payload.exp !== 'number') {
                        logger.error('Invalid token payload', { userId: userId, decoded: decoded });
                        throw new unauthorizedRequests_1.UnauthorizedRequest('Invalid token payload', root_1.AppErrorCode.INVALID_TOKEN);
                    }
                    logger.debug('Token payload validated', { userId: userId, payload: decoded.payload });
                    key = "user:access-token:" + userId;
                    return [4 /*yield*/, bcryptjs_1["default"].hash(accessToken, 10)];
                case 1:
                    hashedToken = _b.sent();
                    logger.debug('Storing hashed access token in Redis', {
                        userId: userId,
                        key: key,
                        hashedTokenLength: hashedToken.length,
                        expiresIn: generateTokenPair_1.ACCESS_TOKEN_EXPIRES_IN - 120
                    });
                    redis = redis_1.getRedisClient();
                    start = Date.now();
                    _loop_1 = function (attempt) {
                        var multi, result, duration, info, blockedClients, clientList, error_1, duration, errMsg;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    logger.debug("Attempt " + attempt + "/" + retries + " to store hashed access token", { userId: userId, key: key });
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 8, , 10]);
                                    if (!(!redis.isOpen || !redis.isReady)) return [3 /*break*/, 3];
                                    logger.warn('Redis client not ready, attempting to reconnect', {
                                        userId: userId,
                                        key: key,
                                        isOpen: redis.isOpen,
                                        isReady: redis.isReady
                                    });
                                    return [4 /*yield*/, redis.connect()];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3:
                                    multi = redis.multi();
                                    multi.set(key, hashedToken, { EX: generateTokenPair_1.ACCESS_TOKEN_EXPIRES_IN - 120 });
                                    return [4 /*yield*/, Promise.race([
                                            multi.exec(),
                                            new Promise(function (_, reject) {
                                                return setTimeout(function () { return reject(new Error("Redis MULTI operation timed out after " + REDIS_COMMAND_TIMEOUT + "ms")); }, REDIS_COMMAND_TIMEOUT);
                                            }),
                                        ])];
                                case 4:
                                    result = _a.sent();
                                    duration = Date.now() - start;
                                    logger.info('Hashed access token stored successfully', { userId: userId, key: key, result: result, duration: duration, attempt: attempt });
                                    return [4 /*yield*/, redis.info('CLIENTS')];
                                case 5:
                                    info = _a.sent();
                                    blockedClients = ((_a = info.match(/blocked_clients:(\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || '0';
                                    if (!(parseInt(blockedClients) > 0)) return [3 /*break*/, 7];
                                    return [4 /*yield*/, redis.sendCommand(['CLIENT', 'LIST'])];
                                case 6:
                                    clientList = _a.sent();
                                    logger.warn('Detected blocked clients after storing token', {
                                        userId: userId,
                                        blockedClients: blockedClients,
                                        clientList: clientList ? String(clientList) : 'unknown'
                                    });
                                    _a.label = 7;
                                case 7: return [2 /*return*/, { value: void 0 }];
                                case 8:
                                    error_1 = _a.sent();
                                    duration = Date.now() - start;
                                    errMsg = error_1 instanceof Error ? error_1.message : String(error_1);
                                    logger.error("Attempt " + attempt + "/" + retries + " failed to store hashed access token", {
                                        userId: userId,
                                        key: key,
                                        duration: duration,
                                        attempt: attempt,
                                        error: errMsg,
                                        code: isRedisError(error_1) ? error_1.code : undefined,
                                        stack: error_1 instanceof Error ? error_1.stack : undefined
                                    });
                                    if (attempt === retries) {
                                        throw new Error("Failed to store hashed access token after " + retries + " attempts: " + errMsg);
                                    }
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500 * attempt); })];
                                case 9:
                                    _a.sent();
                                    return [3 /*break*/, 10];
                                case 10: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _b.label = 2;
                case 2:
                    if (!(attempt <= retries)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 3:
                    state_1 = _b.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _b.label = 4;
                case 4:
                    attempt++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/];
            }
        });
    });
};
/**
 * Verifies if an access token exists in Redis for a given user.
 * Returns the hashed token for bcrypt comparison.
 */
exports.verifyAccessToken = function (userId) { return __awaiter(void 0, void 0, Promise, function () {
    var key, redis, start, error_2, errMsg, exists, hashedAccessToken, duration, info, blockedClients, clientList, error_3, duration, errMsg;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!userId || typeof userId !== 'string' || userId.trim() === '') {
                    logger.error('Invalid userId provided for verification', { userId: userId });
                    throw new unauthorizedRequests_1.UnauthorizedRequest('Invalid user ID', root_1.AppErrorCode.INVALID_TOKEN);
                }
                key = "user:access-token:" + userId;
                logger.debug('Verifying access token in Redis', { userId: userId, key: key });
                redis = redis_1.getRedisClient();
                start = Date.now();
                if (!(!redis.isOpen || !redis.isReady)) return [3 /*break*/, 4];
                logger.warn('Redis client not ready for verifyAccessToken', {
                    userId: userId,
                    key: key,
                    isOpen: redis.isOpen,
                    isReady: redis.isReady
                });
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, redis.connect()];
            case 2:
                _b.sent();
                return [3 /*break*/, 4];
            case 3:
                error_2 = _b.sent();
                errMsg = error_2 instanceof Error ? error_2.message : String(error_2);
                logger.error('Failed to reconnect Redis client', { userId: userId, key: key, error: errMsg });
                throw new Error("Redis client reconnection failed: " + errMsg);
            case 4:
                _b.trys.push([4, 10, , 11]);
                return [4 /*yield*/, Promise.race([
                        redis.exists(key),
                        new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Redis EXISTS operation timed out after " + REDIS_COMMAND_TIMEOUT + "ms")); }, REDIS_COMMAND_TIMEOUT);
                        }),
                    ])];
            case 5:
                exists = _b.sent();
                if (!exists) {
                    logger.warn('Access token not found in Redis', { userId: userId, key: key });
                    return [2 /*return*/, null];
                }
                return [4 /*yield*/, Promise.race([
                        redis.get(key),
                        new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Redis GET operation timed out after " + REDIS_COMMAND_TIMEOUT + "ms")); }, REDIS_COMMAND_TIMEOUT);
                        }),
                    ])];
            case 6:
                hashedAccessToken = _b.sent();
                if (!hashedAccessToken) {
                    logger.warn('Access token retrieved but empty', { userId: userId, key: key });
                    return [2 /*return*/, null];
                }
                duration = Date.now() - start;
                logger.info('Hashed access token retrieved successfully', { userId: userId, key: key, tokenLength: hashedAccessToken.length, duration: duration });
                return [4 /*yield*/, redis.info('CLIENTS')];
            case 7:
                info = _b.sent();
                blockedClients = ((_a = info.match(/blocked_clients:(\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || '0';
                if (!(parseInt(blockedClients) > 0)) return [3 /*break*/, 9];
                return [4 /*yield*/, redis.sendCommand(['CLIENT', 'LIST'])];
            case 8:
                clientList = _b.sent();
                logger.warn('Detected blocked clients after verifying token', {
                    userId: userId,
                    blockedClients: blockedClients,
                    clientList: clientList ? String(clientList) : 'unknown'
                });
                _b.label = 9;
            case 9: return [2 /*return*/, hashedAccessToken];
            case 10:
                error_3 = _b.sent();
                duration = Date.now() - start;
                errMsg = error_3 instanceof Error ? error_3.message : String(error_3);
                logger.error('Failed to verify access token in Redis', {
                    userId: userId,
                    key: key,
                    duration: duration,
                    error: errMsg,
                    code: isRedisError(error_3) ? error_3.code : undefined,
                    stack: error_3 instanceof Error ? error_3.stack : undefined
                });
                return [2 /*return*/, null];
            case 11: return [2 /*return*/];
        }
    });
}); };
/**
 * Tests Redis performance by performing multiple SET operations.
 */
exports.testRedisPerformance = function () { return __awaiter(void 0, void 0, Promise, function () {
    var redis, start, error_4, errMsg, i, key, duration, info, blockedClients, clientList, error_5, duration, errMsg;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                logger.info('Starting Redis performance test...');
                redis = redis_1.getRedisClient();
                start = Date.now();
                if (!(!redis.isOpen || !redis.isReady)) return [3 /*break*/, 4];
                logger.warn('Redis client not ready for performance test', {
                    isOpen: redis.isOpen,
                    isReady: redis.isReady
                });
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, redis.connect()];
            case 2:
                _b.sent();
                return [3 /*break*/, 4];
            case 3:
                error_4 = _b.sent();
                errMsg = error_4 instanceof Error ? error_4.message : String(error_4);
                logger.error('Failed to reconnect Redis client for performance test', { error: errMsg });
                throw new Error("Redis client reconnection failed: " + errMsg);
            case 4:
                _b.trys.push([4, 12, , 13]);
                i = 0;
                _b.label = 5;
            case 5:
                if (!(i < 100)) return [3 /*break*/, 8];
                key = "test:" + i;
                return [4 /*yield*/, Promise.race([
                        redis.set(key, "value-" + i, { EX: 3600 }),
                        new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error("Redis SET operation timed out after " + REDIS_COMMAND_TIMEOUT + "ms")); }, REDIS_COMMAND_TIMEOUT);
                        }),
                    ])];
            case 6:
                _b.sent();
                _b.label = 7;
            case 7:
                i++;
                return [3 /*break*/, 5];
            case 8:
                duration = Date.now() - start;
                logger.info('Redis performance test completed: Set 100 keys successfully', { duration: duration });
                return [4 /*yield*/, redis.info('CLIENTS')];
            case 9:
                info = _b.sent();
                blockedClients = ((_a = info.match(/blocked_clients:(\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || '0';
                if (!(parseInt(blockedClients) > 0)) return [3 /*break*/, 11];
                return [4 /*yield*/, redis.sendCommand(['CLIENT', 'LIST'])];
            case 10:
                clientList = _b.sent();
                logger.warn('Detected blocked clients after performance test', {
                    blockedClients: blockedClients,
                    clientList: clientList ? String(clientList) : 'unknown'
                });
                _b.label = 11;
            case 11: return [3 /*break*/, 13];
            case 12:
                error_5 = _b.sent();
                duration = Date.now() - start;
                errMsg = error_5 instanceof Error ? error_5.message : String(error_5);
                logger.error('Redis performance test failed', {
                    duration: duration,
                    error: errMsg,
                    code: isRedisError(error_5) ? error_5.code : undefined,
                    stack: error_5 instanceof Error ? error_5.stack : undefined
                });
                throw new Error("Redis performance test failed: " + errMsg);
            case 13: return [2 /*return*/];
        }
    });
}); };
