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
exports.OtpController = void 0;
var otp_service_1 = require("../../services/otp.service");
var http_util_1 = require("../../utils/http.util");
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
var OtpController = /** @class */ (function () {
    function OtpController() {
    }
    OtpController.createOtp = function (req, res) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var userId, _c, phoneNumber, email, medium, otpVerification, error_1, message, statusCode;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        userId = req.userId;
                        _c = req.body, phoneNumber = _c.phoneNumber, email = _c.email, medium = _c.medium;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        logger.info("createOtp Request", {
                            userId: userId,
                            phoneNumber: phoneNumber,
                            email: email,
                            medium: medium,
                            token: ((_b = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1]) === null || _b === void 0 ? void 0 : _b.slice(0, 20)) + "..."
                        });
                        if (!userId) {
                            http_util_1.HttpResponse.error(res, "User not authenticated", 401);
                            return [2 /*return*/];
                        }
                        if (!phoneNumber && !email) {
                            http_util_1.HttpResponse.error(res, "Phone number or email is required", 400);
                            return [2 /*return*/];
                        }
                        if (phoneNumber && !phoneNumber.match(/^(\+?\d{10,15})$/)) {
                            logger.error("Invalid phone number format", { phoneNumber: phoneNumber });
                            http_util_1.HttpResponse.error(res, "Phone number must be 10-15 digits, with or without + prefix (e.g., +2349069284815 or 2349069284815)", 400);
                            return [2 /*return*/];
                        }
                        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                            logger.error("Invalid email format", { email: email });
                            http_util_1.HttpResponse.error(res, "Invalid email format", 400);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, otp_service_1.OtpService.createOtp(userId, {
                                phoneNumber: phoneNumber || "",
                                email: email || "",
                                medium: medium || ["sms"]
                            })];
                    case 2:
                        otpVerification = _d.sent();
                        http_util_1.HttpResponse.success(res, {
                            transactionReference: otpVerification.transactionReference,
                            expiresAt: otpVerification.expiresAt
                        }, "OTP sent successfully", 201);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _d.sent();
                        message = error_1 instanceof Error ? error_1.message : "Failed to send OTP";
                        logger.error("createOtp Controller Error", {
                            message: message,
                            stack: error_1 instanceof Error ? error_1.stack : undefined,
                            userId: userId,
                            phoneNumber: phoneNumber,
                            email: email,
                            medium: medium
                        });
                        statusCode = 500;
                        if (message.includes("User not found") || message.includes("email and name")) {
                            statusCode = 404;
                        }
                        else if (message.includes("Invalid phone number") ||
                            message.includes("Invalid email") ||
                            message.includes("Medium must be")) {
                            statusCode = 400;
                        }
                        http_util_1.HttpResponse.error(res, message, statusCode);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    OtpController.validateOtp = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, transactionReference, otp, otpVerification, error_2, message, statusCode;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = req.body, transactionReference = _a.transactionReference, otp = _a.otp;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        logger.info("validateOtp Request", { transactionReference: transactionReference });
                        if (!transactionReference || typeof transactionReference !== "string" || transactionReference.trim() === "") {
                            http_util_1.HttpResponse.error(res, "Valid transaction reference is required", 400);
                            return [2 /*return*/];
                        }
                        if (!otp || typeof otp !== "string" || otp.trim() === "" || !/^\d{7}$/.test(otp)) {
                            http_util_1.HttpResponse.error(res, "Valid 7-digit OTP is required", 400);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, otp_service_1.OtpService.validateOtp({ transactionReference: transactionReference, otp: otp })];
                    case 2:
                        otpVerification = _b.sent();
                        http_util_1.HttpResponse.success(res, { verified: otpVerification.verified }, "OTP validated successfully");
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        message = error_2 instanceof Error ? error_2.message : "Failed to validate OTP";
                        logger.error("validateOtp Controller Error", {
                            message: message,
                            stack: error_2 instanceof Error ? error_2.stack : undefined,
                            transactionReference: transactionReference
                        });
                        statusCode = 400;
                        if (message.includes("Invalid transaction reference")) {
                            statusCode = 404;
                        }
                        else if (message.includes("OTP expired") ||
                            message.includes("OTP already verified") ||
                            message.includes("Invalid OTP")) {
                            statusCode = 400;
                        }
                        http_util_1.HttpResponse.error(res, message, statusCode);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return OtpController;
}());
exports.OtpController = OtpController;
