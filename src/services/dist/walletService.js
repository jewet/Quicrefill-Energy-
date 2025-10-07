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
exports.WalletService = void 0;
var client_1 = require("@prisma/client");
var walletUtils_1 = require("../utils/walletUtils");
var paymentService_1 = require("./paymentService");
var axios_1 = require("axios");
var async_retry_1 = require("async-retry");
var crypto_1 = require("crypto");
var auditLogService_1 = require("./auditLogService");
var fraudDetectionService_1 = require("./fraudDetectionService");
var uuid_1 = require("uuid");
var redis_1 = require("../config/redis");
var opossum_1 = require("opossum");
var logger_1 = require("../utils/logger");
// Metrics storage (in-memory for simplicity, consider Prometheus in production)
var metrics = {
    webhookSuccess: 0,
    webhookFailures: 0,
    redisFailures: 0,
    cacheHits: 0,
    cacheMisses: 0
};
// Circuit breaker configuration for Redis
var circuitBreakerOptions = {
    timeout: 1000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
};
var redisCircuitBreaker = new opossum_1["default"](function (fn) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, fn()];
}); }); }, circuitBreakerOptions);
var DEFAULT_PRODUCT_TYPE = "petrol";
var VALID_PRODUCT_TYPES = ["diesel", "petrol", "gas", "electricity"];
if (!VALID_PRODUCT_TYPES.includes(DEFAULT_PRODUCT_TYPE)) {
    logger_1.logger.error("Invalid DEFAULT_PRODUCT_TYPE", { DEFAULT_PRODUCT_TYPE: DEFAULT_PRODUCT_TYPE });
    throw new Error("DEFAULT_PRODUCT_TYPE must be one of: " + VALID_PRODUCT_TYPES.join(", "));
}
var prisma = new client_1.PrismaClient();
var WalletService = /** @class */ (function () {
    function WalletService() {
        var _this = this;
        this.auditLogService = new auditLogService_1.AuditLogService();
        this.fraudDetectionService = new fraudDetectionService_1.FraudDetectionService();
        this.MAX_WEBHOOK_ATTEMPTS = 5;
        this.WEBHOOK_TIMEOUT_MS = 10000;
        this.DLQ_KEY = "webhook:dlq";
        this.notificationService = {
            sendTransactionNotification: function (params) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    logger_1.logger.info("Sending transaction notification", params);
                    return [2 /*return*/];
                });
            }); },
            sendWebhookFailureNotification: function (params) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    logger_1.logger.warn("Sending webhook failure notification", params);
                    return [2 /*return*/];
                });
            }); }
        };
    }
    /**
     * Invalidates wallet balance cache for a user with circuit breaker and fallback.
     * @param userId The user ID whose cache should be invalidated.
     * @returns Number of keys deleted or 0 if fallback is used.
     */
    WalletService.prototype.invalidateBalanceCache = function (userId) {
        return __awaiter(this, void 0, Promise, function () {
            var redis_2, cacheKeys_1, deleted_1, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        redis_2 = redis_1.getRedisClient();
                        cacheKeys_1 = [
                            "wallet_balance:" + userId,
                            "wallet:balance:" + userId,
                        ];
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                                var result;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, redis_2.del(cacheKeys_1)];
                                                        case 1:
                                                            result = _a.sent();
                                                            metrics.cacheMisses++;
                                                            logger_1.logger.info("Cache invalidation successful", { userId: userId, cacheKeys: cacheKeys_1, deleted: deleted_1 });
                                                            return [2 /*return*/, result];
                                                    }
                                                });
                                            }); }, {
                                                retries: 2,
                                                factor: 2,
                                                minTimeout: 500,
                                                maxTimeout: 2000,
                                                onRetry: function (error, attempt) {
                                                    logger_1.logger.warn("Retrying cache invalidation", { userId: userId, attempt: attempt, error: error });
                                                }
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); })];
                    case 1:
                        deleted_1 = _a.sent();
                        return [2 /*return*/, deleted_1];
                    case 2:
                        error_1 = _a.sent();
                        metrics.redisFailures++;
                        logger_1.logger.error("Redis cache invalidation failed, falling back to database", {
                            userId: userId,
                            error: error_1 instanceof Error ? error_1.message : String(error_1)
                        });
                        // Fallback: Ensure database is used on next balance check
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.verifyWebhookSignature = function (payload, signature) {
        var secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET || "secret";
        var computedSignature = crypto_1.createHmac("sha256", secret)
            .update(JSON.stringify(payload))
            .digest("hex");
        return computedSignature === signature;
    };
    WalletService.prototype.queueWebhookRetry = function (webhookUrl, payload, transactionId, eventType) {
        return __awaiter(this, void 0, Promise, function () {
            var webhookAttempt, redis_3, resolvedPayload, payment, error_2, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 11]);
                        redis_3 = redis_1.getRedisClient();
                        resolvedPayload = payload;
                        if (!(!payload.userId && transactionId)) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, prisma.payment.findFirst({
                                where: { transactionRef: transactionId },
                                select: { userId: true }
                            })];
                    case 2:
                        payment = _a.sent();
                        resolvedPayload = __assign(__assign({}, payload), { userId: (payment === null || payment === void 0 ? void 0 : payment.userId) || null });
                        if (!(payment === null || payment === void 0 ? void 0 : payment.userId)) {
                            logger_1.logger.warn("Could not resolve userId for webhook retry queue", { transactionId: transactionId, webhookUrl: webhookUrl });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger_1.logger.error("Error fetching userId for webhook retry queue", {
                            transactionId: transactionId,
                            webhookUrl: webhookUrl,
                            error: error_2 instanceof Error ? error_2.message : String(error_2)
                        });
                        return [3 /*break*/, 4];
                    case 4:
                        webhookAttempt = {
                            id: uuid_1.v4(),
                            transactionId: transactionId,
                            eventType: eventType,
                            webhookUrl: webhookUrl,
                            payload: resolvedPayload,
                            status: "PENDING",
                            attempts: 0,
                            createdAt: new Date()
                        };
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, redis_3.lPush("webhook:retry:" + transactionId, JSON.stringify(webhookAttempt))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 5:
                        _a.sent();
                        logger_1.logger.info("Webhook retry queued", {
                            transactionId: transactionId,
                            webhookUrl: webhookUrl,
                            eventType: eventType,
                            userId: resolvedPayload.userId
                        });
                        return [4 /*yield*/, this.processWebhookQueue(transactionId)];
                    case 6:
                        _a.sent();
                        return [3 /*break*/, 11];
                    case 7:
                        error_3 = _a.sent();
                        logger_1.logger.error("Failed to queue webhook retry", {
                            transactionId: transactionId,
                            error: error_3 instanceof Error ? error_3.message : String(error_3),
                            webhookDetails: webhookAttempt
                        });
                        if (!webhookAttempt) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.moveToDeadLetterQueue(webhookAttempt)];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        logger_1.logger.warn("Webhook attempt undefined, cannot move to DLQ", { transactionId: transactionId });
                        _a.label = 10;
                    case 10: return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.moveToDeadLetterQueue = function (attempt) {
        return __awaiter(this, void 0, Promise, function () {
            var redis_4, error_4;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        redis_4 = redis_1.getRedisClient();
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, redis_4.lPush(this.DLQ_KEY, JSON.stringify(attempt))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        logger_1.logger.warn("Webhook attempt moved to DLQ", { transactionId: attempt.transactionId, webhookUrl: attempt.webhookUrl });
                        return [4 /*yield*/, this.notificationService.sendWebhookFailureNotification({
                                userId: null,
                                transactionId: attempt.transactionId,
                                webhookUrl: attempt.webhookUrl,
                                error: "Max retries exceeded, moved to DLQ"
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        logger_1.logger.error("Failed to move webhook attempt to DLQ", { transactionId: attempt.transactionId, error: error_4 });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.processWebhookQueue = function (transactionId) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, key, _loop_1, this_1, state_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        redis = redis_1.getRedisClient();
                        key = "webhook:retry:" + transactionId;
                        _loop_1 = function () {
                            var webhookData, error_5, attempt, error_6, errorMessage, redisError_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        webhookData = null;
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, redis.rPop(key)];
                                                    case 1: return [2 /*return*/, _a.sent()];
                                                }
                                            }); }); })];
                                    case 2:
                                        webhookData = _a.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_5 = _a.sent();
                                        logger_1.logger.error("Redis error during webhook queue processing, skipping", { transactionId: transactionId, error: error_5 });
                                        return [2 /*return*/, "break"];
                                    case 4:
                                        if (!webhookData)
                                            return [2 /*return*/, "break"];
                                        attempt = JSON.parse(webhookData);
                                        if (!(attempt.attempts >= this_1.MAX_WEBHOOK_ATTEMPTS)) return [3 /*break*/, 6];
                                        logger_1.logger.error("Max webhook attempts reached, moving to DLQ", { transactionId: transactionId, webhookUrl: attempt.webhookUrl });
                                        return [4 /*yield*/, this_1.moveToDeadLetterQueue(attempt)];
                                    case 5:
                                        _a.sent();
                                        return [2 /*return*/, "continue"];
                                    case 6:
                                        _a.trys.push([6, 8, , 15]);
                                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                                var response;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, axios_1["default"].post(attempt.webhookUrl, attempt.payload, {
                                                                headers: { "X-Webhook-Signature": this.generateWebhookSignature(attempt.payload) },
                                                                timeout: this.WEBHOOK_TIMEOUT_MS
                                                            })];
                                                        case 1:
                                                            response = _a.sent();
                                                            if (!(response.status >= 200 && response.status < 300)) return [3 /*break*/, 3];
                                                            return [4 /*yield*/, this.updateWebhookAttemptStatus(attempt.id, "SUCCESS")];
                                                        case 2:
                                                            _a.sent();
                                                            metrics.webhookSuccess++;
                                                            logger_1.logger.info("Webhook retry successful", {
                                                                transactionId: transactionId,
                                                                webhookUrl: attempt.webhookUrl,
                                                                attempt: attempt.attempts + 1
                                                            });
                                                            return [3 /*break*/, 4];
                                                        case 3: throw new Error("Webhook failed with status " + response.status);
                                                        case 4: return [2 /*return*/];
                                                    }
                                                });
                                            }); }, {
                                                retries: 1,
                                                factor: 2,
                                                minTimeout: 1000 + Math.random() * 100,
                                                maxTimeout: 30000,
                                                onRetry: function (error, attemptNumber) {
                                                    logger_1.logger.warn("Retrying webhook delivery", {
                                                        transactionId: transactionId,
                                                        webhookUrl: attempt.webhookUrl,
                                                        attempt: attempt.attempts + attemptNumber,
                                                        error: error
                                                    });
                                                }
                                            })];
                                    case 7:
                                        _a.sent();
                                        return [3 /*break*/, 15];
                                    case 8:
                                        error_6 = _a.sent();
                                        metrics.webhookFailures++;
                                        errorMessage = error_6 instanceof Error ? error_6.message : "Unknown error";
                                        attempt.attempts += 1;
                                        attempt.lastAttemptAt = new Date();
                                        _a.label = 9;
                                    case 9:
                                        _a.trys.push([9, 11, , 13]);
                                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, redis.lPush(key, JSON.stringify(attempt))];
                                                        case 1:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); })];
                                    case 10:
                                        _a.sent();
                                        return [3 /*break*/, 13];
                                    case 11:
                                        redisError_1 = _a.sent();
                                        logger_1.logger.error("Redis error, moving webhook attempt to DLQ", { transactionId: transactionId, error: redisError_1 });
                                        return [4 /*yield*/, this_1.moveToDeadLetterQueue(attempt)];
                                    case 12:
                                        _a.sent();
                                        return [3 /*break*/, 13];
                                    case 13:
                                        logger_1.logger.error("Webhook retry attempt failed", {
                                            transactionId: transactionId,
                                            webhookUrl: attempt.webhookUrl,
                                            attempt: attempt.attempts,
                                            error: errorMessage
                                        });
                                        return [4 /*yield*/, this_1.updateWebhookAttemptStatus(attempt.id, "PENDING")];
                                    case 14:
                                        _a.sent();
                                        return [3 /*break*/, 15];
                                    case 15: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 3];
                        return [5 /*yield**/, _loop_1()];
                    case 2:
                        state_1 = _a.sent();
                        if (state_1 === "break")
                            return [3 /*break*/, 3];
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.updateWebhookAttemptStatus = function (attemptId, status) {
        return __awaiter(this, void 0, Promise, function () {
            var error_7, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.webhookAttempt.upsert({
                                where: { id: attemptId },
                                update: { status: status, updatedAt: new Date() },
                                create: {
                                    id: attemptId,
                                    transactionId: null,
                                    eventType: "UNKNOWN",
                                    webhookUrl: "unknown",
                                    payload: {},
                                    status: status,
                                    attempts: 0,
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                }
                            })];
                    case 1:
                        _a.sent();
                        logger_1.logger.info("Webhook attempt status updated", { attemptId: attemptId, status: status });
                        return [3 /*break*/, 3];
                    case 2:
                        error_7 = _a.sent();
                        errorMessage = error_7 instanceof Error ? error_7.message : String(error_7);
                        logger_1.logger.error("Failed to update webhook attempt status", { attemptId: attemptId, status: status, error: errorMessage });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.getBalance = function (userId) {
        return __awaiter(this, void 0, Promise, function () {
            var cacheKey_1, redis_5, cachedBalance, redisError_2, wallet, balance_1, redisError_3, error_8, errorMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 13]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _a.sent();
                        cacheKey_1 = "wallet_balance:" + userId;
                        redis_5 = redis_1.getRedisClient();
                        cachedBalance = null;
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                var result;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, redis_5.get(cacheKey_1)];
                                        case 1:
                                            result = _a.sent();
                                            if (result)
                                                metrics.cacheHits++;
                                            else
                                                metrics.cacheMisses++;
                                            return [2 /*return*/, result];
                                    }
                                });
                            }); })];
                    case 3:
                        cachedBalance = _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        redisError_2 = _a.sent();
                        metrics.redisFailures++;
                        logger_1.logger.warn("Redis connection error during balance retrieval, falling back to database", {
                            userId: userId,
                            error: redisError_2 instanceof Error ? redisError_2.message : String(redisError_2)
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        if (cachedBalance) {
                            logger_1.logger.info("Balance retrieved from cache", { userId: userId, balance: cachedBalance });
                            return [2 /*return*/, parseFloat(cachedBalance)];
                        }
                        logger_1.logger.info("Cache miss, fetching balance from database", { userId: userId });
                        return [4 /*yield*/, prisma.wallet.findUnique({ where: { userId: userId } })];
                    case 6:
                        wallet = _a.sent();
                        if (!wallet)
                            throw new Error("Wallet not found");
                        balance_1 = wallet.balance.toNumber();
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // Explicitly delete the previous cache entry
                                        return [4 /*yield*/, redis_5.del(cacheKey_1)];
                                        case 1:
                                            // Explicitly delete the previous cache entry
                                            _a.sent();
                                            return [4 /*yield*/, redis_5.set(cacheKey_1, balance_1.toString(), { EX: 3600 })];
                                        case 2:
                                            _a.sent();
                                            logger_1.logger.info("Balance cached successfully after explicit deletion", { userId: userId, balance: balance_1 });
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        redisError_3 = _a.sent();
                        metrics.redisFailures++;
                        logger_1.logger.warn("Failed to cache balance, continuing with database value", {
                            userId: userId,
                            error: redisError_3 instanceof Error ? redisError_3.message : String(redisError_3)
                        });
                        return [3 /*break*/, 10];
                    case 10:
                        logger_1.logger.info("Balance retrieved from database", { userId: userId, balance: balance_1 });
                        return [2 /*return*/, balance_1];
                    case 11:
                        error_8 = _a.sent();
                        errorMessage = error_8 instanceof Error ? error_8.message : "Unknown error";
                        logger_1.logger.error("Error fetching wallet balance", { error: errorMessage, userId: userId });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "BALANCE_CHECK_FAILED",
                                details: { error: errorMessage }
                            })];
                    case 12:
                        _a.sent();
                        throw new Error("Failed to retrieve wallet balance: " + errorMessage);
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    /**
   * Deposits funds into a user's wallet asynchronously.
   * @param userId - The ID of the user making the deposit.
   * @param amount - The amount to deposit.
   * @param paymentMethod - The payment method used for the deposit.
   * @param productType - Optional product type (e.g., petrol, gas) if not a wallet top-up.
   * @param petrolOrderId - Optional ID of the petrol order.
   * @param gasOrderId - Optional ID of the gas order.
   * @param transactionRef - Optional transaction reference; generated if not provided.
   * @returns A promise resolving to the created WalletTransaction.
   * @throws Error if validation fails or the deposit process encounters an issue.
   */
    WalletService.prototype.depositFunds = function (userId, amount, paymentMethod, productType, petrolOrderId, gasOrderId, transactionRef) {
        return __awaiter(this, void 0, Promise, function () {
            var ref, isWalletTopUp, existingPayment, transaction_1, webhookUrl, error_9, err;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ref = transactionRef !== null && transactionRef !== void 0 ? transactionRef : "TOPUP-" + uuid_1.v4() + "-" + Date.now();
                        isWalletTopUp = !productType;
                        logger_1.logger.info("Initiating wallet deposit", {
                            userId: userId,
                            amount: amount,
                            paymentMethod: paymentMethod,
                            transactionRef: ref,
                            isWalletTopUp: isWalletTopUp,
                            productType: productType !== null && productType !== void 0 ? productType : null
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 6]);
                        if (amount <= 0) {
                            throw new Error("Invalid transaction amount");
                        }
                        return [4 /*yield*/, prisma.payment.findFirst({
                                where: { transactionRef: ref }
                            })];
                    case 2:
                        existingPayment = _a.sent();
                        if (existingPayment) {
                            throw new Error("Transaction reference " + ref + " already exists");
                        }
                        return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var user, wallet, paymentResult, metadata, transaction;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0: return [4 /*yield*/, tx.user.findUnique({ where: { id: userId } })];
                                        case 1:
                                            user = _c.sent();
                                            if (!user) {
                                                throw new Error("User not found");
                                            }
                                            return [4 /*yield*/, tx.wallet.findFirst({ where: { userId: userId } })];
                                        case 2:
                                            wallet = _c.sent();
                                            if (!wallet) {
                                                throw new Error("Wallet not found");
                                            }
                                            return [4 /*yield*/, paymentService_1["default"].processPayment(userId, amount, paymentMethod, productType, ref, undefined, undefined, isWalletTopUp)];
                                        case 3:
                                            paymentResult = _c.sent();
                                            metadata = {
                                                isWalletTopUp: isWalletTopUp,
                                                paymentLink: (_b = (_a = paymentResult.paymentDetails) === null || _a === void 0 ? void 0 : _a.link) !== null && _b !== void 0 ? _b : null,
                                                productType: productType !== null && productType !== void 0 ? productType : null
                                            };
                                            return [4 /*yield*/, tx.walletTransaction.create({
                                                    data: {
                                                        userId: userId,
                                                        walletId: wallet.id,
                                                        amount: new client_1.Prisma.Decimal(amount),
                                                        transactionType: client_1.TransactionType.DEPOSIT,
                                                        status: client_1.TransactionStatus.PENDING,
                                                        paymentId: paymentResult.transactionId,
                                                        metadata: metadata,
                                                        petrolOrderId: petrolOrderId,
                                                        gasOrderId: gasOrderId
                                                    }
                                                })];
                                        case 4:
                                            transaction = _c.sent();
                                            return [2 /*return*/, transaction];
                                    }
                                });
                            }); })];
                    case 3:
                        transaction_1 = _a.sent();
                        // Safely trigger webhook for Flutterwave payments
                        if (paymentMethod === client_1.PaymentMethod.FLUTTERWAVE &&
                            transaction_1.metadata &&
                            typeof transaction_1.metadata === "object" &&
                            "paymentLink" in transaction_1.metadata &&
                            transaction_1.metadata.paymentLink // Ensure paymentLink exists and is truthy
                        ) {
                            webhookUrl = process.env.FLUTTERWAVE_WEBHOOK_URL;
                            if (!webhookUrl) {
                                logger_1.logger.warn("Flutterwave webhook URL not configured", {
                                    transactionId: transaction_1.id
                                });
                            }
                            else {
                                this.triggerWebhook(userId, {
                                    id: transaction_1.id,
                                    amount: transaction_1.amount.toNumber(),
                                    status: transaction_1.status,
                                    createdAt: transaction_1.createdAt.toISOString(),
                                    metadata: transaction_1.metadata,
                                    userId: transaction_1.userId
                                }, "DEPOSIT_PENDING")["catch"](function (error) {
                                    logger_1.logger.error("Failed to trigger webhook", {
                                        transactionId: transaction_1.id,
                                        error: error instanceof Error ? error.message : String(error)
                                    });
                                });
                            }
                        }
                        logger_1.logger.info("Wallet deposit processed", {
                            userId: userId,
                            transactionId: transaction_1.id,
                            amount: amount,
                            paymentMethod: paymentMethod,
                            transactionRef: ref,
                            isWalletTopUp: isWalletTopUp
                        });
                        return [2 /*return*/, transaction_1];
                    case 4:
                        error_9 = _a.sent();
                        err = error_9 instanceof Error ? error_9 : new Error(String(error_9));
                        logger_1.logger.error("Error processing wallet deposit", {
                            userId: userId,
                            transactionRef: ref,
                            amount: amount,
                            paymentMethod: paymentMethod,
                            isWalletTopUp: isWalletTopUp,
                            error: err.message,
                            stack: err.stack
                        });
                        return [4 /*yield*/, this.queueAuditLog({
                                userId: userId,
                                action: "DEPOSIT_FAILED",
                                details: {
                                    transactionRef: transactionRef,
                                    amount: amount,
                                    paymentMethod: paymentMethod,
                                    error: err.message
                                },
                                entityType: "WALLET_TRANSACTION",
                                entityId: null
                            })["catch"](function (auditErr) {
                                return logger_1.logger.error("Failed to queue audit log for DEPOSIT_FAILED", {
                                    userId: userId,
                                    error: auditErr instanceof Error ? auditErr.message : String(auditErr)
                                });
                            })];
                    case 5:
                        _a.sent();
                        throw new Error("Deposit failed: " + err.message);
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Queues an audit log entry for tracking actions.
     * @param params - Parameters for the audit log.
     */
    WalletService.prototype.queueAuditLog = function (params) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.auditLog.create({
                            data: {
                                id: uuid_1.v4(),
                                userId: params.userId,
                                action: params.action,
                                details: params.details,
                                entityType: params.entityType,
                                entityId: params.entityId,
                                createdAt: new Date()
                            }
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.payWithWallet = function (userId, amount, orderId, orderType, serviceCharge, vatRate, voucherCode, deliveryFee) {
        return __awaiter(this, void 0, Promise, function () {
            var voucherDiscount_1, voucher_1, result, vat_1, totalDeliveryFee, totalAmount_1, transaction, error_10, errorMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 10]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!amount || typeof amount !== "number" || amount <= 0)
                            throw new Error("Payment amount must be positive");
                        if (!orderId || typeof orderId !== "string")
                            throw new Error("Valid orderId is required");
                        if (!VALID_PRODUCT_TYPES.includes(orderType)) {
                            throw new Error("Valid orderType is required (diesel, petrol, gas, electricity)");
                        }
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.fraudDetectionService.checkForSuspiciousActivity(userId, amount, "PAYMENT", "ORDER", orderId)];
                    case 2:
                        _a.sent();
                        voucherDiscount_1 = 0;
                        if (!voucherCode) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.applyVoucher(userId, voucherCode, orderType, deliveryFee || 0)];
                    case 3:
                        result = _a.sent();
                        voucherDiscount_1 = result.discountAmount;
                        voucher_1 = result.voucher;
                        _a.label = 4;
                    case 4:
                        vat_1 = amount * vatRate;
                        totalDeliveryFee = Math.max((deliveryFee || 0) - voucherDiscount_1, 0);
                        totalAmount_1 = amount + totalDeliveryFee + serviceCharge + vat_1;
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var wallet, transactionData, createdTransaction, auditLogRequest;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, tx.wallet.findUnique({ where: { userId: userId } })];
                                                        case 1:
                                                            wallet = _a.sent();
                                                            if (!wallet || wallet.balance.lessThan(totalAmount_1)) {
                                                                throw new Error("Insufficient wallet balance");
                                                            }
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { decrement: totalAmount_1 } }
                                                                })];
                                                        case 2:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 3:
                                                            _a.sent();
                                                            transactionData = __assign(__assign(__assign(__assign(__assign({ id: uuid_1.v4(), userId: userId, walletId: wallet.id, amount: new client_1.Prisma.Decimal(totalAmount_1), transactionType: client_1.TransactionType.DEDUCTION, status: client_1.TransactionStatus.PENDING }, (orderType === "diesel" && { dieselOrderId: orderId })), (orderType === "petrol" && { petrolOrderId: orderId })), (orderType === "gas" && { gasOrderId: orderId })), (orderType === "electricity" && { electricityOrderId: orderId })), { metadata: {
                                                                    voucherCode: voucherCode,
                                                                    deliveryFee: deliveryFee,
                                                                    voucherDiscount: voucherDiscount_1,
                                                                    serviceCharge: serviceCharge,
                                                                    vat: vat_1,
                                                                    webhookStatus: "PENDING"
                                                                } });
                                                            return [4 /*yield*/, tx.walletTransaction.create({ data: transactionData })];
                                                        case 4:
                                                            createdTransaction = _a.sent();
                                                            return [4 /*yield*/, tx.walletTransaction.update({
                                                                    where: { id: createdTransaction.id },
                                                                    data: { status: client_1.TransactionStatus.COMPLETED }
                                                                })];
                                                        case 5:
                                                            _a.sent();
                                                            if (!(voucher_1 && voucherCode)) return [3 /*break*/, 7];
                                                            return [4 /*yield*/, tx.voucher.update({
                                                                    where: { id: voucher_1.id },
                                                                    data: { uses: { increment: 1 } }
                                                                })];
                                                        case 6:
                                                            _a.sent();
                                                            _a.label = 7;
                                                        case 7: return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                userId: userId,
                                                                title: "Payment Successful",
                                                                message: "Your wallet was debited " + totalAmount_1 + " for order " + orderId + ".",
                                                                type: "PAYMENT",
                                                                metadata: { orderType: orderType, voucherCode: voucherCode, voucherDiscount: voucherDiscount_1 }
                                                            })];
                                                        case 8:
                                                            _a.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "PAYMENT_COMPLETED",
                                                                details: { amount: totalAmount_1, orderId: orderId, orderType: orderType, voucherCode: voucherCode, voucherDiscount: voucherDiscount_1 },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: createdTransaction.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 9:
                                                            _a.sent();
                                                            return [2 /*return*/, createdTransaction];
                                                    }
                                                });
                                            }); })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying payment transaction", { userId: userId, attempt: attempt, error: error });
                                }
                            })];
                    case 5:
                        transaction = _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, transaction, "PAYMENT_" + transaction.status)];
                    case 6:
                        _a.sent();
                        logger_1.logger.info("Payment processed", { userId: userId, transactionId: transaction.id, totalAmount: totalAmount_1 });
                        return [2 /*return*/, transaction];
                    case 7:
                        error_10 = _a.sent();
                        errorMessage = error_10 instanceof Error ? error_10.message : "Unknown error";
                        logger_1.logger.error("Error processing wallet payment", { error: errorMessage, userId: userId });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "PAYMENT_FAILED",
                                details: { error: errorMessage, amount: amount, orderId: orderId }
                            })];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: orderId, status: client_1.TransactionStatus.FAILED }, "PAYMENT_FAILED")];
                    case 9:
                        _a.sent();
                        throw new Error("Wallet payment failed: " + errorMessage);
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.refundFunds = function (userId, amount, orderId, orderType, isPartial) {
        if (isPartial === void 0) { isPartial = false; }
        return __awaiter(this, void 0, Promise, function () {
            var transaction, error_11, errorMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 8]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!amount || typeof amount !== "number" || amount <= 0)
                            throw new Error("Refund amount must be positive");
                        if (!orderId || typeof orderId !== "string")
                            throw new Error("Valid orderId is required");
                        if (!VALID_PRODUCT_TYPES.includes(orderType)) {
                            throw new Error("Valid orderType is required (diesel, petrol, gas, electricity)");
                        }
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.fraudDetectionService.checkForSuspiciousActivity(userId, amount, "REFUND", "ORDER", orderId)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var originalTransaction, wallet, transactionData, createdTransaction, auditLogRequest;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, tx.walletTransaction.findFirst({
                                                                where: {
                                                                    OR: [
                                                                        { dieselOrderId: orderId },
                                                                        { petrolOrderId: orderId },
                                                                        { gasOrderId: orderId },
                                                                        { electricityOrderId: orderId },
                                                                    ],
                                                                    transactionType: client_1.TransactionType.DEDUCTION,
                                                                    status: client_1.TransactionStatus.COMPLETED
                                                                }
                                                            })];
                                                        case 1:
                                                            originalTransaction = _a.sent();
                                                            if (!originalTransaction)
                                                                throw new Error("No valid transaction found for refund");
                                                            if (!isPartial && originalTransaction.amount.toNumber() < amount) {
                                                                throw new Error("Refund amount exceeds original transaction amount");
                                                            }
                                                            return [4 /*yield*/, tx.wallet.findUnique({ where: { userId: userId } })];
                                                        case 2:
                                                            wallet = _a.sent();
                                                            if (!wallet)
                                                                throw new Error("Wallet not found");
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { increment: amount } }
                                                                })];
                                                        case 3:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 4:
                                                            _a.sent();
                                                            transactionData = __assign(__assign(__assign(__assign(__assign({ id: uuid_1.v4(), userId: userId, walletId: wallet.id, amount: new client_1.Prisma.Decimal(amount), transactionType: client_1.TransactionType.REFUND, status: client_1.TransactionStatus.COMPLETED }, (orderType === "diesel" && { dieselOrderId: orderId })), (orderType === "petrol" && { petrolOrderId: orderId })), (orderType === "gas" && { gasOrderId: orderId })), (orderType === "electricity" && { electricityOrderId: orderId })), { metadata: {
                                                                    isPartial: isPartial,
                                                                    originalTransactionId: originalTransaction.id,
                                                                    webhookStatus: "PENDING"
                                                                } });
                                                            return [4 /*yield*/, tx.walletTransaction.create({ data: transactionData })];
                                                        case 5:
                                                            createdTransaction = _a.sent();
                                                            return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                    userId: userId,
                                                                    title: (isPartial ? "Partial " : "") + "Refund Processed",
                                                                    message: "A " + (isPartial ? "partial " : "") + "refund of " + amount + " has been credited to your wallet for order " + orderId + ".",
                                                                    type: "REFUND"
                                                                })];
                                                        case 6:
                                                            _a.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "REFUND_COMPLETED",
                                                                details: { amount: amount, orderId: orderId, orderType: orderType, isPartial: isPartial },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: createdTransaction.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 7:
                                                            _a.sent();
                                                            return [2 /*return*/, createdTransaction];
                                                    }
                                                });
                                            }); })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying refund transaction", { userId: userId, attempt: attempt, error: error });
                                }
                            })];
                    case 3:
                        transaction = _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, transaction, "REFUND_" + transaction.status)];
                    case 4:
                        _a.sent();
                        logger_1.logger.info("Refund processed", { userId: userId, transactionId: transaction.id, amount: amount });
                        return [2 /*return*/, transaction];
                    case 5:
                        error_11 = _a.sent();
                        errorMessage = error_11 instanceof Error ? error_11.message : "Unknown error";
                        logger_1.logger.error("Error processing refund", { error: errorMessage, userId: userId });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "REFUND_FAILED",
                                details: { error: errorMessage, amount: amount, orderId: orderId }
                            })];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: orderId, status: client_1.TransactionStatus.FAILED }, "REFUND_FAILED")];
                    case 7:
                        _a.sent();
                        throw new Error("Refund failed: " + errorMessage);
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.validatePayment = function (userId, transactionRef) {
        return __awaiter(this, void 0, Promise, function () {
            var response, _a, amount_1, tx_ref_1, transaction, error_12, errorMessage;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 8]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!transactionRef || typeof transactionRef !== "string")
                            throw new Error("Valid transaction reference required");
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, axios_1["default"].get("https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=" + transactionRef, { headers: { Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY } })];
                    case 2:
                        response = _b.sent();
                        if (response.data.status !== "success" || response.data.data.status !== "successful") {
                            throw new Error("Payment verification failed: " + response.data.message);
                        }
                        _a = response.data.data, amount_1 = _a.amount, tx_ref_1 = _a.tx_ref;
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var walletTx, metadata, updatedTx, auditLogRequest;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, tx.walletTransaction.findFirst({
                                                                where: { payment: { transactionRef: tx_ref_1 }, status: client_1.TransactionStatus.PENDING, userId: userId },
                                                                include: { payment: true }
                                                            })];
                                                        case 1:
                                                            walletTx = _a.sent();
                                                            if (!walletTx || !walletTx.payment)
                                                                throw new Error("No pending transaction found for tx_ref: " + tx_ref_1);
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { increment: amount_1 } }
                                                                })];
                                                        case 2:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 3:
                                                            _a.sent();
                                                            metadata = walletTx.metadata && typeof walletTx.metadata === "object"
                                                                ? __assign(__assign({}, walletTx.metadata), { webhookStatus: "SENT" }) : { webhookStatus: "SENT" };
                                                            return [4 /*yield*/, tx.walletTransaction.update({
                                                                    where: { id: walletTx.id },
                                                                    data: { status: client_1.TransactionStatus.COMPLETED, metadata: metadata }
                                                                })];
                                                        case 4:
                                                            updatedTx = _a.sent();
                                                            return [4 /*yield*/, tx.payment.update({
                                                                    where: { id: walletTx.payment.id },
                                                                    data: { status: "completed" }
                                                                })];
                                                        case 5:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                    userId: userId,
                                                                    title: "Payment Validated",
                                                                    message: "Your payment of " + amount_1 + " has been validated.",
                                                                    type: "PAYMENT_VALIDATION"
                                                                })];
                                                        case 6:
                                                            _a.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "PAYMENT_VALIDATED",
                                                                details: { amount: amount_1, transactionRef: tx_ref_1 },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: walletTx.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 7:
                                                            _a.sent();
                                                            return [2 /*return*/, updatedTx];
                                                    }
                                                });
                                            }); })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying payment validation", { userId: userId, attempt: attempt, error: error });
                                }
                            })];
                    case 3:
                        transaction = _b.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, transaction, "PAYMENT_VALIDATION_" + transaction.status)];
                    case 4:
                        _b.sent();
                        logger_1.logger.info("Payment validated", { userId: userId, amount: amount_1, transactionRef: tx_ref_1 });
                        return [2 /*return*/, transaction];
                    case 5:
                        error_12 = _b.sent();
                        errorMessage = error_12 instanceof Error ? error_12.message : "Unknown error";
                        logger_1.logger.error("Error validating payment", { error: errorMessage, userId: userId, transactionRef: transactionRef });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "PAYMENT_VALIDATION_FAILED",
                                details: { error: errorMessage, transactionRef: transactionRef }
                            })];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: transactionRef, status: client_1.TransactionStatus.FAILED }, "PAYMENT_VALIDATION_FAILED")];
                    case 7:
                        _b.sent();
                        throw new Error("Payment validation failed: " + errorMessage);
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.transferToFlutterwave = function (userId, amount) {
        return __awaiter(this, void 0, Promise, function () {
            var entityId, transaction, error_13, errorMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 8]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!amount || typeof amount !== "number" || amount <= 0)
                            throw new Error("Transfer amount must be positive");
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _a.sent();
                        entityId = uuid_1.v4();
                        return [4 /*yield*/, this.fraudDetectionService.checkForSuspiciousActivity(userId, amount, "TRANSFER", "WALLET_TRANSACTION", entityId)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var wallet, transactionData, createdTransaction, auditLogRequest;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, tx.wallet.findUnique({ where: { userId: userId } })];
                                                        case 1:
                                                            wallet = _a.sent();
                                                            if (!wallet || wallet.balance.lessThan(amount))
                                                                throw new Error("Insufficient wallet balance");
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { decrement: amount } }
                                                                })];
                                                        case 2:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 3:
                                                            _a.sent();
                                                            transactionData = {
                                                                id: uuid_1.v4(),
                                                                userId: userId,
                                                                walletId: wallet.id,
                                                                amount: new client_1.Prisma.Decimal(amount),
                                                                transactionType: client_1.TransactionType.DEDUCTION,
                                                                status: client_1.TransactionStatus.COMPLETED,
                                                                metadata: { purpose: "Transfer to Flutterwave for charges", webhookStatus: "PENDING" }
                                                            };
                                                            return [4 /*yield*/, tx.walletTransaction.create({ data: transactionData })];
                                                        case 4:
                                                            createdTransaction = _a.sent();
                                                            return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                    userId: userId,
                                                                    title: "Transfer Completed",
                                                                    message: "Transferred " + amount + " to Flutterwave for charges.",
                                                                    type: "TRANSFER"
                                                                })];
                                                        case 5:
                                                            _a.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "TRANSFER_COMPLETED",
                                                                details: { amount: amount, purpose: "Flutterwave charges" },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: createdTransaction.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 6:
                                                            _a.sent();
                                                            return [2 /*return*/, createdTransaction];
                                                    }
                                                });
                                            }); })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying transfer transaction", { userId: userId, attempt: attempt, error: error });
                                }
                            })];
                    case 3:
                        transaction = _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, transaction, "TRANSFER_" + transaction.status)];
                    case 4:
                        _a.sent();
                        logger_1.logger.info("Transferred to Flutterwave", { userId: userId, amount: amount });
                        return [2 /*return*/, transaction];
                    case 5:
                        error_13 = _a.sent();
                        errorMessage = error_13 instanceof Error ? error_13.message : "Unknown error";
                        logger_1.logger.error("Error transferring to Flutterwave", { error: errorMessage, userId: userId });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "TRANSFER_FAILED",
                                details: { error: errorMessage, amount: amount }
                            })];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: uuid_1.v4(), status: client_1.TransactionStatus.FAILED }, "TRANSFER_FAILED")];
                    case 7:
                        _a.sent();
                        throw new Error("Transfer to Flutterwave failed: " + errorMessage);
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.validateMeterNumber = function (meterNumber, providerId) {
        return __awaiter(this, void 0, Promise, function () {
            var provider, response, error_14, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 5]);
                        if (!meterNumber || !/^\d{8,12}$/.test(meterNumber)) {
                            throw new Error("Invalid meter number format. Must be 8-12 digits.");
                        }
                        if (!providerId || typeof providerId !== "number" || providerId <= 0)
                            throw new Error("Valid provider ID required");
                        return [4 /*yield*/, prisma.electricityProvider.findUnique({ where: { id: providerId } })];
                    case 1:
                        provider = _a.sent();
                        if (!provider)
                            throw new Error("Electricity provider not found");
                        return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/bill-items/validate", {
                                item_code: provider.prepaid_item_code || provider.postpaid_item_code || "",
                                code: provider.flutterwave_biller_code,
                                customer: meterNumber
                            }, { headers: { Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY } })];
                    case 2:
                        response = _a.sent();
                        if (response.data.status !== "success")
                            throw new Error("Meter validation failed: " + response.data.message);
                        logger_1.logger.info("Meter validation successful", { meterNumber: meterNumber, providerId: providerId });
                        return [2 /*return*/, { meterNumber: response.data.data.meterNumber, name: response.data.data.name }];
                    case 3:
                        error_14 = _a.sent();
                        errorMessage = error_14 instanceof Error ? error_14.message : "Unknown error";
                        logger_1.logger.error("Error validating meter number", { error: errorMessage, meterNumber: meterNumber, providerId: providerId });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: "SYSTEM",
                                action: "METER_VALIDATION_FAILED",
                                details: { error: errorMessage, meterNumber: meterNumber, providerId: providerId }
                            })];
                    case 4:
                        _a.sent();
                        throw new Error("Meter validation failed: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.getTransactions = function (userId, limit, offset) {
        if (limit === void 0) { limit = 50; }
        if (offset === void 0) { offset = 0; }
        return __awaiter(this, void 0, Promise, function () {
            var cacheKey_2, redis_6, cachedTransactions, redisError_4, transactions_1, redisError_5, auditLogRequest, error_15, errorMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 12, , 14]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _a.sent();
                        cacheKey_2 = "wallet_transactions:" + userId + ":" + limit + ":" + offset;
                        redis_6 = redis_1.getRedisClient();
                        cachedTransactions = null;
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                var result;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, redis_6.get(cacheKey_2)];
                                        case 1:
                                            result = _a.sent();
                                            if (result)
                                                metrics.cacheHits++;
                                            else
                                                metrics.cacheMisses++;
                                            return [2 /*return*/, result];
                                    }
                                });
                            }); })];
                    case 3:
                        cachedTransactions = _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        redisError_4 = _a.sent();
                        metrics.redisFailures++;
                        logger_1.logger.warn("Redis error during transaction retrieval, falling back to database", { userId: userId, error: redisError_4 });
                        return [3 /*break*/, 5];
                    case 5:
                        if (cachedTransactions) {
                            logger_1.logger.info("Transactions retrieved from cache", { userId: userId });
                            return [2 /*return*/, JSON.parse(cachedTransactions)];
                        }
                        return [4 /*yield*/, prisma.walletTransaction.findMany({
                                where: { userId: userId },
                                orderBy: { createdAt: "desc" },
                                take: limit,
                                skip: offset
                            })];
                    case 6:
                        transactions_1 = _a.sent();
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, redis_6.set(cacheKey_2, JSON.stringify(transactions_1), { EX: 600 })];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        redisError_5 = _a.sent();
                        metrics.redisFailures++;
                        logger_1.logger.warn("Failed to cache transactions, continuing with database data", { userId: userId, error: redisError_5 });
                        return [3 /*break*/, 10];
                    case 10:
                        logger_1.logger.info("Transactions retrieved from database", { userId: userId, transactionCount: transactions_1.length });
                        auditLogRequest = {
                            userId: userId,
                            action: "TRANSACTIONS_RETRIEVED",
                            details: { transactionCount: transactions_1.length },
                            entityType: "WALLET",
                            entityId: userId
                        };
                        return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                    case 11:
                        _a.sent();
                        return [2 /*return*/, transactions_1];
                    case 12:
                        error_15 = _a.sent();
                        errorMessage = error_15 instanceof Error ? error_15.message : "Unknown error";
                        logger_1.logger.error("Error fetching wallet transactions", { error: errorMessage, userId: userId });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "TRANSACTIONS_RETRIEVAL_FAILED",
                                details: { error: errorMessage }
                            })];
                    case 13:
                        _a.sent();
                        throw new Error("Failed to retrieve wallet transactions: " + errorMessage);
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.redeemVoucher = function (userId, voucherCode) {
        return __awaiter(this, void 0, Promise, function () {
            var redeemedVoucher_1, transaction, error_16, errorMessage;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 7]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!voucherCode || !/^[A-Z0-9-]+$/.test(voucherCode)) {
                            throw new Error("Invalid voucher code format");
                        }
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var rawVoucher, voucher, wallet, transactionData, createdTransaction, auditLogRequest;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, tx.voucher.findUnique({ where: { code: voucherCode } })];
                                                        case 1:
                                                            rawVoucher = _a.sent();
                                                            if (!rawVoucher ||
                                                                !rawVoucher.isActive ||
                                                                rawVoucher.validUntil < new Date() ||
                                                                rawVoucher.validFrom > new Date() ||
                                                                (rawVoucher.maxUses !== null && rawVoucher.uses >= rawVoucher.maxUses)) {
                                                                throw new Error("Invalid or expired voucher");
                                                            }
                                                            if (rawVoucher.appliesTo !== "WALLET")
                                                                throw new Error("Voucher not applicable to wallet");
                                                            voucher = __assign(__assign({}, rawVoucher), { appliesTo: rawVoucher.appliesTo });
                                                            redeemedVoucher_1 = voucher;
                                                            return [4 /*yield*/, tx.voucher.update({ where: { id: voucher.id }, data: { uses: { increment: 1 } } })];
                                                        case 2:
                                                            _a.sent();
                                                            return [4 /*yield*/, tx.wallet.findUnique({ where: { userId: userId } })];
                                                        case 3:
                                                            wallet = _a.sent();
                                                            if (!wallet)
                                                                throw new Error("Wallet not found");
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { increment: voucher.discount.toNumber() } }
                                                                })];
                                                        case 4:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 5:
                                                            _a.sent();
                                                            transactionData = {
                                                                id: uuid_1.v4(),
                                                                userId: userId,
                                                                walletId: wallet.id,
                                                                amount: new client_1.Prisma.Decimal(voucher.discount.toNumber()),
                                                                transactionType: client_1.TransactionType.DEPOSIT,
                                                                status: client_1.TransactionStatus.COMPLETED,
                                                                metadata: { voucherCode: voucherCode, discountType: voucher.type, webhookStatus: "PENDING" }
                                                            };
                                                            return [4 /*yield*/, tx.walletTransaction.create({ data: transactionData })];
                                                        case 6:
                                                            createdTransaction = _a.sent();
                                                            return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                    userId: userId,
                                                                    title: "Voucher Redeemed",
                                                                    message: "You have redeemed a voucher worth " + voucher.discount.toNumber() + " using code " + voucherCode + ".",
                                                                    type: "VOUCHER_REDEMPTION"
                                                                })];
                                                        case 7:
                                                            _a.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "VOUCHER_REDEEMED",
                                                                details: { voucherCode: voucherCode, amount: voucher.discount.toNumber() },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: createdTransaction.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 8:
                                                            _a.sent();
                                                            return [2 /*return*/, createdTransaction];
                                                    }
                                                });
                                            }); })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying voucher redemption", { userId: userId, attempt: attempt, error: error });
                                }
                            })];
                    case 2:
                        transaction = _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, transaction, "VOUCHER_REDEMPTION_" + transaction.status)];
                    case 3:
                        _a.sent();
                        if (redeemedVoucher_1) {
                            logger_1.logger.info("Voucher redeemed", { userId: userId, voucherCode: voucherCode, amount: redeemedVoucher_1.discount.toNumber() });
                        }
                        else {
                            logger_1.logger.warn("Voucher redeemed but voucher data unavailable for logging", { userId: userId, voucherCode: voucherCode });
                        }
                        return [2 /*return*/, transaction];
                    case 4:
                        error_16 = _a.sent();
                        errorMessage = error_16 instanceof Error ? error_16.message : "Unknown error";
                        logger_1.logger.error("Error redeeming voucher", { error: errorMessage, userId: userId, voucherCode: voucherCode });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "VOUCHER_REDEMPTION_FAILED",
                                details: { error: errorMessage, voucherCode: voucherCode }
                            })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: uuid_1.v4(), status: client_1.TransactionStatus.FAILED }, "VOUCHER_REDEMPTION_FAILED")];
                    case 6:
                        _a.sent();
                        throw new Error("Voucher redemption failed: " + errorMessage);
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.applyVoucher = function (userId, voucherCode, orderType, deliveryFee) {
        return __awaiter(this, void 0, Promise, function () {
            var rawVoucher, voucher, discountAmount, auditLogRequest, error_17, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 5]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!voucherCode || !/^[A-Z0-9-]+$/.test(voucherCode)) {
                            throw new Error("Invalid voucher code format");
                        }
                        if (!VALID_PRODUCT_TYPES.includes(orderType)) {
                            throw new Error("Valid orderType required (diesel, petrol, gas, electricity)");
                        }
                        return [4 /*yield*/, prisma.voucher.findUnique({ where: { code: voucherCode } })];
                    case 1:
                        rawVoucher = _a.sent();
                        if (!rawVoucher ||
                            !rawVoucher.isActive ||
                            rawVoucher.validUntil < new Date() ||
                            rawVoucher.validFrom > new Date() ||
                            (rawVoucher.maxUses !== null && rawVoucher.uses >= rawVoucher.maxUses)) {
                            throw new Error("Invalid or expired voucher");
                        }
                        if (rawVoucher.appliesTo !== "DELIVERY")
                            throw new Error("Voucher not applicable to delivery fees");
                        voucher = __assign(__assign({}, rawVoucher), { appliesTo: rawVoucher.appliesTo });
                        discountAmount = voucher.type === "PERCENTAGE" ? (voucher.discount.toNumber() / 100) * deliveryFee : voucher.discount.toNumber();
                        discountAmount = Math.min(discountAmount, deliveryFee);
                        auditLogRequest = {
                            userId: userId,
                            action: "VOUCHER_APPLIED",
                            details: { voucherCode: voucherCode, discountAmount: discountAmount, orderType: orderType }
                        };
                        return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                    case 2:
                        _a.sent();
                        logger_1.logger.info("Voucher applied", { userId: userId, voucherCode: voucherCode, discountAmount: discountAmount, orderType: orderType });
                        return [2 /*return*/, { discountAmount: discountAmount, voucher: voucher }];
                    case 3:
                        error_17 = _a.sent();
                        errorMessage = error_17 instanceof Error ? error_17.message : "Unknown error";
                        logger_1.logger.error("Error applying voucher", { error: errorMessage, userId: userId, voucherCode: voucherCode, orderType: orderType });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "VOUCHER_APPLICATION_FAILED",
                                details: { error: errorMessage, voucherCode: voucherCode, orderType: orderType }
                            })];
                    case 4:
                        _a.sent();
                        throw new Error("Failed to apply voucher: " + errorMessage);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.handleFlutterwaveCallback = function (callbackData, signature) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, Promise, function () {
            var data_1, tx_ref_2, status, amount_2, event_1, redis_7, idempotencyKey_1, processed, redisError_6, transactionStatus_1, userId, error_18, errorMessage, userId;
            var _this = this;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 7, , 10]);
                        if (!callbackData || typeof callbackData !== "object")
                            throw new Error("Invalid callback data");
                        if (!signature || typeof signature !== "string")
                            throw new Error("Invalid signature");
                        if (!this.verifyWebhookSignature(callbackData, signature)) {
                            throw new Error("Invalid Flutterwave signature");
                        }
                        data_1 = callbackData;
                        tx_ref_2 = data_1.tx_ref, status = data_1.status, amount_2 = data_1.amount, event_1 = data_1.event;
                        if (!tx_ref_2 || !status || !amount_2)
                            throw new Error("Missing required callback fields");
                        redis_7 = redis_1.getRedisClient();
                        idempotencyKey_1 = "webhook:" + tx_ref_2;
                        processed = false;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                var result;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, redis_7.get(idempotencyKey_1)];
                                        case 1:
                                            result = _a.sent();
                                            return [2 /*return*/, !!result];
                                    }
                                });
                            }); })];
                    case 2:
                        processed = _f.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        redisError_6 = _f.sent();
                        metrics.redisFailures++;
                        logger_1.logger.warn("Redis error during idempotency check, proceeding cautiously", { tx_ref: tx_ref_2, error: redisError_6 });
                        return [3 /*break*/, 4];
                    case 4:
                        if (processed) {
                            logger_1.logger.warn("Duplicate webhook callback ignored", { tx_ref: tx_ref_2 });
                            return [2 /*return*/];
                        }
                        if (status === "successful") {
                            transactionStatus_1 = client_1.TransactionStatus.COMPLETED;
                        }
                        else if (status === "pending") {
                            transactionStatus_1 = client_1.TransactionStatus.PENDING;
                        }
                        else {
                            transactionStatus_1 = client_1.TransactionStatus.FAILED;
                        }
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var walletTx, userId, metadata, baseAmount, updatedMetadata, redisError_7, topupCharge, vatAmount, totalAmount, auditLogRequest;
                                                var _this = this;
                                                var _a;
                                                return __generator(this, function (_b) {
                                                    switch (_b.label) {
                                                        case 0: return [4 /*yield*/, tx.walletTransaction.findFirst({
                                                                where: { payment: { transactionRef: tx_ref_2 } },
                                                                include: { payment: true }
                                                            })];
                                                        case 1:
                                                            walletTx = _b.sent();
                                                            if (!walletTx || !walletTx.payment)
                                                                throw new Error("No transaction found for tx_ref: " + tx_ref_2);
                                                            userId = walletTx.userId || ((_a = data_1.customer) === null || _a === void 0 ? void 0 : _a.id);
                                                            metadata = walletTx.metadata && typeof walletTx.metadata === "object"
                                                                ? walletTx.metadata
                                                                : {};
                                                            if (!(transactionStatus_1 === client_1.TransactionStatus.COMPLETED && userId)) return [3 /*break*/, 4];
                                                            baseAmount = walletTx.amount.toNumber();
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { increment: baseAmount } }
                                                                })];
                                                        case 2:
                                                            _b.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 3:
                                                            _b.sent();
                                                            _b.label = 4;
                                                        case 4:
                                                            updatedMetadata = __assign(__assign({}, metadata), { webhookStatus: transactionStatus_1 === client_1.TransactionStatus.COMPLETED ? "SENT" : transactionStatus_1 });
                                                            return [4 /*yield*/, tx.walletTransaction.update({
                                                                    where: { id: walletTx.id },
                                                                    data: { status: transactionStatus_1, metadata: updatedMetadata }
                                                                })];
                                                        case 5:
                                                            _b.sent();
                                                            return [4 /*yield*/, tx.payment.update({
                                                                    where: { id: walletTx.payment.id },
                                                                    data: { status: transactionStatus_1 === client_1.TransactionStatus.COMPLETED ? "completed" : transactionStatus_1.toLowerCase() }
                                                                })];
                                                        case 6:
                                                            _b.sent();
                                                            _b.label = 7;
                                                        case 7:
                                                            _b.trys.push([7, 9, , 10]);
                                                            return [4 /*yield*/, redisCircuitBreaker.fire(function () { return __awaiter(_this, void 0, void 0, function () {
                                                                    return __generator(this, function (_a) {
                                                                        switch (_a.label) {
                                                                            case 0: return [4 /*yield*/, redis_7.set(idempotencyKey_1, "processed", { EX: 24 * 60 * 60 })];
                                                                            case 1:
                                                                                _a.sent();
                                                                                return [2 /*return*/];
                                                                        }
                                                                    });
                                                                }); })];
                                                        case 8:
                                                            _b.sent();
                                                            return [3 /*break*/, 10];
                                                        case 9:
                                                            redisError_7 = _b.sent();
                                                            metrics.redisFailures++;
                                                            logger_1.logger.warn("Failed to set idempotency key, continuing", { tx_ref: tx_ref_2, error: redisError_7 });
                                                            return [3 /*break*/, 10];
                                                        case 10:
                                                            if (!userId) return [3 /*break*/, 13];
                                                            topupCharge = typeof metadata === "object" && "topupCharge" in metadata && typeof metadata.topupCharge === "number"
                                                                ? metadata.topupCharge
                                                                : 0;
                                                            vatAmount = typeof metadata === "object" && "vatAmount" in metadata && typeof metadata.vatAmount === "number"
                                                                ? metadata.vatAmount
                                                                : 0;
                                                            totalAmount = typeof metadata === "object" && "totalAmount" in metadata && typeof metadata.totalAmount === "number"
                                                                ? metadata.totalAmount
                                                                : amount_2;
                                                            return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                    userId: userId,
                                                                    title: "Transaction " + transactionStatus_1,
                                                                    message: "Your top-up transaction " + tx_ref_2 + " for " + walletTx.amount.toNumber() + " is " + transactionStatus_1.toLowerCase() + ". Total charged: " + totalAmount + ".",
                                                                    type: "WEBHOOK",
                                                                    metadata: { topupCharge: topupCharge, vatAmount: vatAmount, totalAmount: totalAmount }
                                                                })];
                                                        case 11:
                                                            _b.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "WEBHOOK_" + transactionStatus_1,
                                                                details: {
                                                                    tx_ref: tx_ref_2,
                                                                    baseAmount: walletTx.amount.toNumber(),
                                                                    topupCharge: topupCharge,
                                                                    vatAmount: vatAmount,
                                                                    totalAmount: totalAmount,
                                                                    event: event_1,
                                                                    status: transactionStatus_1
                                                                },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: walletTx.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 12:
                                                            _b.sent();
                                                            _b.label = 13;
                                                        case 13: return [2 /*return*/];
                                                    }
                                                });
                                            }); })];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying callback transaction", { tx_ref: tx_ref_2, attempt: attempt, error: error });
                                }
                            })];
                    case 5:
                        _f.sent();
                        userId = ((_a = data_1.customer) === null || _a === void 0 ? void 0 : _a.id) || null;
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: tx_ref_2, status: transactionStatus_1 }, "WEBHOOK_" + transactionStatus_1)];
                    case 6:
                        _f.sent();
                        logger_1.logger.info("Flutterwave callback processed", { tx_ref: tx_ref_2, amount: amount_2, status: transactionStatus_1 });
                        return [3 /*break*/, 10];
                    case 7:
                        error_18 = _f.sent();
                        errorMessage = error_18 instanceof Error ? error_18.message : "Unknown error";
                        logger_1.logger.error("Error processing Flutterwave callback", { error: errorMessage, callbackData: callbackData });
                        userId = ((_c = (_b = callbackData) === null || _b === void 0 ? void 0 : _b.customer) === null || _c === void 0 ? void 0 : _c.id) || null;
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "WEBHOOK_FAILED",
                                details: { error: errorMessage, callbackData: callbackData },
                                entityType: "WEBHOOK",
                                entityId: ((_d = callbackData) === null || _d === void 0 ? void 0 : _d.tx_ref) || uuid_1.v4()
                            })];
                    case 8:
                        _f.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: ((_e = callbackData) === null || _e === void 0 ? void 0 : _e.tx_ref) || uuid_1.v4(), status: client_1.TransactionStatus.FAILED }, "WEBHOOK_FAILED")];
                    case 9:
                        _f.sent();
                        throw new Error("Failed to process callback: " + errorMessage);
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.processBillPayment = function (userId, amount, meterNumber, providerId) {
        return __awaiter(this, void 0, Promise, function () {
            var entityId_1, provider_1, _a, transaction, billResponse, error_19, errorMessage;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 9]);
                        if (!userId || typeof userId !== "string")
                            throw new Error("Invalid user ID format");
                        if (!amount || typeof amount !== "number" || amount <= 0)
                            throw new Error("Bill payment amount must be positive");
                        if (!meterNumber || !/^\d{8,12}$/.test(meterNumber))
                            throw new Error("Invalid meter number format");
                        if (!providerId || typeof providerId !== "number" || providerId <= 0)
                            throw new Error("Valid provider ID required");
                        return [4 /*yield*/, walletUtils_1.ensureWalletExists(userId)];
                    case 1:
                        _b.sent();
                        entityId_1 = uuid_1.v4();
                        return [4 /*yield*/, this.fraudDetectionService.checkForSuspiciousActivity(userId, amount, "BILL_PAYMENT", "ELECTRICITY_ORDER", entityId_1)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, prisma.electricityProvider.findUnique({ where: { id: providerId } })];
                    case 3:
                        provider_1 = _b.sent();
                        if (!provider_1)
                            throw new Error("Electricity provider not found");
                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                var wallet, transactionData, createdTransaction, billResponse, transactionStatus, metadata, auditLogRequest;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, tx.wallet.findUnique({ where: { userId: userId } })];
                                                        case 1:
                                                            wallet = _a.sent();
                                                            if (!wallet || !wallet.balance.greaterThanOrEqualTo(amount))
                                                                throw new Error("Insufficient wallet balance");
                                                            return [4 /*yield*/, tx.wallet.update({
                                                                    where: { userId: userId },
                                                                    data: { balance: { decrement: amount } }
                                                                })];
                                                        case 2:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.invalidateBalanceCache(userId)];
                                                        case 3:
                                                            _a.sent();
                                                            transactionData = {
                                                                id: uuid_1.v4(),
                                                                userId: userId,
                                                                walletId: wallet.id,
                                                                amount: new client_1.Prisma.Decimal(amount),
                                                                transactionType: client_1.TransactionType.DEDUCTION,
                                                                status: client_1.TransactionStatus.PENDING,
                                                                electricityOrderId: entityId_1,
                                                                electricityProviderId: providerId,
                                                                metadata: { webhookStatus: "PENDING" }
                                                            };
                                                            return [4 /*yield*/, tx.walletTransaction.create({ data: transactionData })];
                                                        case 4:
                                                            createdTransaction = _a.sent();
                                                            return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/bills", {
                                                                    country: "NG",
                                                                    customer: meterNumber,
                                                                    amount: amount,
                                                                    type: provider_1.prepaid_item_code ? "PREPAID" : "POSTPAID",
                                                                    reference: "BILL-" + createdTransaction.id + "-" + Date.now()
                                                                }, { headers: { Authorization: "Bearer " + process.env.FLUTTERWAVE_TOKEN } })];
                                                        case 5:
                                                            billResponse = _a.sent();
                                                            if (billResponse.data.status === "success") {
                                                                transactionStatus = client_1.TransactionStatus.COMPLETED;
                                                            }
                                                            else if (billResponse.data.status === "failed") {
                                                                transactionStatus = client_1.TransactionStatus.FAILED;
                                                            }
                                                            else {
                                                                transactionStatus = client_1.TransactionStatus.PENDING;
                                                            }
                                                            metadata = createdTransaction.metadata && typeof createdTransaction.metadata === "object"
                                                                ? __assign(__assign({}, createdTransaction.metadata), { billReference: billResponse.data.data.tx_ref, token: billResponse.data.data.token || null, webhookStatus: transactionStatus === client_1.TransactionStatus.COMPLETED ? "SENT" : transactionStatus }) : { billReference: billResponse.data.data.tx_ref, token: billResponse.data.data.token || null, webhookStatus: transactionStatus === client_1.TransactionStatus.COMPLETED ? "SENT" : transactionStatus };
                                                            return [4 /*yield*/, tx.walletTransaction.update({
                                                                    where: { id: createdTransaction.id },
                                                                    data: { status: transactionStatus, metadata: metadata }
                                                                })];
                                                        case 6:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.notificationService.sendTransactionNotification({
                                                                    userId: userId,
                                                                    title: "Bill Payment " + transactionStatus,
                                                                    message: "Your bill payment of " + amount + " for meter " + meterNumber + " is " + transactionStatus.toLowerCase() + ".",
                                                                    type: "BILL_PAYMENT"
                                                                })];
                                                        case 7:
                                                            _a.sent();
                                                            auditLogRequest = {
                                                                userId: userId,
                                                                action: "BILL_PAYMENT_" + transactionStatus,
                                                                details: { amount: amount, meterNumber: meterNumber, providerId: providerId, status: transactionStatus },
                                                                entityType: "WALLET_TRANSACTION",
                                                                entityId: createdTransaction.id
                                                            };
                                                            return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                                                        case 8:
                                                            _a.sent();
                                                            return [2 /*return*/, { transaction: createdTransaction, billResponse: billResponse.data }];
                                                    }
                                                });
                                            }); })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, {
                                retries: 3,
                                factor: 2,
                                minTimeout: 1000,
                                maxTimeout: 5000,
                                onRetry: function (error, attempt) {
                                    logger_1.logger.warn("Retrying bill payment", { userId: userId, attempt: attempt, error: error });
                                }
                            })];
                    case 4:
                        _a = _b.sent(), transaction = _a.transaction, billResponse = _a.billResponse;
                        return [4 /*yield*/, this.triggerWebhook(userId, transaction, "BILL_PAYMENT_" + transaction.status)];
                    case 5:
                        _b.sent();
                        logger_1.logger.info("Bill payment processed", { userId: userId, meterNumber: meterNumber, amount: amount, status: transaction.status });
                        return [2 /*return*/, { transaction: transaction, billResponse: billResponse }];
                    case 6:
                        error_19 = _b.sent();
                        errorMessage = error_19 instanceof Error ? error_19.message : "Unknown error";
                        logger_1.logger.error("Error processing bill payment", { error: errorMessage, userId: userId, meterNumber: meterNumber });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: userId,
                                action: "BILL_PAYMENT_FAILED",
                                details: { error: errorMessage, amount: amount, meterNumber: meterNumber },
                                entityType: "WALLET_TRANSACTION",
                                entityId: null
                            })];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, this.triggerWebhook(userId, { id: uuid_1.v4(), status: client_1.TransactionStatus.FAILED }, "BILL_PAYMENT_FAILED")];
                    case 8:
                        _b.sent();
                        throw new Error("Bill payment failed: " + errorMessage);
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.triggerWebhook = function (userId, transaction, eventType) {
        var _a, _b;
        return __awaiter(this, void 0, Promise, function () {
            var internalWebhookUrl, flutterwaveWebhookUrl, webhookUrls, resolvedUserId, payment, error_20, errorMessage, baseAmount, walletTx, payload, _loop_2, this_2, _i, webhookUrls_1, webhookUrl;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        internalWebhookUrl = process.env.INTERNAL_WEBHOOK_URL || "http://localhost:5000/internal/webhook";
                        flutterwaveWebhookUrl = process.env.FLUTTERWAVE_WEBHOOK_URL || "http://localhost:5000/flutterwave/webhook";
                        webhookUrls = [];
                        if (eventType === "TOPUP_PENDING") {
                            webhookUrls = [internalWebhookUrl];
                        }
                        else if (eventType.startsWith("WEBHOOK_") || eventType.includes("FLUTTERWAVE") || eventType.includes("TOPUP")) {
                            webhookUrls = [flutterwaveWebhookUrl];
                        }
                        else {
                            webhookUrls = (((_a = process.env.WEBHOOK_URLS) === null || _a === void 0 ? void 0 : _a.split(",")) || [internalWebhookUrl]).map(function (url) { return url.trim(); });
                        }
                        if (!webhookUrls.length) {
                            logger_1.logger.warn("No webhook URLs configured", { eventType: eventType });
                            return [2 /*return*/];
                        }
                        resolvedUserId = userId || transaction.userId || null;
                        if (!(!resolvedUserId && typeof transaction.id === "string")) return [3 /*break*/, 4];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, prisma.payment.findFirst({
                                where: { transactionRef: transaction.id.toString() },
                                select: { userId: true }
                            })];
                    case 2:
                        payment = _c.sent();
                        resolvedUserId = (payment === null || payment === void 0 ? void 0 : payment.userId) || null;
                        if (!resolvedUserId) {
                            logger_1.logger.warn("Could not resolve userId for webhook", { eventType: eventType, transactionId: transaction.id });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_20 = _c.sent();
                        errorMessage = error_20 instanceof Error ? error_20.message : String(error_20);
                        logger_1.logger.error("Error fetching userId from payment", { eventType: eventType, transactionId: transaction.id, error: errorMessage });
                        return [3 /*break*/, 4];
                    case 4:
                        if (!(typeof transaction.id === "string")) return [3 /*break*/, 6];
                        return [4 /*yield*/, prisma.walletTransaction.findUnique({
                                where: { id: transaction.id },
                                select: { amount: true }
                            })];
                    case 5:
                        walletTx = _c.sent();
                        baseAmount = walletTx === null || walletTx === void 0 ? void 0 : walletTx.amount.toNumber();
                        _c.label = 6;
                    case 6:
                        payload = {
                            event: eventType,
                            transactionId: transaction.id.toString(),
                            userId: resolvedUserId,
                            amount: baseAmount || (typeof transaction.amount === "object" ? (_b = transaction.amount) === null || _b === void 0 ? void 0 : _b.toNumber() : transaction.amount),
                            status: transaction.status,
                            createdAt: transaction.createdAt || new Date().toISOString(),
                            metadata: transaction.metadata,
                            timestamp: new Date().toISOString()
                        };
                        _loop_2 = function (webhookUrl) {
                            var attemptId, error_21, errorMessage;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        attemptId = uuid_1.v4();
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 9]);
                                        return [4 /*yield*/, async_retry_1["default"](function () { return __awaiter(_this, void 0, void 0, function () {
                                                var response;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, axios_1["default"].post(webhookUrl, payload, {
                                                                headers: {
                                                                    "Content-Type": "application/json",
                                                                    "X-Webhook-Signature": this.generateWebhookSignature(payload),
                                                                    "X-Webhook-Attempt-Id": attemptId
                                                                },
                                                                timeout: 15000
                                                            })];
                                                        case 1:
                                                            response = _a.sent();
                                                            if (!(response.status >= 200 && response.status < 300)) return [3 /*break*/, 4];
                                                            logger_1.logger.info("Webhook triggered successfully", { eventType: eventType, transactionId: transaction.id, webhookUrl: webhookUrl, baseAmount: baseAmount });
                                                            return [4 /*yield*/, prisma.walletTransaction.update({
                                                                    where: { id: transaction.id.toString() },
                                                                    data: {
                                                                        metadata: transaction.metadata && typeof transaction.metadata === "object"
                                                                            ? __assign(__assign({}, transaction.metadata), { webhookStatus: "SENT" }) : { webhookStatus: "SENT" }
                                                                    }
                                                                })];
                                                        case 2:
                                                            _a.sent();
                                                            return [4 /*yield*/, this.updateWebhookAttemptStatus(attemptId, "SUCCESS")];
                                                        case 3:
                                                            _a.sent();
                                                            metrics.webhookSuccess++;
                                                            return [3 /*break*/, 5];
                                                        case 4: throw new Error("Webhook failed with status " + response.status);
                                                        case 5: return [2 /*return*/];
                                                    }
                                                });
                                            }); }, {
                                                retries: 2,
                                                factor: 2,
                                                minTimeout: 1000 + Math.random() * 100,
                                                maxTimeout: 30000,
                                                onRetry: function (error, attempt) {
                                                    logger_1.logger.warn("Retrying webhook trigger", {
                                                        eventType: eventType,
                                                        transactionId: transaction.id,
                                                        webhookUrl: webhookUrl,
                                                        attempt: attempt,
                                                        error: error
                                                    });
                                                    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" && error.message.includes("Unknown event type")) {
                                                        throw new Error("Unresolvable webhook error, aborting retries");
                                                    }
                                                }
                                            })];
                                    case 2:
                                        _a.sent();
                                        return [3 /*break*/, 9];
                                    case 3:
                                        error_21 = _a.sent();
                                        metrics.webhookFailures++;
                                        errorMessage = error_21 instanceof Error ? error_21.message : String(error_21);
                                        logger_1.logger.error("Webhook trigger failed", { error: errorMessage, eventType: eventType, transactionId: transaction.id, webhookUrl: webhookUrl });
                                        return [4 /*yield*/, this_2.queueWebhookRetry(webhookUrl, payload, transaction.id.toString(), eventType)];
                                    case 4:
                                        _a.sent();
                                        if (!resolvedUserId) return [3 /*break*/, 7];
                                        return [4 /*yield*/, this_2.auditLogService.log({
                                                userId: resolvedUserId,
                                                action: "WEBHOOK_FAILED",
                                                details: { error: errorMessage, eventType: eventType, transactionId: transaction.id, webhookUrl: webhookUrl },
                                                entityType: "WEBHOOK",
                                                entityId: null
                                            })];
                                    case 5:
                                        _a.sent();
                                        return [4 /*yield*/, this_2.notificationService.sendWebhookFailureNotification({
                                                userId: resolvedUserId,
                                                transactionId: transaction.id.toString(),
                                                webhookUrl: webhookUrl,
                                                error: errorMessage
                                            })];
                                    case 6:
                                        _a.sent();
                                        _a.label = 7;
                                    case 7: return [4 /*yield*/, this_2.updateWebhookAttemptStatus(attemptId, "FAILED")];
                                    case 8:
                                        _a.sent();
                                        return [3 /*break*/, 9];
                                    case 9: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _i = 0, webhookUrls_1 = webhookUrls;
                        _c.label = 7;
                    case 7:
                        if (!(_i < webhookUrls_1.length)) return [3 /*break*/, 10];
                        webhookUrl = webhookUrls_1[_i];
                        return [5 /*yield**/, _loop_2(webhookUrl)];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9:
                        _i++;
                        return [3 /*break*/, 7];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    WalletService.prototype.generateWebhookSignature = function (payload) {
        var secret = process.env.WEBHOOK_SECRET || "secret";
        return crypto_1.createHmac("sha256", secret)
            .update(JSON.stringify(payload))
            .digest("hex");
    };
    WalletService.prototype.reconcileTransaction = function (transactionRef) {
        return __awaiter(this, void 0, Promise, function () {
            var response, auditLogRequest, error_22, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 10]);
                        return [4 /*yield*/, axios_1["default"].get("https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=" + transactionRef, { headers: { Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY } })];
                    case 1:
                        response = _a.sent();
                        if (!(response.data.status === "success" && response.data.data.status === "successful")) return [3 /*break*/, 4];
                        auditLogRequest = {
                            userId: "SYSTEM",
                            action: "TRANSACTION_RECONCILED",
                            details: { transactionRef: transactionRef, status: client_1.TransactionStatus.COMPLETED }
                        };
                        return [4 /*yield*/, this.auditLogService.log(auditLogRequest)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(null, { id: transactionRef, status: client_1.TransactionStatus.COMPLETED }, "RECONCILIATION_COMPLETED")];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, client_1.TransactionStatus.COMPLETED];
                    case 4: return [4 /*yield*/, this.triggerWebhook(null, { id: transactionRef, status: client_1.TransactionStatus.FAILED }, "RECONCILIATION_FAILED")];
                    case 5:
                        _a.sent();
                        return [2 /*return*/, client_1.TransactionStatus.FAILED];
                    case 6: return [3 /*break*/, 10];
                    case 7:
                        error_22 = _a.sent();
                        errorMessage = error_22 instanceof Error ? error_22.message : "Unknown error";
                        logger_1.logger.error("Error reconciling transaction", { error: errorMessage, transactionRef: transactionRef });
                        return [4 /*yield*/, this.auditLogService.log({
                                userId: "SYSTEM",
                                action: "TRANSACTION_RECONCILIATION_FAILED",
                                details: { error: errorMessage, transactionRef: transactionRef }
                            })];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, this.triggerWebhook(null, { id: transactionRef, status: client_1.TransactionStatus.FAILED }, "RECONCILIATION_FAILED")];
                    case 9:
                        _a.sent();
                        return [2 /*return*/, client_1.TransactionStatus.PENDING];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    // New method to expose metrics for monitoring
    WalletService.prototype.getMetrics = function () {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, metrics];
            });
        });
    };
    return WalletService;
}());
exports.WalletService = WalletService;
exports["default"] = new WalletService();
