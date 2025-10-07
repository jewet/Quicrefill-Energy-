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
exports.register = void 0;
var db_1 = require("../../../config/db");
var bcryptjs_1 = require("bcryptjs");
var badRequests_1 = require("../../../exceptions/badRequests");
var root_1 = require("../../../exceptions/root");
var user_1 = require("../../../schemas/user");
var otp_1 = require("../../../lib/utils/mail/otp");
var client_1 = require("@prisma/client");
var uuid_1 = require("uuid");
var email_1 = require("../../../services/email");
var http_util_1 = require("../../../utils/http.util");
var winston_1 = require("winston");
var EventTypeDictionary_1 = require("../../../utils/EventTypeDictionary");
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
exports.register = function (req, res, next) { return __awaiter(void 0, void 0, Promise, function () {
    var startTime, platform, platformRaw, requestBody_1, validatedData, email_2, password, firstName, lastName, _a, role_1, _b, isSocialAccount, socialAccountProvider, address, phoneNumber, existingUser, existingUserByPhone, name, userData_1, _c, newUser, transactionReference, eventTypes, lastError, _i, eventTypes_1, input, eventType, otpError_1, otpError_2, errorMessage, error_1, errorMessage;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                startTime = Date.now();
                platform = "app";
                _d.label = 1;
            case 1:
                _d.trys.push([1, 27, , 29]);
                platformRaw = req.query.platform;
                if (typeof platformRaw === "string") {
                    platform = platformRaw;
                }
                else if (platformRaw) {
                    logger.warn("Invalid platform query parameter", { platformRaw: platformRaw, ip: req.ip, platform: platform });
                }
                console.log("Request body:", req.body);
                requestBody_1 = __assign({ isSocialAccount: false }, req.body);
                return [4 /*yield*/, user_1.RegisterUserSchema.parseAsync(requestBody_1)["catch"](function (err) {
                        logger.error("Validation error in registration", {
                            errors: err.issues,
                            email: requestBody_1.email,
                            ip: req.ip,
                            platform: platform
                        });
                        throw err;
                    })];
            case 2:
                validatedData = _d.sent();
                console.log("Validated data:", validatedData, "Time after validation: " + (Date.now() - startTime) + "ms");
                email_2 = validatedData.email, password = validatedData.password, firstName = validatedData.firstName, lastName = validatedData.lastName, _a = validatedData.role, role_1 = _a === void 0 ? client_1.Role.CUSTOMER : _a, _b = validatedData.isSocialAccount, isSocialAccount = _b === void 0 ? false : _b, socialAccountProvider = validatedData.socialAccountProvider, address = validatedData.address, phoneNumber = validatedData.phoneNumber;
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({ where: { email: email_2 } })];
            case 3:
                existingUser = _d.sent();
                console.log("Existing user check:", existingUser, "Time after user check: " + (Date.now() - startTime) + "ms");
                if (!existingUser) return [3 /*break*/, 5];
                return [4 /*yield*/, sendFailureEmail(email_2, "User already exists", platform)];
            case 4:
                _d.sent();
                throw new badRequests_1.BadRequest("User already exists", root_1.AppErrorCode.USER_ALREADY_EXIST);
            case 5:
                if (!phoneNumber) return [3 /*break*/, 8];
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({ where: { phoneNumber: phoneNumber } })];
            case 6:
                existingUserByPhone = _d.sent();
                console.log("Existing phone check:", existingUserByPhone, "Time after phone check: " + (Date.now() - startTime) + "ms");
                if (!existingUserByPhone) return [3 /*break*/, 8];
                return [4 /*yield*/, sendFailureEmail(email_2, "Phone number already in use", platform)];
            case 7:
                _d.sent();
                throw new badRequests_1.BadRequest("Phone number already in use", root_1.AppErrorCode.PHONE_ALREADY_EXIST);
            case 8:
                name = firstName + " " + lastName;
                userData_1 = {
                    id: uuid_1.v4(),
                    email: email_2,
                    firstName: firstName,
                    lastName: lastName,
                    name: name,
                    role: role_1,
                    address: address || null,
                    phoneNumber: phoneNumber || null,
                    isSocialAccount: isSocialAccount,
                    emailVerified: isSocialAccount,
                    createdAt: new Date()
                };
                if (isSocialAccount && socialAccountProvider) {
                    userData_1.socialAccountProvider = socialAccountProvider;
                }
                if (!!isSocialAccount) return [3 /*break*/, 12];
                if (!!password) return [3 /*break*/, 10];
                return [4 /*yield*/, sendFailureEmail(email_2, "Password is required for non-social accounts", platform)];
            case 9:
                _d.sent();
                throw new badRequests_1.BadRequest("Password is required for non-social accounts", root_1.AppErrorCode.INVALID_INPUT);
            case 10:
                _c = userData_1;
                return [4 /*yield*/, bcryptjs_1["default"].hash(password, 8)];
            case 11:
                _c.password = _d.sent();
                console.log("Time after password hashing: " + (Date.now() - startTime) + "ms");
                _d.label = 12;
            case 12:
                console.log("User data to create:", userData_1);
                return [4 /*yield*/, db_1.prismaClient.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        var user, contextRole;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, tx.user.create({ data: userData_1 })];
                                case 1:
                                    user = _a.sent();
                                    return [4 /*yield*/, createProfileForRole(role_1, user.id, tx)];
                                case 2:
                                    _a.sent();
                                    console.log("Creating wallet for user:", user.id);
                                    return [4 /*yield*/, tx.wallet.create({
                                            data: {
                                                id: uuid_1.v4(),
                                                userId: user.id,
                                                balance: 0.0
                                            }
                                        })];
                                case 3:
                                    _a.sent();
                                    contextRole = determineContextRole(role_1, platform);
                                    return [4 /*yield*/, tx.auditLog.create({
                                            data: {
                                                userId: user.id,
                                                action: "REGISTRATION_SUCCESS",
                                                entityType: "USER",
                                                entityId: user.id,
                                                details: {
                                                    platform: platform,
                                                    contextRole: contextRole,
                                                    email: email_2,
                                                    role: role_1,
                                                    ip: req.ip
                                                }
                                            }
                                        })];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/, user];
                            }
                        });
                    }); })];
            case 13:
                newUser = _d.sent();
                console.log("New user created:", newUser, "Time after transaction: " + (Date.now() - startTime) + "ms");
                transactionReference = void 0;
                if (!!isSocialAccount) return [3 /*break*/, 25];
                _d.label = 14;
            case 14:
                _d.trys.push([14, 23, , 25]);
                console.log("Attempting to send OTP to:", email_2);
                transactionReference = "REG_" + newUser.id + "_" + Date.now();
                eventTypes = ["otp", "otp_verification", "account verification"];
                lastError = void 0;
                _i = 0, eventTypes_1 = eventTypes;
                _d.label = 15;
            case 15:
                if (!(_i < eventTypes_1.length)) return [3 /*break*/, 20];
                input = eventTypes_1[_i];
                _d.label = 16;
            case 16:
                _d.trys.push([16, 18, , 19]);
                eventType = EventTypeDictionary_1.mapToEventType(input);
                console.log("Trying event type: " + eventType + " for input: " + input);
                if (eventType !== EventTypeDictionary_1.KnownEventTypes.OTP_VERIFICATION) {
                    logger.warn("Unexpected event type mapping", { input: input, mapped: eventType });
                    return [3 /*break*/, 19];
                }
                return [4 /*yield*/, otp_1.emailOtpService.generateAndSendOtp({
                        userId: newUser.id,
                        email: email_2,
                        medium: ["EMAIL"],
                        transactionReference: transactionReference,
                        eventType: eventType
                    })];
            case 17:
                _d.sent();
                console.log("Time after OTP initiation: " + (Date.now() - startTime) + "ms");
                return [3 /*break*/, 20]; // Success, exit loop
            case 18:
                otpError_1 = _d.sent();
                lastError = otpError_1 instanceof Error ? otpError_1.message : "Unknown error";
                logger.warn("OTP attempt failed", { input: input, eventTypes: eventTypes, error: lastError, userId: newUser.id, email: email_2 });
                return [3 /*break*/, 19];
            case 19:
                _i++;
                return [3 /*break*/, 15];
            case 20:
                if (!lastError) return [3 /*break*/, 22];
                logger.error("All OTP attempts failed", {
                    userId: newUser.id,
                    email: email_2,
                    error: lastError,
                    platform: platform,
                    eventTypes: eventTypes
                });
                return [4 /*yield*/, sendSuccessEmail(newUser, platform, true)];
            case 21:
                _d.sent();
                http_util_1.HttpResponse.success(res, __assign(__assign({}, userResponse(newUser)), { transactionReference: transactionReference }), "User registered successfully. OTP sending failed; please request verification manually.", 201);
                return [2 /*return*/];
            case 22: return [3 /*break*/, 25];
            case 23:
                otpError_2 = _d.sent();
                errorMessage = otpError_2 instanceof Error ? otpError_2.message : "Unknown error";
                logger.error("OTP sending failed", {
                    userId: newUser.id,
                    email: email_2,
                    error: errorMessage,
                    platform: platform,
                    eventType: "OTP_VERIFICATION"
                });
                return [4 /*yield*/, sendSuccessEmail(newUser, platform, true)];
            case 24:
                _d.sent();
                http_util_1.HttpResponse.success(res, __assign(__assign({}, userResponse(newUser)), { transactionReference: transactionReference }), "User registered successfully. OTP sending failed; please request verification manually.", 201);
                return [2 /*return*/];
            case 25: 
            // Send success email
            return [4 /*yield*/, sendSuccessEmail(newUser, platform)];
            case 26:
                // Send success email
                _d.sent();
                logger.info("User registered successfully", {
                    userId: newUser.id,
                    email: email_2,
                    role: role_1,
                    contextRole: determineContextRole(role_1, platform),
                    platform: platform
                });
                http_util_1.HttpResponse.success(res, __assign(__assign({}, userResponse(newUser)), { transactionReference: transactionReference }), "User registered successfully. Please check your email for OTP if applicable.", 201);
                return [3 /*break*/, 29];
            case 27:
                error_1 = _d.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                logger.error("Registration error", {
                    email: req.body.email || "unknown",
                    error: errorMessage,
                    ip: req.ip,
                    platform: platform
                });
                // Log failure in AuditLog
                return [4 /*yield*/, db_1.prismaClient.auditLog.create({
                        data: {
                            action: "REGISTRATION_FAILED",
                            entityType: "USER",
                            entityId: null,
                            details: {
                                platform: platform,
                                email: req.body.email || "unknown",
                                error: errorMessage,
                                ip: req.ip
                            }
                        }
                    })];
            case 28:
                // Log failure in AuditLog
                _d.sent();
                next(error_1);
                return [3 /*break*/, 29];
            case 29: return [2 /*return*/];
        }
    });
}); };
// Helper to determine contextRole
var determineContextRole = function (role, platform) {
    if (role === client_1.Role.VENDOR && platform === "app") {
        return client_1.Role.DELIVERY_REP;
    }
    if (role === client_1.Role.VENDOR && platform === "web") {
        return client_1.Role.VENDOR;
    }
    return role;
};
// Helper to send success email
var sendSuccessEmail = function (user, platform, otpFailed) {
    if (otpFailed === void 0) { otpFailed = false; }
    return __awaiter(void 0, void 0, Promise, function () {
        var contextRole, isVendorOrRep, eventType, emailError_1, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    contextRole = determineContextRole(user.role, platform);
                    isVendorOrRep = [client_1.Role.VENDOR, client_1.Role.DELIVERY_REP].includes(user.role);
                    eventType = EventTypeDictionary_1.mapToEventType("registration success");
                    if (eventType !== EventTypeDictionary_1.KnownEventTypes.REGISTRATION_SUCCESS) {
                        logger.error("Invalid event type mapping", { input: "registration success", mapped: eventType });
                        throw new Error("Invalid event type for registration success");
                    }
                    return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                            eventType: eventType,
                            userIds: [user.id],
                            metadata: {
                                userId: user.id,
                                name: user.name || "User",
                                email: user.email,
                                role: user.role,
                                contextRole: contextRole,
                                platform: platform,
                                isVendorOrRep: isVendorOrRep,
                                vendorDashboardUrl: isVendorOrRep ? "https://vendor.quicrefill.com" : undefined,
                                isSocialAccount: user.isSocialAccount,
                                otpFailed: otpFailed
                            }
                        })];
                case 1:
                    _a.sent();
                    logger.info("Registration success email sent", { userId: user.id, email: user.email, platform: platform });
                    return [3 /*break*/, 3];
                case 2:
                    emailError_1 = _a.sent();
                    errorMessage = emailError_1 instanceof Error ? emailError_1.message : "Unknown error";
                    logger.error("Failed to send registration success email", {
                        userId: user.id,
                        email: user.email,
                        error: errorMessage,
                        platform: platform
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
};
// Helper to send failure email
var sendFailureEmail = function (email, reason, platform) { return __awaiter(void 0, void 0, Promise, function () {
    var eventType, emailError_2, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                eventType = EventTypeDictionary_1.mapToEventType("registration failed");
                if (eventType !== EventTypeDictionary_1.KnownEventTypes.REGISTRATION_FAILED) {
                    logger.error("Invalid event type mapping", { input: "registration failed", mapped: eventType });
                    throw new Error("Invalid event type for registration failed");
                }
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: eventType,
                        userIds: [],
                        metadata: {
                            email: email,
                            reason: reason,
                            platform: platform
                        }
                    })];
            case 1:
                _a.sent();
                logger.info("Registration failure email sent", { email: email, reason: reason, platform: platform });
                return [3 /*break*/, 3];
            case 2:
                emailError_2 = _a.sent();
                errorMessage = emailError_2 instanceof Error ? emailError_2.message : "Unknown error";
                logger.error("Failed to send registration failure email", { email: email, error: errorMessage, platform: platform });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
// Helper to format user response
var userResponse = function (user) { return ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt
}); };
// Helper to create profile for specific roles
var createProfileForRole = function (role, userId, tx) { return __awaiter(void 0, void 0, Promise, function () {
    var profileRoles, profileData, error_2, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                profileRoles = [
                    client_1.Role.ADMIN,
                    client_1.Role.VENDOR,
                    client_1.Role.DELIVERY_REP,
                    client_1.Role.DELIVERY_AGENT,
                ];
                if (!profileRoles.includes(role)) return [3 /*break*/, 2];
                profileData = __assign({ id: uuid_1.v4(), userId: userId,
                    role: role }, (role === client_1.Role.DELIVERY_REP || role === client_1.Role.DELIVERY_AGENT
                    ? { status: "PENDING", vehicleType: "Unknown" }
                    : {}));
                console.log("Creating profile for role:", role, "with data:", profileData);
                return [4 /*yield*/, tx.profile.create({ data: profileData })];
            case 1:
                _a.sent();
                console.log("Profile created successfully for user:", userId);
                return [3 /*break*/, 3];
            case 2:
                console.log("No profile creation needed for role " + role);
                _a.label = 3;
            case 3: return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                errorMessage = error_2 instanceof Error ? error_2.message : "Unknown error";
                logger.error("Profile creation error", { userId: userId, role: role, error: errorMessage });
                throw new Error("Failed to create profile for role " + role + ": " + errorMessage);
            case 5: return [2 /*return*/];
        }
    });
}); };
