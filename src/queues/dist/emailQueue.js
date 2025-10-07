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
exports.addEmailJob = void 0;
var bull_1 = require("bull");
var email_1 = require("../services/email");
var logger_1 = require("../utils/logger");
var redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined
};
var emailQueue = new bull_1["default"]("email-queue", {
    redis: redisConfig
});
emailQueue.process(function (job) { return __awaiter(void 0, void 0, void 0, function () {
    var error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: job.data.eventType,
                        customPayload: {
                            to: job.data.customPayload.to,
                            from: job.data.customPayload.from,
                            subject: job.data.customPayload.subject,
                            htmlContent: job.data.customPayload.htmlContent
                        },
                        metadata: job.data.metadata
                    })];
            case 1:
                _a.sent();
                logger_1.logger.info("Email processed successfully", {
                    eventType: job.data.eventType,
                    email: job.data.customPayload.to,
                    from: job.data.customPayload.from
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                logger_1.logger.error("Failed to process email job", {
                    error: error_1 instanceof Error ? error_1.message : String(error_1),
                    data: job.data
                });
                throw error_1; // Let Bull handle retries
            case 3: return [2 /*return*/];
        }
    });
}); });
emailQueue.on("error", function (error) {
    logger_1.logger.error("Email queue error", {
        error: error.message,
        stack: error.stack
    });
});
function addEmailJob(data) {
    return __awaiter(this, void 0, Promise, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, emailQueue.add(data, {
                            attempts: 3,
                            backoff: { type: "exponential", delay: 1000 }
                        })];
                case 1:
                    _a.sent();
                    logger_1.logger.info("Email job added to queue", {
                        eventType: data.eventType,
                        email: data.customPayload.to,
                        from: data.customPayload.from
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    logger_1.logger.error("Failed to add email job", {
                        error: error_2 instanceof Error ? error_2.message : String(error_2),
                        data: data
                    });
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.addEmailJob = addEmailJob;
