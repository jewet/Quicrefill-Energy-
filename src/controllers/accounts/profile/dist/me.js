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
exports.Me = void 0;
var db_1 = require("../../../config/db");
var client_1 = require("@prisma/client");
var crypto = require("crypto"); // Added for UUID generation
// Utility function to serialize BigInt values
var serializeBigInt = function (obj) {
    return JSON.parse(JSON.stringify(obj, function (key, value) {
        return typeof value === "bigint" ? value.toString() : value;
    }));
};
exports.Me = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var platform_1, userRole, user, userProfile, updatedUserProfile, serializedProfile_1, serializedProfile, error_1, errorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 8, , 9]);
                // Validate authenticated user
                if (!req.user || !req.user.id || !req.user.role) {
                    return [2 /*return*/, res.status(401).json({
                            success: false,
                            status: "error",
                            statusCode: 401,
                            message: "Unauthorized: No user authenticated"
                        })];
                }
                platform_1 = typeof req.query.platform === "string" ? req.query.platform : "app";
                userRole = req.user.role;
                if (!(userRole === client_1.Role.DELIVERY_REP && platform_1 === "web")) return [3 /*break*/, 3];
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({
                        where: { id: req.user.id },
                        select: { migratedToVendor: true }
                    })];
            case 1:
                user = _a.sent();
                if (!(user && !user.migratedToVendor)) return [3 /*break*/, 3];
                // Perform migration within a transaction
                return [4 /*yield*/, db_1.prismaClient.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        var profile;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: 
                                // Update User to VENDOR role
                                return [4 /*yield*/, tx.user.update({
                                        where: { id: req.user.id },
                                        data: {
                                            role: client_1.Role.VENDOR,
                                            migratedToVendor: true,
                                            migrationDate: new Date(),
                                            webAccessGranted: true,
                                            webAccessGrantedAt: new Date()
                                        }
                                    })];
                                case 1:
                                    // Update User to VENDOR role
                                    _a.sent();
                                    return [4 /*yield*/, tx.profile.findFirst({
                                            where: { userId: req.user.id }
                                        })];
                                case 2:
                                    profile = _a.sent();
                                    if (!profile) return [3 /*break*/, 4];
                                    return [4 /*yield*/, tx.profile.update({
                                            where: { id: profile.id },
                                            data: { role: client_1.Role.VENDOR, isWebEnabled: true, webEnabledAt: new Date() }
                                        })];
                                case 3:
                                    _a.sent();
                                    return [3 /*break*/, 6];
                                case 4: 
                                // Create a new profile if none exists
                                return [4 /*yield*/, tx.profile.create({
                                        data: {
                                            id: crypto.randomUUID(),
                                            userId: req.user.id,
                                            role: client_1.Role.VENDOR,
                                            isWebEnabled: true,
                                            webEnabledAt: new Date(),
                                            createdAt: new Date(),
                                            updatedAt: new Date()
                                        }
                                    })];
                                case 5:
                                    // Create a new profile if none exists
                                    _a.sent();
                                    _a.label = 6;
                                case 6: 
                                // Reassign Services
                                return [4 /*yield*/, tx.service.updateMany({
                                        where: { deliveryRepId: req.user.id },
                                        data: { vendorId: req.user.id, deliveryRepId: null }
                                    })];
                                case 7:
                                    // Reassign Services
                                    _a.sent();
                                    // Log migration audit
                                    return [4 /*yield*/, tx.auditLog.create({
                                            data: {
                                                userId: req.user.id,
                                                action: "MIGRATE_DELIVERY_REP_TO_VENDOR",
                                                entityType: "USER",
                                                entityId: req.user.id,
                                                details: { fromRole: client_1.Role.DELIVERY_REP, toRole: client_1.Role.VENDOR, platform: platform_1 }
                                            }
                                        })];
                                case 8:
                                    // Log migration audit
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                // Perform migration within a transaction
                _a.sent();
                userRole = client_1.Role.VENDOR; // Update role for subsequent queries
                _a.label = 3;
            case 3: return [4 /*yield*/, db_1.prismaClient.user.findUnique({
                    where: {
                        id: req.user.id
                    },
                    include: {
                        profile: {
                            where: {
                                role: userRole
                            },
                            include: {
                                services: userRole === client_1.Role.VENDOR,
                                orders: userRole === client_1.Role.VENDOR,
                                deliveryReps: userRole === client_1.Role.VENDOR,
                                givenFeedback: userRole === client_1.Role.VENDOR || userRole === client_1.Role.CUSTOMER,
                                receivedFeedback: userRole === client_1.Role.VENDOR || userRole === client_1.Role.DELIVERY_REP,
                                vendor: userRole === client_1.Role.DELIVERY_REP,
                                agents: userRole === client_1.Role.VENDOR,
                                deliveryRepVendor: userRole === client_1.Role.DELIVERY_REP,
                                servicesAsDeliveryRep: userRole === client_1.Role.DELIVERY_REP,
                                infractionsAsDeliveryRep: userRole === client_1.Role.DELIVERY_REP,
                                infractionsAsVendor: userRole === client_1.Role.VENDOR,
                                appealsAsVendor: userRole === client_1.Role.VENDOR,
                                serviceOrders: userRole === client_1.Role.VENDOR || userRole === client_1.Role.CUSTOMER,
                                vendorWalletConfigs: userRole === client_1.Role.VENDOR
                            }
                        },
                        wallet: true,
                        notificationPreferences: true,
                        ratings: true
                    }
                })];
            case 4:
                userProfile = _a.sent();
                // Handle user not found
                if (!userProfile) {
                    return [2 /*return*/, res.status(404).json({
                            success: false,
                            status: "error",
                            statusCode: 404,
                            message: "User not found"
                        })];
                }
                if (!(userRole === client_1.Role.CUSTOMER && !userProfile.profile)) return [3 /*break*/, 7];
                return [4 /*yield*/, db_1.prismaClient.profile.create({
                        data: {
                            id: crypto.randomUUID(),
                            userId: req.user.id,
                            role: client_1.Role.CUSTOMER,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    })];
            case 5:
                _a.sent();
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({
                        where: {
                            id: req.user.id
                        },
                        include: {
                            profile: {
                                where: {
                                    role: client_1.Role.CUSTOMER
                                },
                                include: {
                                    givenFeedback: true,
                                    serviceOrders: true
                                }
                            },
                            wallet: true,
                            notificationPreferences: true,
                            ratings: true
                        }
                    })];
            case 6:
                updatedUserProfile = _a.sent();
                if (!updatedUserProfile) {
                    return [2 /*return*/, res.status(404).json({
                            success: false,
                            status: "error",
                            statusCode: 404,
                            message: "Failed to fetch user after profile creation"
                        })];
                }
                serializedProfile_1 = serializeBigInt(updatedUserProfile);
                return [2 /*return*/, res.status(200).json({
                        success: true,
                        status: "success",
                        statusCode: 200,
                        data: serializedProfile_1
                    })];
            case 7:
                serializedProfile = serializeBigInt(userProfile);
                return [2 /*return*/, res.status(200).json({
                        success: true,
                        status: "success",
                        statusCode: 200,
                        data: serializedProfile
                    })];
            case 8:
                error_1 = _a.sent();
                errorMessage = error_1 instanceof Error ? error_1.message : "Unknown error";
                next({
                    message: "Failed to fetch user profile: " + errorMessage,
                    statusCode: 500,
                    stack: error_1 instanceof Error ? error_1.stack : undefined
                });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
