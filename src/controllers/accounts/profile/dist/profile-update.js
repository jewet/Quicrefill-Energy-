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
exports.VerifyProfileUpdateOtp = exports.ProfileUpdate = void 0;
var validation_1 = require("../../../exceptions/validation");
var root_1 = require("../../../exceptions/root");
var profile_1 = require("../../../schemas/profile");
var __1 = require("../../..");
var otp_1 = require("../../../lib/utils/mail/otp");
var redis_1 = require("../../../config/redis");
var client_1 = require("@prisma/client");
var winston_1 = require("winston");
var crypto = require("crypto");
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
exports.ProfileUpdate = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedData_1, userUpdateData_1, redis, transactionReference, user, otpRequest, pendingUpdate, updatedUser, err_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 7, , 8]);
                // Validate authenticated user
                if (!req.user || !req.user.id || !req.user.role) {
                    throw new validation_1.UnprocessableEntity("Unauthorized: No user authenticated", root_1.AppErrorCode.UNAUTHENTICATED, null);
                }
                // Explicitly validate user role using Role enum
                if (!Object.values(client_1.Role).includes(req.user.role)) {
                    throw new validation_1.UnprocessableEntity("Invalid user role: " + req.user.role, root_1.AppErrorCode.INVALID_REQUEST, null);
                }
                return [4 /*yield*/, profile_1.ProfileUpdateSchema.parseAsync(req.body)];
            case 1:
                validatedData_1 = _b.sent();
                logger.info("Validated profile update data", { userId: req.user.id, data: validatedData_1 });
                userUpdateData_1 = {
                    email: validatedData_1.email,
                    firstName: validatedData_1.firstName,
                    lastName: validatedData_1.lastName,
                    name: validatedData_1.name,
                    phoneNumber: validatedData_1.phoneNumber,
                    avatar: validatedData_1.avatar,
                    dateOfBirth: validatedData_1.dateOfBirth ? new Date(validatedData_1.dateOfBirth) : undefined
                };
                redis = redis_1.getRedisClient();
                transactionReference = crypto.randomUUID();
                if (!(validatedData_1.email && validatedData_1.email !== req.user.email)) return [3 /*break*/, 5];
                userUpdateData_1.email = validatedData_1.email;
                userUpdateData_1.emailVerified = false;
                return [4 /*yield*/, __1.prismaClient.user.findUnique({
                        where: { id: req.user.id },
                        select: { firstName: true, lastName: true, role: true }
                    })];
            case 2:
                user = _b.sent();
                if (!user || (!user.firstName && !user.lastName)) {
                    throw new validation_1.UnprocessableEntity("User not found or missing name", root_1.AppErrorCode.INVALID_REQUEST, null);
                }
                otpRequest = {
                    userId: req.user.id,
                    email: validatedData_1.email,
                    medium: ["EMAIL"],
                    transactionReference: transactionReference,
                    eventType: "PROFILE_UPDATE",
                    metadata: {
                        name: ((user.firstName || "") + " " + (user.lastName || "")).trim(),
                        role: user.role
                    }
                };
                return [4 /*yield*/, otp_1.emailOtpService.generateAndSendOtp(otpRequest)];
            case 3:
                _b.sent();
                logger.info("OTP sent for email update", { userId: req.user.id, email: validatedData_1.email, transactionReference: transactionReference });
                pendingUpdate = {
                    userId: req.user.id,
                    userUpdateData: userUpdateData_1,
                    transactionReference: transactionReference
                };
                return [4 /*yield*/, redis.setEx("pending_profile_update:" + transactionReference, 600, JSON.stringify(pendingUpdate))];
            case 4:
                _b.sent();
                logger.info("Pending profile update stored in Redis", { transactionReference: transactionReference });
                return [2 /*return*/, res.json({
                        success: true,
                        data: { transactionReference: transactionReference },
                        message: "OTP sent to new email. Please verify to complete profile update."
                    })];
            case 5: return [4 /*yield*/, __1.prismaClient.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                    var user, profile;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, tx.user.update({
                                    where: { id: req.user.id },
                                    data: userUpdateData_1
                                })];
                            case 1:
                                user = _a.sent();
                                return [4 /*yield*/, tx.profile.findFirst({
                                        where: { userId: req.user.id }
                                    })];
                            case 2:
                                profile = _a.sent();
                                if (!!profile) return [3 /*break*/, 4];
                                return [4 /*yield*/, tx.profile.create({
                                        data: {
                                            id: crypto.randomUUID(),
                                            userId: req.user.id,
                                            role: req.user.role,
                                            createdAt: new Date(),
                                            updatedAt: new Date()
                                        }
                                    })];
                            case 3:
                                profile = _a.sent();
                                _a.label = 4;
                            case 4: 
                            // Log audit
                            return [4 /*yield*/, tx.auditLog.create({
                                    data: {
                                        userId: req.user.id,
                                        action: "UPDATE_PROFILE",
                                        entityType: "USER_PROFILE",
                                        entityId: req.user.id,
                                        details: {
                                            updatedFields: Object.keys(validatedData_1).filter(function (key) { return validatedData_1[key] !== undefined; }),
                                            emailChanged: !!validatedData_1.email
                                        }
                                    }
                                })];
                            case 5:
                                // Log audit
                                _a.sent();
                                return [2 /*return*/, { user: user, profile: profile }];
                        }
                    });
                }); })];
            case 6:
                updatedUser = _b.sent();
                logger.info("Profile updated successfully", { userId: req.user.id });
                res.json({
                    success: true,
                    data: {
                        user: updatedUser.user,
                        profile: updatedUser.profile
                    },
                    message: "Profile updated successfully"
                });
                return [3 /*break*/, 8];
            case 7:
                err_1 = _b.sent();
                logger.error("ProfileUpdate error", { error: err_1.message, userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id });
                if (err_1 instanceof validation_1.UnprocessableEntity) {
                    next(err_1);
                }
                else {
                    next(new validation_1.UnprocessableEntity(err_1.message || "Unprocessable Entity", root_1.AppErrorCode.UNPROCESSABLE_ENTITY, (err_1 === null || err_1 === void 0 ? void 0 : err_1.issues) || null));
                }
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.VerifyProfileUpdateOtp = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, transactionReference, otpCode, otpVerification, redis, pendingUpdateKey, pendingUpdateRaw, pendingUpdate_1, updatedUser, err_2;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 5, , 6]);
                // Validate authenticated user
                if (!req.user || !req.user.id) {
                    throw new validation_1.UnprocessableEntity("Unauthorized: No user authenticated", root_1.AppErrorCode.UNAUTHENTICATED, null);
                }
                // Explicitly validate user role using Role enum
                if (!Object.values(client_1.Role).includes(req.user.role)) {
                    throw new validation_1.UnprocessableEntity("Invalid user role: " + req.user.role, root_1.AppErrorCode.INVALID_REQUEST, null);
                }
                _a = req.body, transactionReference = _a.transactionReference, otpCode = _a.otpCode;
                if (!transactionReference || !otpCode) {
                    throw new validation_1.UnprocessableEntity("Transaction reference and OTP code are required", root_1.AppErrorCode.INVALID_REQUEST, null);
                }
                return [4 /*yield*/, otp_1.emailOtpService.verifyOtp(transactionReference, otpCode)];
            case 1:
                otpVerification = _c.sent();
                if (!otpVerification.verified) {
                    throw new validation_1.UnprocessableEntity("OTP verification failed", root_1.AppErrorCode.INVALID_OTP, null);
                }
                redis = redis_1.getRedisClient();
                pendingUpdateKey = "pending_profile_update:" + transactionReference;
                return [4 /*yield*/, redis.get(pendingUpdateKey)];
            case 2:
                pendingUpdateRaw = _c.sent();
                if (!pendingUpdateRaw) {
                    throw new validation_1.UnprocessableEntity("Pending profile update not found or expired", root_1.AppErrorCode.INVALID_REQUEST, null);
                }
                pendingUpdate_1 = JSON.parse(pendingUpdateRaw);
                if (pendingUpdate_1.userId !== req.user.id) {
                    throw new validation_1.UnprocessableEntity("Unauthorized: Invalid user for this update", root_1.AppErrorCode.UNAUTHENTICATED, null);
                }
                return [4 /*yield*/, __1.prismaClient.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        var user, profile;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, tx.user.update({
                                        where: { id: req.user.id },
                                        data: pendingUpdate_1.userUpdateData
                                    })];
                                case 1:
                                    user = _a.sent();
                                    return [4 /*yield*/, tx.profile.findFirst({
                                            where: { userId: req.user.id }
                                        })];
                                case 2:
                                    profile = _a.sent();
                                    if (!!profile) return [3 /*break*/, 4];
                                    return [4 /*yield*/, tx.profile.create({
                                            data: {
                                                id: crypto.randomUUID(),
                                                userId: req.user.id,
                                                role: req.user.role,
                                                createdAt: new Date(),
                                                updatedAt: new Date()
                                            }
                                        })];
                                case 3:
                                    profile = _a.sent();
                                    _a.label = 4;
                                case 4: 
                                // Log audit
                                return [4 /*yield*/, tx.auditLog.create({
                                        data: {
                                            userId: req.user.id,
                                            action: "UPDATE_PROFILE",
                                            entityType: "USER_PROFILE",
                                            entityId: req.user.id,
                                            details: {
                                                updatedFields: Object.keys(pendingUpdate_1.userUpdateData),
                                                emailChanged: !!pendingUpdate_1.userUpdateData.email
                                            }
                                        }
                                    })];
                                case 5:
                                    // Log audit
                                    _a.sent();
                                    return [2 /*return*/, { user: user, profile: profile }];
                            }
                        });
                    }); })];
            case 3:
                updatedUser = _c.sent();
                // Clean up Redis
                return [4 /*yield*/, redis.del(pendingUpdateKey)];
            case 4:
                // Clean up Redis
                _c.sent();
                logger.info("Profile updated after OTP verification", { userId: req.user.id, transactionReference: transactionReference });
                res.json({
                    success: true,
                    data: {
                        user: updatedUser.user,
                        profile: updatedUser.profile
                    },
                    message: "Profile updated successfully after OTP verification"
                });
                return [3 /*break*/, 6];
            case 5:
                err_2 = _c.sent();
                logger.error("VerifyProfileUpdateOtp error", { error: err_2.message, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id });
                if (err_2 instanceof validation_1.UnprocessableEntity) {
                    next(err_2);
                }
                else {
                    next(new validation_1.UnprocessableEntity(err_2.message || "Unprocessable Entity", root_1.AppErrorCode.UNPROCESSABLE_ENTITY, (err_2 === null || err_2 === void 0 ? void 0 : err_2.issues) || null));
                }
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
