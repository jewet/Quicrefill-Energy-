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
exports.CrashReportService = void 0;
var Sentry = require("@sentry/node");
var logger_1 = require("../utils/logger");
var client_1 = require("@prisma/client");
var CrashReportService = /** @class */ (function () {
    function CrashReportService(prisma) {
        this.prisma = prisma;
    }
    CrashReportService.prototype.reportCrash = function (error, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, deviceId, appVersion, deviceType, osVersion, appType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        userId = metadata.userId, deviceId = metadata.deviceId, appVersion = metadata.appVersion, deviceType = metadata.deviceType, osVersion = metadata.osVersion, appType = metadata.appType;
                        // Send to Sentry
                        Sentry.withScope(function (scope) {
                            scope.setUser({ id: userId });
                            scope.setTag('appType', appType);
                            scope.setContext('device', { deviceId: deviceId, deviceType: deviceType, osVersion: osVersion, appVersion: appVersion });
                            Sentry.captureException(error);
                        });
                        // Persist to CrashReport model
                        return [4 /*yield*/, this.prisma.crashReport.create({
                                data: {
                                    appVersion: appVersion,
                                    deviceType: deviceType,
                                    deviceModel: osVersion,
                                    osVersion: osVersion,
                                    errorMessage: error.message,
                                    stackTrace: error.stack || 'No stack trace',
                                    userId: userId,
                                    deviceId: deviceId,
                                    status: client_1.CrashStatus.PENDING,
                                    metadata: { appType: appType }
                                }
                            })];
                    case 1:
                        // Persist to CrashReport model
                        _a.sent();
                        logger_1["default"].error("Crash reported: " + error.message, { stack: error.stack, appType: appType });
                        return [2 /*return*/];
                }
            });
        });
    };
    CrashReportService.prototype.reportANR = function (transactionName, durationMs, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(durationMs > 5000)) return [3 /*break*/, 2];
                        // Threshold for ANR (5 seconds)
                        Sentry.captureMessage("ANR detected: " + transactionName + " took " + durationMs + "ms", {
                            level: 'warning',
                            tags: { appType: metadata.appType },
                            extra: __assign({ durationMs: durationMs }, metadata)
                        });
                        return [4 /*yield*/, this.prisma.crashReport.create({
                                data: {
                                    appVersion: metadata.appVersion,
                                    deviceType: metadata.appType,
                                    deviceId: metadata.deviceId,
                                    userId: metadata.userId,
                                    errorMessage: "ANR: " + transactionName + " took " + durationMs + "ms",
                                    stackTrace: 'No stack trace for ANR',
                                    status: client_1.CrashStatus.PENDING,
                                    metadata: { transactionName: transactionName, durationMs: durationMs, appType: metadata.appType }
                                }
                            })];
                    case 1:
                        _a.sent();
                        logger_1["default"].warn("ANR reported: " + transactionName + " took " + durationMs + "ms", { appType: metadata.appType });
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    CrashReportService.prototype.getCoreVitalsMetrics = function (appType) {
        return __awaiter(this, void 0, Promise, function () {
            var now, past28Days, previous28Days, totalSessions, crashCount, crashRate, anrCount, anrRate, prevCrashCount, prevCrashRate, prevAnrCount, prevAnrRate, affectedSessionsAll, affectedSessionsAndroid10Plus;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date();
                        past28Days = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
                        previous28Days = new Date(past28Days.getTime() - 28 * 24 * 60 * 60 * 1000);
                        return [4 /*yield*/, this.prisma.appInstallation.count({
                                where: { createdAt: { gte: past28Days } }
                            })];
                    case 1:
                        totalSessions = _a.sent();
                        return [4 /*yield*/, this.prisma.crashReport.count({
                                where: __assign({ reportedAt: { gte: past28Days }, errorMessage: { not: { contains: 'ANR' } } }, (appType ? { metadata: { path: ['appType'], equals: appType } } : {}))
                            })];
                    case 2:
                        crashCount = _a.sent();
                        crashRate = totalSessions > 0 ? (crashCount / totalSessions) * 100 : 0;
                        return [4 /*yield*/, this.prisma.crashReport.count({
                                where: __assign({ reportedAt: { gte: past28Days }, errorMessage: { contains: 'ANR' } }, (appType ? { metadata: { path: ['appType'], equals: appType } } : {}))
                            })];
                    case 3:
                        anrCount = _a.sent();
                        anrRate = totalSessions > 0 ? (anrCount / totalSessions) * 100 : 0;
                        return [4 /*yield*/, this.prisma.crashReport.count({
                                where: __assign({ reportedAt: { gte: previous28Days, lte: past28Days }, errorMessage: { not: { contains: 'ANR' } } }, (appType ? { metadata: { path: ['appType'], equals: appType } } : {}))
                            })];
                    case 4:
                        prevCrashCount = _a.sent();
                        prevCrashRate = totalSessions > 0 ? (prevCrashCount / totalSessions) * 100 : 0;
                        return [4 /*yield*/, this.prisma.crashReport.count({
                                where: __assign({ reportedAt: { gte: previous28Days, lte: past28Days }, errorMessage: { contains: 'ANR' } }, (appType ? { metadata: { path: ['appType'], equals: appType } } : {}))
                            })];
                    case 5:
                        prevAnrCount = _a.sent();
                        prevAnrRate = totalSessions > 0 ? (prevAnrCount / totalSessions) * 100 : 0;
                        return [4 /*yield*/, this.prisma.crashReport.count({
                                where: { reportedAt: { gte: past28Days } }
                            })];
                    case 6:
                        affectedSessionsAll = _a.sent();
                        return [4 /*yield*/, this.prisma.crashReport.count({
                                where: {
                                    reportedAt: { gte: past28Days },
                                    osVersion: { gte: '10' }
                                }
                            })];
                    case 7:
                        affectedSessionsAndroid10Plus = _a.sent();
                        return [2 /*return*/, {
                                userPerceivedCrashRate: {
                                    value: crashRate.toFixed(2) + '%',
                                    change: (crashRate - prevCrashRate).toFixed(2) + '%'
                                },
                                userPerceivedAnrRate: {
                                    value: anrRate.toFixed(2) + '%',
                                    change: (anrRate - prevAnrRate).toFixed(2) + '%'
                                },
                                affectedSessions: {
                                    allVersions: affectedSessionsAll,
                                    android10Plus: affectedSessionsAndroid10Plus
                                },
                                affectedAreas: {
                                    crashCount: crashCount,
                                    anrCount: anrCount
                                },
                                badBehaviorThreshold: {
                                    anrThresholdMs: 5000
                                }
                            }];
                }
            });
        });
    };
    return CrashReportService;
}());
exports.CrashReportService = CrashReportService;
