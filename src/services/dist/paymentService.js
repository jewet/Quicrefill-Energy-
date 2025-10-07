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
var db_1 = require("../config/db");
var uuid_1 = require("uuid");
var axios_1 = require("axios");
var paymentUtils_1 = require("../utils/paymentUtils");
var client_1 = require("@prisma/client");
var nodemailer_1 = require("nodemailer");
var paymentModel_1 = require("../models/paymentModel");
var library_1 = require("@prisma/client/runtime/library");
var redis_1 = require("../config/redis");
var logger_1 = require("../config/logger");
// Validate environment variables at module level
if (!process.env.FLUTTERWAVE_PUBLIC_KEY || !process.env.FLUTTERWAVE_SECRET_KEY) {
    console.error("Missing FLUTTERWAVE_PUBLIC_KEY or FLUTTERWAVE_SECRET_KEY in environment");
    throw new Error("Flutterwave configuration missing");
}
// Initialize nodemailer transporter
var transporter = nodemailer_1["default"].createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
var PaymentService = /** @class */ (function () {
    function PaymentService() {
    }
    PaymentService.prototype.isPaymentMethodEnabled = function (paymentMethod) {
        return __awaiter(this, void 0, Promise, function () {
            var config;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1["default"].paymentConfig.findUnique({ where: { paymentMethod: paymentMethod } })];
                    case 1:
                        config = _a.sent();
                        if (!config) {
                            console.warn("No PaymentConfig entry for " + paymentMethod + ". Defaulting to disabled.");
                            return [2 /*return*/, false];
                        }
                        return [2 /*return*/, config.isEnabled];
                }
            });
        });
    };
    PaymentService.prototype.getPaymentGateway = function (paymentMethod) {
        return __awaiter(this, void 0, Promise, function () {
            var config;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1["default"].paymentConfig.findUnique({ where: { paymentMethod: paymentMethod } })];
                    case 1:
                        config = _a.sent();
                        return [2 /*return*/, (config === null || config === void 0 ? void 0 : config.gateway) ? config.gateway.toLowerCase() : null];
                }
            });
        });
    };
    PaymentService.prototype.processPayment = function (userId, amount, paymentMethod, productType, transactionRef, clientIp, cardDetails, isWalletTopUp) {
        var _a, _b, _c, _d;
        if (isWalletTopUp === void 0) { isWalletTopUp = false; }
        return __awaiter(this, void 0, Promise, function () {
            var flutterwaveMethods, gateway, ref, existingPayment, providerId, provider, adminSettings, defaultServiceCharge, defaultTopupCharge, defaultVatRate, serviceFee, topupCharge, vatRate, vat, totalAmount, meterNumber, paymentProductType, paymentDetails, payment, result, _e, flutterwaveResult, cardResult, transferResult, walletResult, podResult, error_1, payment, auditError_1;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 25, , 31]);
                        logger_1["default"].info("Processing " + (isWalletTopUp ? 'wallet top-up' : productType || 'payment'), {
                            userId: userId,
                            amount: amount,
                            paymentMethod: paymentMethod,
                            clientIp: clientIp || 'not provided',
                            isWalletTopUp: isWalletTopUp,
                            productType: productType || 'none'
                        });
                        return [4 /*yield*/, this.isPaymentMethodEnabled(paymentMethod)];
                    case 1:
                        if (!(_f.sent())) {
                            throw new Error("Payment method " + paymentMethod + " is currently disabled");
                        }
                        if (isWalletTopUp) {
                            if (paymentMethod === client_1.PaymentMethod.WALLET) {
                                throw new Error('Wallet top-up cannot use WALLET payment method');
                            }
                            if (productType) {
                                throw new Error('Wallet top-up cannot have a product type');
                            }
                        }
                        flutterwaveMethods = ['FLUTTERWAVE', 'CARD', 'TRANSFER'];
                        if (!flutterwaveMethods.includes(paymentMethod)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.getPaymentGateway(paymentMethod)];
                    case 2:
                        gateway = _f.sent();
                        if (!gateway || gateway.toLowerCase() !== 'flutterwave') {
                            throw new Error("Payment method " + paymentMethod + " requires Flutterwave, but current gateway is " + (gateway || 'none'));
                        }
                        _f.label = 3;
                    case 3:
                        if (isNaN(amount) || amount <= 0) {
                            throw new Error('Invalid amount: must be a positive number.');
                        }
                        ref = transactionRef || "TRX-" + uuid_1.v4() + "-" + Date.now();
                        logger_1["default"].debug('Generated transactionRef', { transactionRef: ref });
                        return [4 /*yield*/, db_1["default"].payment.findUnique({ where: { transactionRef: ref } })];
                    case 4:
                        existingPayment = _f.sent();
                        if (existingPayment) {
                            return [2 /*return*/, {
                                    transactionId: existingPayment.id,
                                    paymentDetails: (_a = existingPayment.paymentDetails) !== null && _a !== void 0 ? _a : undefined,
                                    status: existingPayment.status
                                }];
                        }
                        providerId = void 0;
                        if (!flutterwaveMethods.includes(paymentMethod)) return [3 /*break*/, 6];
                        return [4 /*yield*/, db_1["default"].paymentProvider.findFirst({
                                where: { name: { equals: 'Flutterwave', mode: 'insensitive' } }
                            })];
                    case 5:
                        provider = _f.sent();
                        if (!provider) {
                            throw new Error("Payment provider 'Flutterwave' not found.");
                        }
                        providerId = provider.id;
                        _f.label = 6;
                    case 6: return [4 /*yield*/, db_1["default"].adminSettings.findFirst()];
                    case 7:
                        adminSettings = _f.sent();
                        defaultServiceCharge = 0.0;
                        defaultTopupCharge = 0.0;
                        defaultVatRate = 0.075;
                        if (!adminSettings) {
                            logger_1["default"].warn('Admin settings not found, using default values', {
                                defaultServiceCharge: defaultServiceCharge,
                                defaultTopupCharge: defaultTopupCharge,
                                defaultVatRate: defaultVatRate
                            });
                        }
                        serviceFee = isWalletTopUp ? 0 : ((_b = adminSettings === null || adminSettings === void 0 ? void 0 : adminSettings.defaultServiceCharge) !== null && _b !== void 0 ? _b : defaultServiceCharge);
                        topupCharge = isWalletTopUp ? ((_c = adminSettings === null || adminSettings === void 0 ? void 0 : adminSettings.defaultTopupCharge) !== null && _c !== void 0 ? _c : defaultTopupCharge) : 0;
                        vatRate = paymentMethod === client_1.PaymentMethod.WALLET && !isWalletTopUp ? 0 : ((_d = adminSettings === null || adminSettings === void 0 ? void 0 : adminSettings.defaultVatRate) !== null && _d !== void 0 ? _d : defaultVatRate);
                        vat = amount * vatRate;
                        totalAmount = amount + (isWalletTopUp ? topupCharge : serviceFee) + vat;
                        meterNumber = productType === 'electricity' ? 'defaultMeterNumber' : 'N/A';
                        paymentProductType = isWalletTopUp ? 'wallet_topup' : productType || 'gas';
                        paymentDetails = {
                            paymentType: isWalletTopUp ? 'wallet_topup' : productType,
                            baseAmount: amount,
                            serviceFee: isWalletTopUp ? undefined : serviceFee,
                            topupCharge: isWalletTopUp ? topupCharge : undefined,
                            vat: vat,
                            totalAmount: totalAmount
                        };
                        logger_1["default"].debug('Payment details', {
                            paymentProductType: paymentProductType,
                            paymentDetails: paymentDetails,
                            baseAmount: amount,
                            serviceFee: serviceFee,
                            topupCharge: topupCharge,
                            vat: vat,
                            totalAmount: totalAmount
                        });
                        return [4 /*yield*/, paymentModel_1.createPaymentRecord(userId, totalAmount, paymentMethod, client_1.TransactionStatus.PENDING, ref, paymentProductType, providerId !== null && providerId !== void 0 ? providerId : 0, meterNumber, amount)];
                    case 8:
                        payment = _f.sent();
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: ref },
                                data: { paymentDetails: paymentDetails }
                            })];
                    case 9:
                        _f.sent();
                        logger_1["default"].info('Payment record created', { transactionRef: ref, payment: payment });
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    action: 'PAYMENT_INITIATED',
                                    entityType: 'Payment',
                                    entityId: payment.id,
                                    details: {
                                        transactionRef: ref,
                                        baseAmount: amount,
                                        serviceFee: isWalletTopUp ? undefined : serviceFee,
                                        topupCharge: isWalletTopUp ? topupCharge : undefined,
                                        vat: vat,
                                        totalAmount: totalAmount,
                                        paymentMethod: paymentMethod,
                                        paymentProductType: paymentProductType
                                    }
                                }
                            })];
                    case 10:
                        _f.sent();
                        if (!(isWalletTopUp && paymentMethod === client_1.PaymentMethod.FLUTTERWAVE)) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.initiateFlutterwavePayment(ref, totalAmount, userId, paymentProductType, true)];
                    case 11:
                        result = _f.sent();
                        logger_1["default"].info('Payment initiated, awaiting user completion', { transactionRef: ref, paymentLink: result.paymentDetails.link });
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: __assign(__assign({}, paymentDetails), { link: result.paymentDetails.link }),
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 12:
                        _e = paymentMethod;
                        switch (_e) {
                            case client_1.PaymentMethod.FLUTTERWAVE: return [3 /*break*/, 13];
                            case client_1.PaymentMethod.CARD: return [3 /*break*/, 15];
                            case client_1.PaymentMethod.TRANSFER: return [3 /*break*/, 17];
                            case client_1.PaymentMethod.WALLET: return [3 /*break*/, 19];
                            case client_1.PaymentMethod.PAY_ON_DELIVERY: return [3 /*break*/, 21];
                        }
                        return [3 /*break*/, 23];
                    case 13: return [4 /*yield*/, this.initiateFlutterwavePayment(ref, totalAmount, userId, paymentProductType, isWalletTopUp)];
                    case 14:
                        flutterwaveResult = _f.sent();
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: __assign(__assign({}, paymentDetails), { link: flutterwaveResult.paymentDetails.link }),
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 15:
                        if (!cardDetails)
                            throw new Error('Card details required for CARD payment');
                        return [4 /*yield*/, this.initiateCardPayment(ref, totalAmount, userId, paymentProductType, cardDetails)];
                    case 16:
                        cardResult = _f.sent();
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: __assign(__assign({}, paymentDetails), cardResult.paymentDetails),
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 17: return [4 /*yield*/, this.initiateTransferPayment(ref, totalAmount, userId, paymentProductType, clientIp)];
                    case 18:
                        transferResult = _f.sent();
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: __assign(__assign({}, paymentDetails), transferResult.paymentDetails),
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 19: return [4 /*yield*/, this.handleWalletPayment(userId, totalAmount, ref)];
                    case 20:
                        walletResult = _f.sent();
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: paymentDetails,
                                status: walletResult.status
                            }];
                    case 21: return [4 /*yield*/, this.handlePayOnDelivery(userId, ref)];
                    case 22:
                        podResult = _f.sent();
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: __assign(__assign({}, paymentDetails), podResult.paymentDetails),
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 23: throw new Error("Unsupported payment method: " + paymentMethod);
                    case 24: return [3 /*break*/, 31];
                    case 25:
                        error_1 = _f.sent();
                        logger_1["default"].error('Payment Processing Error', {
                            message: error_1.message,
                            userId: userId,
                            paymentMethod: paymentMethod,
                            productType: productType,
                            isWalletTopUp: isWalletTopUp,
                            transactionRef: transactionRef,
                            stack: error_1.stack
                        });
                        _f.label = 26;
                    case 26:
                        _f.trys.push([26, 29, , 30]);
                        return [4 /*yield*/, db_1["default"].payment.findUnique({ where: { transactionRef: transactionRef || '' } })];
                    case 27:
                        payment = _f.sent();
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    action: 'PAYMENT_FAILED',
                                    entityType: 'Payment',
                                    entityId: (payment === null || payment === void 0 ? void 0 : payment.id) || null,
                                    details: {
                                        error: error_1.message,
                                        baseAmount: amount,
                                        paymentMethod: paymentMethod,
                                        productType: productType,
                                        isWalletTopUp: isWalletTopUp,
                                        transactionRef: transactionRef
                                    }
                                }
                            })];
                    case 28:
                        _f.sent();
                        return [3 /*break*/, 30];
                    case 29:
                        auditError_1 = _f.sent();
                        logger_1["default"].error('Failed to create audit log for payment failure', {
                            message: auditError_1.message,
                            userId: userId,
                            transactionRef: transactionRef,
                            stack: auditError_1.stack
                        });
                        return [3 /*break*/, 30];
                    case 30: throw new Error("Payment initiation failed: " + error_1.message);
                    case 31: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.initiateFlutterwavePayment = function (transactionRef, amount, userId, productType, isWalletTopUp) {
        if (isWalletTopUp === void 0) { isWalletTopUp = false; }
        return __awaiter(this, void 0, Promise, function () {
            var user, customerEmail, payment, paymentDetails, isWalletTopUpFlag, paymentTitle, meta, response, updatedPaymentDetails;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1["default"].user.findUnique({ where: { id: userId } })];
                    case 1:
                        user = _a.sent();
                        if (!user)
                            throw new Error("User not found");
                        customerEmail = user.email || "fallback@example.com";
                        return [4 /*yield*/, db_1["default"].payment.findUnique({ where: { transactionRef: transactionRef } })];
                    case 2:
                        payment = _a.sent();
                        if (!payment)
                            throw new Error("Payment record not found");
                        paymentDetails = payment.paymentDetails;
                        isWalletTopUpFlag = isWalletTopUp || (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === "wallet_topup";
                        paymentTitle = isWalletTopUpFlag ? "Wallet Top-Up" : productType + " Payment";
                        logger_1["default"].info("Initiating Flutterwave Payment:", {
                            transactionRef: transactionRef,
                            userId: userId,
                            productType: productType || "none",
                            isWalletTopUp: isWalletTopUpFlag,
                            paymentType: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) || "none",
                            paymentTitle: paymentTitle,
                            amount: amount
                        });
                        meta = {
                            isWalletTopUp: isWalletTopUpFlag
                        };
                        if (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) {
                            meta.paymentType = paymentDetails.paymentType;
                        }
                        if (productType && !isWalletTopUpFlag) {
                            meta.productType = productType;
                        }
                        return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/payments", {
                                tx_ref: transactionRef,
                                amount: amount,
                                currency: "NGN",
                                redirect_url: (process.env.SERVER_URL || "http://localhost:5000") + "/api/payments/callback",
                                customer: { email: customerEmail, name: user.name || "Customer" },
                                customizations: { title: paymentTitle },
                                meta: meta
                            }, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    "Content-Type": "application/json"
                                }
                            })];
                    case 3:
                        response = _a.sent();
                        if (response.data.status !== "success") {
                            throw new Error("Failed to initiate Flutterwave payment: " + response.data.message);
                        }
                        updatedPaymentDetails = paymentDetails && typeof paymentDetails === "object"
                            ? __assign(__assign({}, paymentDetails), { link: response.data.data.link }) : { link: response.data.data.link, paymentType: isWalletTopUpFlag ? "wallet_topup" : undefined };
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionRef },
                                data: { paymentDetails: updatedPaymentDetails }
                            })];
                    case 4:
                        _a.sent();
                        logger_1["default"].info("Flutterwave Response:", {
                            transactionRef: transactionRef,
                            status: response.data.status,
                            link: response.data.data.link
                        });
                        return [2 /*return*/, {
                                transactionId: payment.id,
                                paymentDetails: { link: response.data.data.link },
                                status: client_1.TransactionStatus.PENDING
                            }];
                }
            });
        });
    };
    PaymentService.prototype.initiateCardPayment = function (transactionRef, amount, userId, productType, cardDetails) {
        var _a, _b;
        return __awaiter(this, void 0, Promise, function () {
            var user, fullPayload, response, data, flwRef, paymentDetails, error_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        if (!cardDetails.cardno || !cardDetails.cvv || !cardDetails.expirymonth || !cardDetails.expiryyear) {
                            throw new Error("Missing required card details: cardno, cvv, expirymonth, expiryyear");
                        }
                        logger_1["default"].info("Environment Variables:", {
                            secretKey: process.env.FLUTTERWAVE_SECRET_KEY ? "Set" : "Missing",
                            publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ? "Set" : "Missing",
                            serverUrl: process.env.SERVER_URL || "Not set"
                        });
                        if (!process.env.FLUTTERWAVE_SECRET_KEY) {
                            throw new Error("Flutterwave secret key missing in environment variables");
                        }
                        return [4 /*yield*/, db_1["default"].user.findUnique({ where: { id: userId } })];
                    case 1:
                        user = _c.sent();
                        if (!user) {
                            throw new Error("User not found");
                        }
                        if (!user.email || !user.name) {
                            throw new Error("User missing required details: email and name must be set");
                        }
                        fullPayload = {
                            tx_ref: transactionRef,
                            amount: amount.toString(),
                            currency: "NGN",
                            redirect_url: (process.env.FRONTEND_URL || "http://localhost:3000") + "/payment-callback",
                            payment_options: "card",
                            payment_type: "card",
                            customer: {
                                email: user.email,
                                name: user.name,
                                phonenumber: user.phoneNumber || "N/A"
                            },
                            customizations: {
                                title: productType === "wallet_topup" ? "Wallet Top-Up" : productType + " Payment"
                            },
                            meta: {
                                payment_method: "card",
                                product_type: productType
                            }
                        };
                        logger_1["default"].info("Card Payment Payload:", JSON.stringify(fullPayload, null, 2));
                        return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/payments", fullPayload, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    "Content-Type": "application/json",
                                    Accept: "application/json",
                                    "User-Agent": "CustomerService/1.0"
                                },
                                timeout: 10000
                            })];
                    case 2:
                        response = _c.sent();
                        logger_1["default"].info("Raw Flutterwave Response:", JSON.stringify(response.data, null, 2));
                        logger_1["default"].info("HTTP Status Code:", response.status);
                        if (response.data.status !== "success" || !response.data.data.link) {
                            throw new Error("Flutterwave API error: " + (response.data.message || "Failed to initiate card payment"));
                        }
                        data = response.data.data;
                        flwRef = data.flw_ref || data.id || transactionRef;
                        paymentDetails = {
                            link: data.link,
                            transactionRef: transactionRef,
                            flwRef: flwRef,
                            authorization: cardDetails.pin ? { mode: "pin", fields: ["pin"] } : undefined
                        };
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionRef },
                                data: {
                                    flwRef: flwRef,
                                    paymentDetails: paymentDetails,
                                    status: client_1.TransactionStatus.PENDING
                                }
                            })];
                    case 3:
                        _c.sent();
                        logger_1["default"].info("Card payment initiated: " + transactionRef + " - flwRef: " + flwRef + " - Status: " + client_1.TransactionStatus.PENDING);
                        return [2 /*return*/, {
                                transactionId: transactionRef,
                                paymentDetails: paymentDetails,
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 4:
                        error_2 = _c.sent();
                        logger_1["default"].error("Card Payment Initiation Error:", {
                            message: error_2.message,
                            stack: error_2.stack,
                            transactionRef: transactionRef,
                            userId: userId,
                            response: (_a = error_2.response) === null || _a === void 0 ? void 0 : _a.data,
                            httpStatus: (_b = error_2.response) === null || _b === void 0 ? void 0 : _b.status
                        });
                        throw new Error("Failed to initiate card payment: " + error_2.message);
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.validateCardPayment = function (transactionRef, flwRef, otp) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var response, status, payment, creditAmount, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/validate-charge", {
                                flw_ref: flwRef,
                                otp: otp
                            }, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    "Content-Type": "application/json"
                                }
                            })];
                    case 1:
                        response = _b.sent();
                        if (response.data.status !== "success") {
                            throw new Error("Failed to validate card payment: " + response.data.message);
                        }
                        status = response.data.data.tx.chargeResponseCode === "00" ? client_1.TransactionStatus.COMPLETED : client_1.TransactionStatus.PENDING;
                        if (!(status === client_1.TransactionStatus.COMPLETED)) return [3 /*break*/, 4];
                        return [4 /*yield*/, db_1["default"].payment.findUnique({ where: { transactionRef: transactionRef } })];
                    case 2:
                        payment = _b.sent();
                        if (!(payment && payment.productType === "wallet_topup")) return [3 /*break*/, 4];
                        creditAmount = payment.requestedAmount != null ? payment.requestedAmount : payment.amount;
                        return [4 /*yield*/, this.creditWallet(payment.userId, creditAmount, transactionRef)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [4 /*yield*/, db_1["default"].payment.update({
                            where: { transactionRef: transactionRef },
                            data: { status: status }
                        })];
                    case 5:
                        _b.sent();
                        logger_1["default"].info("Card Validation Response:", response.data);
                        return [2 /*return*/, { transactionId: transactionRef, status: status }];
                    case 6:
                        error_3 = _b.sent();
                        logger_1["default"].error("Card Validation Error:", {
                            message: error_3.message,
                            response: (_a = error_3.response) === null || _a === void 0 ? void 0 : _a.data
                        });
                        throw new Error("Card validation failed: " + error_3.message);
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // Updated authorizeCardPayment method
    PaymentService.prototype.authorizeCardPayment = function (transactionRef, flwRef, authorizationData) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var payment, resolvedFlwRef, payload, response, status, paymentDetails, creditAmount, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 9, , 11]);
                        console.log("Authorizing card payment for transaction: " + transactionRef);
                        if (!transactionRef) {
                            throw new Error("Transaction reference is required");
                        }
                        if (!authorizationData.otp && !authorizationData.pin && !authorizationData.address) {
                            throw new Error("At least one of OTP, PIN, or address is required for authorization");
                        }
                        return [4 /*yield*/, db_1["default"].payment.findUnique({
                                where: { transactionRef: transactionRef },
                                include: { provider: true }
                            })];
                    case 1:
                        payment = _b.sent();
                        if (!payment) {
                            throw new Error("Payment record not found");
                        }
                        if (payment.paymentMethod !== client_1.PaymentMethod.CARD) {
                            throw new Error("Authorization is only applicable for CARD payments");
                        }
                        if (!payment.provider || payment.provider.name.toLowerCase() !== "flutterwave") {
                            throw new Error("Invalid payment provider for authorization");
                        }
                        resolvedFlwRef = flwRef || payment.flwRef;
                        if (!resolvedFlwRef) {
                            throw new Error("Flutterwave reference (flwRef) is missing");
                        }
                        payload = {
                            flw_ref: resolvedFlwRef
                        };
                        if (authorizationData.otp) {
                            payload.otp = authorizationData.otp;
                        }
                        else if (authorizationData.pin) {
                            payload.otp = authorizationData.pin;
                        }
                        else if (authorizationData.address) {
                            payload.address = authorizationData.address;
                        }
                        console.log("Authorization Payload:", JSON.stringify(payload, null, 2));
                        return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/validate-charge", payload, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    "Content-Type": "application/json",
                                    Accept: "application/json",
                                    "User-Agent": "CustomerService/1.0"
                                }
                            })];
                    case 2:
                        response = _b.sent();
                        console.log("Flutterwave Authorization Response:", JSON.stringify(response.data, null, 2));
                        if (response.data.status !== "success") {
                            throw new Error("Authorization failed: " + (response.data.message || "Unknown error"));
                        }
                        status = client_1.TransactionStatus.PENDING;
                        paymentDetails = (payment.paymentDetails && typeof payment.paymentDetails === "object") ? __assign({}, payment.paymentDetails) : {};
                        if (!(response.data.data.charge_response_code === "00")) return [3 /*break*/, 5];
                        status = client_1.TransactionStatus.COMPLETED;
                        if (!(payment.productType === "wallet_topup")) return [3 /*break*/, 4];
                        creditAmount = payment.requestedAmount != null ? payment.requestedAmount : payment.amount;
                        return [4 /*yield*/, this.creditWallet(payment.userId, creditAmount, transactionRef)];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        if (response.data.data.charge_response_code === "02") {
                            paymentDetails = __assign(__assign({}, paymentDetails), { flwRef: response.data.data.flw_ref, chargeResponseCode: response.data.data.charge_response_code, status: response.data.data.status });
                        }
                        else {
                            status = client_1.TransactionStatus.FAILED;
                            throw new Error("Unexpected charge response code: " + response.data.data.charge_response_code);
                        }
                        _b.label = 6;
                    case 6: return [4 /*yield*/, db_1["default"].payment.update({
                            where: { transactionRef: transactionRef },
                            data: {
                                status: status,
                                paymentDetails: paymentDetails,
                                flwRef: response.data.data.flw_ref || resolvedFlwRef
                            }
                        })];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: "CARD_AUTHORIZATION",
                                    entityType: "Payment",
                                    entityId: payment.id,
                                    details: {
                                        transactionRef: transactionRef,
                                        flwRef: resolvedFlwRef,
                                        status: status,
                                        authorizationType: authorizationData.otp ? "OTP" : authorizationData.pin ? "PIN" : "ADDRESS"
                                    }
                                }
                            })];
                    case 8:
                        _b.sent();
                        console.log("Card payment authorized: " + transactionRef + " - Status: " + status);
                        return [2 /*return*/, {
                                transactionId: transactionRef,
                                status: status,
                                paymentDetails: paymentDetails
                            }];
                    case 9:
                        error_4 = _b.sent();
                        console.error("Card Authorization Error:", {
                            message: error_4.message,
                            transactionRef: transactionRef,
                            flwRef: flwRef,
                            response: (_a = error_4.response) === null || _a === void 0 ? void 0 : _a.data
                        });
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionRef },
                                data: { status: client_1.TransactionStatus.FAILED }
                            })];
                    case 10:
                        _b.sent();
                        throw new Error("Card authorization failed: " + error_4.message);
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.initiateTransferPayment = function (transactionRef, amount, userId, productType, // Accept string
    clientIp) {
        var _a, _b;
        return __awaiter(this, void 0, Promise, function () {
            var user_1, customerEmail_1, customerFullName_1, totalAmount_1, attemptTransfer, transferResponse, error_5, retryError_1, auth, paymentDetails, finalAmount, mailOptions, emailError_1, error_6;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 15, , 16]);
                        console.log("\uD83D\uDD39 Initiating " + productType + " bank transfer payment...");
                        console.log("Amount sent to Flutterwave: " + amount);
                        return [4 /*yield*/, db_1["default"].user.findUnique({ where: { id: userId } })];
                    case 1:
                        user_1 = _c.sent();
                        if (!user_1)
                            throw new Error("User not found");
                        customerEmail_1 = user_1.email || "fallback@example.com";
                        customerFullName_1 = user_1.name || "Customer";
                        totalAmount_1 = amount;
                        attemptTransfer = function (retry) {
                            if (retry === void 0) { retry = false; }
                            return __awaiter(_this, void 0, Promise, function () {
                                var response;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/charges?type=bank_transfer", {
                                                amount: totalAmount_1,
                                                email: customerEmail_1,
                                                currency: "NGN",
                                                tx_ref: transactionRef,
                                                fullname: customerFullName_1,
                                                phone_number: user_1.phoneNumber || process.env.CUSTOMER_PHONE || "07033002245",
                                                client_ip: clientIp || "unknown",
                                                device_fingerprint: "DEVICE-" + uuid_1.v4(),
                                                narration: (productType === "wallet_topup" ? "Wallet Top-Up" : productType) + " Payment to Quicrefil",
                                                is_permanent: false
                                            }, {
                                                headers: {
                                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                                    "Content-Type": "application/json"
                                                }
                                            })];
                                        case 1:
                                            response = _b.sent();
                                            if (response.data.status !== "success" || !((_a = response.data.meta) === null || _a === void 0 ? void 0 : _a.authorization)) {
                                                throw new Error("Bank transfer failed: " + (response.data.message || "No authorization data"));
                                            }
                                            return [2 /*return*/, response.data];
                                    }
                                });
                            });
                        };
                        transferResponse = void 0;
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 9]);
                        return [4 /*yield*/, attemptTransfer()];
                    case 3:
                        transferResponse = _c.sent();
                        return [3 /*break*/, 9];
                    case 4:
                        error_5 = _c.sent();
                        console.warn("Initial bank transfer attempt failed:", error_5.message);
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        console.log("🔄 Retrying bank transfer with fallback...");
                        return [4 /*yield*/, attemptTransfer(true)];
                    case 6:
                        transferResponse = _c.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        retryError_1 = _c.sent();
                        console.error("Retry failed:", retryError_1.message);
                        throw new Error("Bank transfer initiation failed after retry: " + retryError_1.message);
                    case 8: return [3 /*break*/, 9];
                    case 9:
                        console.log("Flutterwave Response:", JSON.stringify(transferResponse, null, 2));
                        auth = transferResponse.meta.authorization;
                        paymentDetails = {
                            account_number: auth.transfer_account,
                            bank_name: auth.transfer_bank,
                            expires: auth.account_expiration,
                            narration: auth.transfer_note,
                            transfer_reference: auth.transfer_reference,
                            transfer_amount: auth.transfer_amount
                        };
                        if (!paymentDetails.account_number || !paymentDetails.bank_name) {
                            throw new Error("Invalid bank transfer response: Missing account_number or bank_name");
                        }
                        finalAmount = parseFloat(paymentDetails.transfer_amount);
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionRef },
                                data: {
                                    amount: finalAmount,
                                    paymentDetails: paymentDetails,
                                    status: client_1.TransactionStatus.PENDING
                                }
                            })];
                    case 10:
                        _c.sent();
                        _c.label = 11;
                    case 11:
                        _c.trys.push([11, 13, , 14]);
                        mailOptions = {
                            from: "Quicrefil <astralearnia@gmail.com>",
                            to: customerEmail_1,
                            subject: "Your Quicrefil " + (productType === "wallet_topup" ? "Wallet Top-Up" : productType) + " Payment Details",
                            html: "\n          <!DOCTYPE html>\n          <html>\n          <head>\n          <meta charset=\"UTF-8\">\n          <title>Your Quicrefil " + (productType === "wallet_topup" ? "Wallet Top-Up" : productType) + " Payment</title>\n          </head>\n          <body style=\"margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;\">\n          <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color: #f4f4f4; padding: 20px;\">\n          <tr>\n          <td align=\"center\">\n          <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);\">\n          <tr>\n          <td style=\"padding: 20px; text-align: center;\">\n          <img src=\"https://via.placeholder.com/150x50?text=Quicrefil+Logo\" alt=\"Quicrefil Logo\" style=\"max-width: 150px; height: auto;\" />\n          </td>\n          </tr>\n          <tr>\n          <td style=\"padding: 0 20px 20px;\">\n          <h2 style=\"color: #2c3e50; font-size: 24px; margin: 0 0 10px;\">Hello " + customerFullName_1 + ",</h2>\n          <p style=\"color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;\">Please make your payment to the bank account below to complete your " + (productType === "wallet_topup" ? "wallet top-up" : productType) + " order.</p>\n          <table width=\"100%\" cellpadding=\"10\" cellspacing=\"0\" border=\"0\" style=\"background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;\">\n          <tr>\n          <td style=\"color: #555555; font-size: 16px;\">\n          <strong>Transaction Ref:</strong> " + transactionRef + "<br>\n          <strong>Account Number:</strong> <span style=\"color: #e74c3c; font-size: 18px; font-weight: bold;\">" + paymentDetails.account_number + "</span><br>\n          <strong>Bank Name:</strong> " + paymentDetails.bank_name + "<br>\n          <strong>Amount:</strong> \u20A6" + paymentDetails.transfer_amount + "<br>\n          <strong>Narration:</strong> " + paymentDetails.narration + "<br>\n          <strong>Expires:</strong> " + paymentDetails.expires + "<br>\n          </td>\n          </tr>\n          </table>\n          <p style=\"color: #555555; font-size: 16px; margin: 0 0 15px;\">Ensure you include the narration in your transfer. This account is valid until " + paymentDetails.expires + ".</p>\n          <p style=\"color: #555555; font-size: 16px; margin: 15px 0;\"><strong>Total Amount:</strong> \u20A6" + finalAmount.toFixed(2) + "</p>\n          </td>\n          </tr>\n          <tr>\n          <td style=\"padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;\">\n          <p style=\"font-size: 14px; margin: 0 0 5px;\">Best regards,<br><strong>The Quicrefil Support Team</strong></p>\n          <p style=\"font-size: 12px; margin: 0;\">\u00A9 2025 Quicrefil. All rights reserved.</p>\n          </td>\n          </tr>\n          </table>\n          </td>\n          </tr>\n          </table>\n          </body>\n          </html>\n        "
                        };
                        return [4 /*yield*/, transporter.sendMail(mailOptions)];
                    case 12:
                        _c.sent();
                        console.log("Bank transfer email sent to " + customerEmail_1);
                        return [3 /*break*/, 14];
                    case 13:
                        emailError_1 = _c.sent();
                        console.error("Failed to send bank transfer email:", {
                            message: emailError_1.message,
                            userId: userId,
                            transactionRef: transactionRef
                        });
                        return [3 /*break*/, 14];
                    case 14:
                        console.log("Bank Transfer Payment Initiated Successfully:", paymentDetails);
                        return [2 /*return*/, {
                                transactionId: transactionRef,
                                paymentDetails: paymentDetails,
                                status: client_1.TransactionStatus.PENDING
                            }];
                    case 15:
                        error_6 = _c.sent();
                        console.error("Bank Transfer Payment Initiation Error:", {
                            message: error_6.message,
                            response: (_a = error_6.response) === null || _a === void 0 ? void 0 : _a.data,
                            status: (_b = error_6.response) === null || _b === void 0 ? void 0 : _b.status,
                            userId: userId,
                            transactionRef: transactionRef
                        });
                        throw new Error("Bank transfer initiation failed: " + error_6.message);
                    case 16: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.handleWalletPayment = function (userId, amount, transactionRef) {
        return __awaiter(this, void 0, Promise, function () {
            var wallet, amountDecimal, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log("Handling wallet payment for user " + userId + " with amount " + amount + " and transactionRef " + transactionRef);
                        return [4 /*yield*/, db_1["default"].wallet.findUnique({ where: { userId: userId } })];
                    case 1:
                        wallet = _a.sent();
                        if (!wallet)
                            throw new Error("Wallet not found for user");
                        amountDecimal = new library_1.Decimal(amount);
                        if (wallet.balance.lessThan(amountDecimal))
                            throw new Error("Insufficient wallet balance");
                        return [4 /*yield*/, db_1["default"].$transaction([
                                db_1["default"].wallet.update({
                                    where: { userId: userId },
                                    data: { balance: { decrement: amount } }
                                }),
                                db_1["default"].payment.update({
                                    where: { transactionRef: transactionRef },
                                    data: { status: client_1.TransactionStatus.COMPLETED }
                                }),
                                db_1["default"].walletTransaction.create({
                                    data: {
                                        id: uuid_1.v4(),
                                        userId: userId,
                                        walletId: wallet.id,
                                        transactionType: client_1.TransactionType.DEDUCTION,
                                        amount: new library_1.Decimal(amount),
                                        paymentId: transactionRef,
                                        status: client_1.TransactionStatus.COMPLETED
                                    }
                                }),
                            ])];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, {
                                transactionId: transactionRef,
                                status: client_1.TransactionStatus.COMPLETED
                            }];
                    case 3:
                        error_7 = _a.sent();
                        console.error("Wallet Payment Error:", {
                            message: error_7.message,
                            userId: userId,
                            transactionRef: transactionRef
                        });
                        throw new Error("Wallet payment failed: " + error_7.message);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.handlePayOnDelivery = function (userId, transactionRef) {
        return __awaiter(this, void 0, Promise, function () {
            var payment, totalAmount, confirmationCode, user, customerEmail, customerName, paymentTitle, paymentLink, response, error_8, paymentDetails, mailOptions, emailError_2, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 12, , 13]);
                        console.log("Processing Pay on Delivery for transaction " + transactionRef + "...");
                        return [4 /*yield*/, db_1["default"].payment.findUnique({ where: { transactionRef: transactionRef } })];
                    case 1:
                        payment = _a.sent();
                        if (!payment)
                            throw new Error("Payment record not found.");
                        totalAmount = payment.amount;
                        confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
                        return [4 /*yield*/, db_1["default"].user.findUnique({ where: { id: userId } })];
                    case 2:
                        user = _a.sent();
                        if (!user)
                            throw new Error("User not found");
                        customerEmail = user.email || "fallback@example.com";
                        customerName = user.name || "Customer";
                        paymentTitle = "Pay on Delivery - Digital Option";
                        paymentLink = void 0;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, axios_1["default"].post("https://api.flutterwave.com/v3/payments", {
                                tx_ref: transactionRef,
                                amount: totalAmount,
                                currency: "NGN",
                                redirect_url: (process.env.FRONTEND_URL || "http://localhost:5000") + "/api/payments/callback",
                                customer: { email: customerEmail, name: customerName },
                                customizations: { title: paymentTitle }
                            }, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    "Content-Type": "application/json"
                                }
                            })];
                    case 4:
                        response = _a.sent();
                        if (response.data.status === "success") {
                            paymentLink = response.data.data.link;
                        }
                        else {
                            console.warn("Failed to generate payment link:", response.data.message);
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        error_8 = _a.sent();
                        console.warn("Payment link generation failed:", {
                            message: error_8.message,
                            transactionRef: transactionRef
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        paymentDetails = { confirmationCode: confirmationCode, paymentLink: paymentLink };
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionRef },
                                data: {
                                    status: client_1.TransactionStatus.PENDING,
                                    paymentDetails: paymentDetails
                                }
                            })];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8:
                        _a.trys.push([8, 10, , 11]);
                        mailOptions = {
                            from: "Quicrefil <astralearnia@gmail.com>",
                            to: customerEmail,
                            subject: "Your Quicrefil Pay on Delivery Confirmation",
                            html: "\n            <!DOCTYPE html>\n            <html>\n            <head>\n            <meta charset=\"UTF-8\">\n            <title>Your Quicrefil Pay on Delivery Confirmation</title>\n            </head>\n            <body style=\"margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;\">\n            <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color: #f4f4f4; padding: 20px;\">\n            <tr>\n            <td align=\"center\">\n            <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);\">\n            <tr>\n            <td style=\"padding: 20px; text-align: center;\">\n            <img src=\"https://via.placeholder.com/150x50?text=Quicrefil+Logo\" alt=\"Quicrefil Logo\" style=\"max-width: 150px; height: auto;\" />\n            </td>\n            </tr>\n            <tr>\n            <td style=\"padding: 0 20px 20px;\">\n            <h2 style=\"color: #2c3e50; font-size: 24px; margin: 0 0 10px;\">Hello " + customerName + ",</h2>\n            <p style=\"color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;\">Thank you for choosing Quicrefil! Your order is on its way.</p>\n            <table width=\"100%\" cellpadding=\"10\" cellspacing=\"0\" border=\"0\" style=\"background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;\">\n            <tr>\n              <td style=\"padding: 10px; color: #555555; font-size: 16px;\">\n                <strong>Transaction Ref:</strong> " + transactionRef + "<br>\n                <strong>Confirmation Code:</strong> <span style=\"color: #e74c3c; font-size: 20px; font-weight: bold;\">" + confirmationCode + "</span><br>\n                <p style=\"margin: 10px 0;\">Please provide this code to the delivery agent upon arrival.</p>\n              </td>\n            </tr>\n            </table>\n            " + (paymentLink
                                ? "\n            <p style=\"color: #555555; font-size: 16px; margin: 0 0 15px;\">Prefer to pay digitally?</p>\n            <a href=\"" + paymentLink + "\" style=\"display: inline-block; background-color: #3498db; color: #ffffff; font-size: 16px; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Pay Now</a>\n            "
                                : "") + "\n            <p style=\"color: #555555; font-size: 16px; margin: 15px 0;\"><strong>Total Amount:</strong> \u20A6" + totalAmount.toFixed(2) + "</p>\n            </td>\n            </tr>\n            <tr>\n            <td style=\"padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;\">\n            <p style=\"font-size: 14px; margin: 0 0 5px;\">Best regards,<br><strong>The Quicrefil Support Team</strong></p>\n            <p style=\"font-size: 12px; margin: 0;\">\u00A9 2025 Quicrefil. All rights reserved.</p>\n            </td>\n            </tr>\n            </table>\n            </td>\n            </tr>\n            </table>\n            </body>\n            </html>\n          "
                        };
                        return [4 /*yield*/, transporter.sendMail(mailOptions)];
                    case 9:
                        _a.sent();
                        console.log("Confirmation email sent to " + customerEmail);
                        return [3 /*break*/, 11];
                    case 10:
                        emailError_2 = _a.sent();
                        console.error("Failed to send confirmation email:", {
                            message: emailError_2.message,
                            userId: userId,
                            transactionRef: transactionRef
                        });
                        return [3 /*break*/, 11];
                    case 11: return [2 /*return*/, { transactionId: transactionRef, paymentDetails: paymentDetails, status: client_1.TransactionStatus.PENDING }];
                    case 12:
                        error_9 = _a.sent();
                        console.error("Pay on Delivery Error:", {
                            message: error_9.message,
                            userId: userId,
                            transactionRef: transactionRef
                        });
                        throw new Error("Pay on delivery processing failed: " + error_9.message);
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.verifyPayment = function (transactionId) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, Promise, function () {
            var payment, mapToTransactionStatus, currentStatus, flutterwaveMethods, response, paymentData, paymentStatus, currentAmount, verifiedAmount, paymentDetails, creditError_1, flwRef, refundError_1, paymentStatus, paymentDetails, creditError_2, flwRef, refundError_2, error_10, payment;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 36, , 40]);
                        logger_1["default"].info("\uD83D\uDD0D Verifying payment: " + transactionId + "...");
                        return [4 /*yield*/, db_1["default"].payment.findUnique({
                                where: { transactionRef: transactionId },
                                include: { provider: true }
                            })];
                    case 1:
                        payment = _e.sent();
                        if (!payment)
                            throw new Error("Payment not found.");
                        mapToTransactionStatus = function (status) {
                            switch (status.toLowerCase()) {
                                case 'completed':
                                    return client_1.TransactionStatus.COMPLETED;
                                case 'pending':
                                    return client_1.TransactionStatus.PENDING;
                                case 'confirmed':
                                    return client_1.TransactionStatus.CONFIRMED;
                                case 'pending_manual':
                                    return client_1.TransactionStatus.PENDING_MANUAL;
                                case 'pending_delivery':
                                    return client_1.TransactionStatus.PENDING_DELIVERY;
                                case 'cancelled':
                                    return client_1.TransactionStatus.CANCELLED;
                                case 'failed':
                                    return client_1.TransactionStatus.FAILED;
                                case 'refunded':
                                    return client_1.TransactionStatus.REFUND;
                                default:
                                    return client_1.TransactionStatus.FAILED;
                            }
                        };
                        currentStatus = mapToTransactionStatus(payment.status);
                        if ([
                            client_1.TransactionStatus.COMPLETED,
                            client_1.TransactionStatus.CONFIRMED,
                            client_1.TransactionStatus.REFUND
                        ].map(String).includes(String(currentStatus))) {
                            logger_1["default"].info("Payment already " + currentStatus.toLowerCase() + ": " + transactionId);
                            return [2 /*return*/, {
                                    status: currentStatus,
                                    transactionId: transactionId,
                                    amount: payment.amount
                                }];
                        }
                        flutterwaveMethods = ["FLUTTERWAVE", "CARD", "TRANSFER"];
                        if (!flutterwaveMethods.includes(payment.paymentMethod)) return [3 /*break*/, 20];
                        if (!payment.provider || payment.provider.name.toLowerCase() !== "flutterwave") {
                            throw new Error("Invalid payment provider for Flutterwave verification");
                        }
                        return [4 /*yield*/, axios_1["default"].get("https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=" + transactionId, {
                                headers: { Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY },
                                timeout: 10000
                            })];
                    case 2:
                        response = _e.sent();
                        paymentData = response.data.data;
                        logger_1["default"].info("Verification Response:", JSON.stringify(paymentData, null, 2));
                        paymentStatus = void 0;
                        switch (paymentData.status.toLowerCase()) {
                            case "successful":
                                paymentStatus = client_1.TransactionStatus.COMPLETED;
                                break;
                            case "pending":
                                paymentStatus = client_1.TransactionStatus.PENDING;
                                break;
                            case "confirmed":
                                paymentStatus = client_1.TransactionStatus.CONFIRMED;
                                break;
                            case "cancelled":
                                paymentStatus = client_1.TransactionStatus.CANCELLED;
                                break;
                            case "failed":
                            default:
                                paymentStatus = client_1.TransactionStatus.FAILED;
                        }
                        currentAmount = payment.amount;
                        verifiedAmount = paymentData.amount;
                        if (!(currentAmount !== verifiedAmount)) return [3 /*break*/, 4];
                        logger_1["default"].warn("Amount mismatch: Database=" + currentAmount + ", Flutterwave=" + verifiedAmount);
                        return [4 /*yield*/, db_1["default"].fraudAlert.create({
                                data: {
                                    id: uuid_1.v4(),
                                    type: "AMOUNT_MISMATCH",
                                    entityId: payment.id,
                                    entityType: "Payment",
                                    reason: "Payment amount mismatch: Database=" + currentAmount + ", Flutterwave=" + verifiedAmount,
                                    userId: payment.userId
                                }
                            })];
                    case 3:
                        _e.sent();
                        _e.label = 4;
                    case 4: return [4 /*yield*/, db_1["default"].payment.update({
                            where: { transactionRef: transactionId },
                            data: {
                                status: paymentStatus,
                                updatedAt: new Date(),
                                flwRef: paymentData.id ? String(paymentData.id) : (_a = payment.flwRef) !== null && _a !== void 0 ? _a : undefined
                            }
                        })];
                    case 5:
                        _e.sent();
                        paymentDetails = payment.paymentDetails && typeof payment.paymentDetails === 'object'
                            ? payment.paymentDetails
                            : null;
                        if (!(paymentStatus === client_1.TransactionStatus.COMPLETED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === "wallet_topup")) return [3 /*break*/, 11];
                        _e.label = 6;
                    case 6:
                        _e.trys.push([6, 8, , 10]);
                        return [4 /*yield*/, this.creditWallet(payment.userId, currentAmount, transactionId)];
                    case 7:
                        _e.sent();
                        return [3 /*break*/, 10];
                    case 8:
                        creditError_1 = _e.sent();
                        logger_1["default"].error("Failed to credit wallet after successful verification:", {
                            message: creditError_1.message,
                            transactionId: transactionId,
                            userId: payment.userId
                        });
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: "WALLET_CREDIT_FAILED",
                                    entityType: "PAYMENT",
                                    entityId: payment.id,
                                    details: JSON.stringify({
                                        error: creditError_1.message,
                                        transactionRef: transactionId,
                                        amount: currentAmount
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 9:
                        _e.sent();
                        throw creditError_1;
                    case 10: return [3 /*break*/, 18];
                    case 11:
                        if (!(paymentStatus === client_1.TransactionStatus.FAILED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === "wallet_topup")) return [3 /*break*/, 18];
                        _e.label = 12;
                    case 12:
                        _e.trys.push([12, 15, , 18]);
                        flwRef = (_b = payment.flwRef) !== null && _b !== void 0 ? _b : undefined;
                        return [4 /*yield*/, this.processRefund(transactionId, payment.userId, currentAmount, flwRef)];
                    case 13:
                        _e.sent();
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionId },
                                data: {
                                    status: client_1.TransactionStatus.REFUND,
                                    updatedAt: new Date()
                                }
                            })];
                    case 14:
                        _e.sent();
                        paymentStatus = client_1.TransactionStatus.REFUND;
                        return [3 /*break*/, 18];
                    case 15:
                        refundError_1 = _e.sent();
                        logger_1["default"].error("Failed to process refund after failed verification:", {
                            message: refundError_1.message,
                            transactionId: transactionId,
                            userId: payment.userId
                        });
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: "REFUND_FAILED",
                                    entityType: "PAYMENT",
                                    entityId: payment.id,
                                    details: JSON.stringify({
                                        error: refundError_1.message,
                                        transactionRef: transactionId,
                                        amount: currentAmount
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 16:
                        _e.sent();
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionId },
                                data: {
                                    status: client_1.TransactionStatus.FAILED,
                                    updatedAt: new Date()
                                }
                            })];
                    case 17:
                        _e.sent();
                        throw refundError_1;
                    case 18: return [4 /*yield*/, db_1["default"].auditLog.create({
                            data: {
                                id: uuid_1.v4(),
                                userId: payment.userId,
                                action: "PAYMENT_VERIFIED",
                                entityType: "PAYMENT",
                                entityId: payment.id,
                                details: JSON.stringify({
                                    transactionRef: transactionId,
                                    status: paymentStatus,
                                    amount: currentAmount
                                }),
                                createdAt: new Date()
                            }
                        })];
                    case 19:
                        _e.sent();
                        return [2 /*return*/, {
                                status: paymentStatus,
                                transactionId: transactionId,
                                amount: currentAmount
                            }];
                    case 20:
                        paymentStatus = mapToTransactionStatus(payment.status);
                        paymentDetails = payment.paymentDetails && typeof payment.paymentDetails === 'object'
                            ? payment.paymentDetails
                            : null;
                        if (!(paymentStatus === client_1.TransactionStatus.COMPLETED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === "wallet_topup")) return [3 /*break*/, 26];
                        _e.label = 21;
                    case 21:
                        _e.trys.push([21, 23, , 25]);
                        return [4 /*yield*/, this.creditWallet(payment.userId, payment.amount, transactionId)];
                    case 22:
                        _e.sent();
                        return [3 /*break*/, 25];
                    case 23:
                        creditError_2 = _e.sent();
                        logger_1["default"].error("Failed to credit wallet after verification:", {
                            message: creditError_2.message,
                            transactionId: transactionId,
                            userId: payment.userId
                        });
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: "WALLET_CREDIT_FAILED",
                                    entityType: "PAYMENT",
                                    entityId: payment.id,
                                    details: JSON.stringify({
                                        error: creditError_2.message,
                                        transactionRef: transactionId,
                                        amount: payment.amount
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 24:
                        _e.sent();
                        throw creditError_2;
                    case 25: return [3 /*break*/, 33];
                    case 26:
                        if (!(paymentStatus === client_1.TransactionStatus.FAILED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === "wallet_topup")) return [3 /*break*/, 33];
                        _e.label = 27;
                    case 27:
                        _e.trys.push([27, 30, , 33]);
                        flwRef = (_c = payment.flwRef) !== null && _c !== void 0 ? _c : undefined;
                        return [4 /*yield*/, this.processRefund(transactionId, payment.userId, payment.amount, flwRef)];
                    case 28:
                        _e.sent();
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionId },
                                data: {
                                    status: client_1.TransactionStatus.REFUND,
                                    updatedAt: new Date()
                                }
                            })];
                    case 29:
                        _e.sent();
                        paymentStatus = client_1.TransactionStatus.REFUND;
                        return [3 /*break*/, 33];
                    case 30:
                        refundError_2 = _e.sent();
                        logger_1["default"].error("Failed to process refund after failed verification:", {
                            message: refundError_2.message,
                            transactionId: transactionId,
                            userId: payment.userId
                        });
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: "REFUND_FAILED",
                                    entityType: "PAYMENT",
                                    entityId: payment.id,
                                    details: JSON.stringify({
                                        error: refundError_2.message,
                                        transactionRef: transactionId,
                                        amount: payment.amount
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 31:
                        _e.sent();
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionId },
                                data: {
                                    status: client_1.TransactionStatus.FAILED,
                                    updatedAt: new Date()
                                }
                            })];
                    case 32:
                        _e.sent();
                        throw refundError_2;
                    case 33: return [4 /*yield*/, db_1["default"].auditLog.create({
                            data: {
                                id: uuid_1.v4(),
                                userId: payment.userId,
                                action: "PAYMENT_VERIFIED",
                                entityType: "PAYMENT",
                                entityId: payment.id,
                                details: JSON.stringify({
                                    transactionRef: transactionId,
                                    status: paymentStatus,
                                    amount: payment.amount
                                }),
                                createdAt: new Date()
                            }
                        })];
                    case 34:
                        _e.sent();
                        return [2 /*return*/, {
                                status: paymentStatus,
                                transactionId: transactionId,
                                amount: payment.amount
                            }];
                    case 35: return [3 /*break*/, 40];
                    case 36:
                        error_10 = _e.sent();
                        logger_1["default"].error("Payment Verification Error:", {
                            message: error_10.message,
                            response: (_d = error_10 === null || error_10 === void 0 ? void 0 : error_10.response) === null || _d === void 0 ? void 0 : _d.data,
                            transactionId: transactionId,
                            stack: error_10.stack
                        });
                        return [4 /*yield*/, db_1["default"].payment.findUnique({
                                where: { transactionRef: transactionId }
                            })];
                    case 37:
                        payment = _e.sent();
                        if (!payment) return [3 /*break*/, 39];
                        logger_1["default"].info("Creating audit log for PAYMENT_VERIFICATION_FAILED: entityType=PAYMENT, entityId=" + payment.id);
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: "PAYMENT_VERIFICATION_FAILED",
                                    entityType: "PAYMENT",
                                    entityId: payment.id,
                                    details: JSON.stringify({
                                        error: error_10.message,
                                        transactionRef: transactionId,
                                        stack: error_10.stack
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 38:
                        _e.sent();
                        _e.label = 39;
                    case 39: throw error_10;
                    case 40: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.verifyWebhook = function (req) {
        var _a, _b, _c, _d, _e, _f, _g;
        return __awaiter(this, void 0, Promise, function () {
            var txRef, _h, tx_ref, status, amount, transaction_id, eventType, redis, idempotencyKey, isProcessed, payment, paymentStatus, paymentDetails, creditAmount, flwRef, error_11, tx_ref, payment;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        _j.trys.push([0, 13, , 18]);
                        txRef = (_a = req.body.data) === null || _a === void 0 ? void 0 : _a.tx_ref;
                        logger_1["default"].info('Processing Flutterwave webhook', {
                            tx_ref: txRef || 'unknown',
                            webhookUrl: "" + process.env.WEBHOOK_URL,
                            eventType: req.body['event.type'],
                            rawBodyLength: ((_b = req.rawBody) === null || _b === void 0 ? void 0 : _b.length) || 0,
                            headers: req.headers
                        });
                        if (req.aborted) {
                            logger_1["default"].warn('Webhook request aborted by client', { tx_ref: txRef });
                            throw new Error('Webhook request aborted');
                        }
                        if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
                            logger_1["default"].error('Raw body is missing or not a Buffer', {
                                headers: req.headers,
                                body: req.body,
                                rawBodyType: typeof req.rawBody,
                                rawBodyLength: ((_c = req.rawBody) === null || _c === void 0 ? void 0 : _c.length) || 0
                            });
                            throw new Error('Raw body is missing or invalid');
                        }
                        if (!paymentUtils_1.validateFlutterwaveSignature(req)) {
                            logger_1["default"].error('Invalid webhook signature', {
                                headers: req.headers,
                                body: req.body,
                                rawBody: req.rawBody.toString('utf8'),
                                webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET ? 'set' : 'missing'
                            });
                            throw new Error('Invalid webhook signature');
                        }
                        _h = req.body.data, tx_ref = _h.tx_ref, status = _h.status, amount = _h.amount, transaction_id = _h.transaction_id;
                        eventType = req.body['event.type'];
                        if (!tx_ref || !status || !['BANK_TRANSFER', 'BANK_TRANSFERWEBHOOK', 'BANK_TRANSFER_TRANSACTION'].includes(eventType)) {
                            logger_1["default"].error('Missing tx_ref, status, or invalid event.type', {
                                data: req.body.data,
                                eventType: eventType,
                                rawBody: req.rawBody.toString('utf8')
                            });
                            throw new Error('Missing tx_ref, status, or invalid event.type in webhook payload');
                        }
                        redis = redis_1.getRedisClient();
                        idempotencyKey = "flutterwaveWebhook:" + tx_ref;
                        return [4 /*yield*/, redis.get(idempotencyKey)];
                    case 1:
                        isProcessed = _j.sent();
                        if (isProcessed) {
                            logger_1["default"].info("Webhook already processed for " + tx_ref);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, db_1["default"].payment.findUnique({
                                where: { transactionRef: tx_ref },
                                include: { walletTransactions: true }
                            })];
                    case 2:
                        payment = _j.sent();
                        if (!payment) {
                            logger_1["default"].error("Payment not found for transactionRef: " + tx_ref);
                            throw new Error('Payment not found for webhook');
                        }
                        if (!(payment.status === client_1.TransactionStatus.COMPLETED)) return [3 /*break*/, 4];
                        logger_1["default"].info("Payment already completed: " + tx_ref);
                        return [4 /*yield*/, redis.setEx(idempotencyKey, 3600, 'processed')];
                    case 3:
                        _j.sent();
                        return [2 /*return*/];
                    case 4:
                        paymentStatus = void 0;
                        switch (status.toLowerCase()) {
                            case 'successful':
                                paymentStatus = client_1.TransactionStatus.COMPLETED;
                                break;
                            case 'pending':
                                paymentStatus = client_1.TransactionStatus.PENDING;
                                break;
                            case 'cancelled':
                                paymentStatus = client_1.TransactionStatus.CANCELLED;
                                break;
                            case 'failed':
                                paymentStatus = client_1.TransactionStatus.FAILED;
                                break;
                            default:
                                paymentStatus = client_1.TransactionStatus.FAILED;
                        }
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: tx_ref },
                                data: {
                                    status: paymentStatus,
                                    updatedAt: new Date(),
                                    flwRef: transaction_id || payment.flwRef
                                }
                            })];
                    case 5:
                        _j.sent();
                        paymentDetails = payment.paymentDetails;
                        if (!(paymentStatus === client_1.TransactionStatus.COMPLETED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === 'wallet_topup')) return [3 /*break*/, 7];
                        creditAmount = (_d = payment.requestedAmount) !== null && _d !== void 0 ? _d : amount;
                        return [4 /*yield*/, this.creditWallet(payment.userId, creditAmount, tx_ref)];
                    case 6:
                        _j.sent();
                        return [3 /*break*/, 10];
                    case 7:
                        if (!(paymentStatus === client_1.TransactionStatus.FAILED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === 'wallet_topup')) return [3 /*break*/, 10];
                        flwRef = (_e = payment.flwRef) !== null && _e !== void 0 ? _e : undefined;
                        return [4 /*yield*/, this.processRefund(tx_ref, payment.userId, amount, transaction_id !== null && transaction_id !== void 0 ? transaction_id : flwRef)];
                    case 8:
                        _j.sent();
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: tx_ref },
                                data: { status: client_1.TransactionStatus.REFUND }
                            })];
                    case 9:
                        _j.sent();
                        _j.label = 10;
                    case 10: return [4 /*yield*/, db_1["default"].auditLog.create({
                            data: {
                                id: uuid_1.v4(),
                                userId: payment.userId,
                                action: 'WEBHOOK_UPDATE',
                                entityType: 'Payment',
                                entityId: payment.id,
                                details: {
                                    status: paymentStatus,
                                    webhookData: req.body.data,
                                    creditAmount: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === 'wallet_topup' && paymentStatus === client_1.TransactionStatus.COMPLETED
                                        ? payment.requestedAmount
                                        : undefined,
                                    refundInitiated: paymentStatus === client_1.TransactionStatus.FAILED
                                },
                                createdAt: new Date()
                            }
                        })];
                    case 11:
                        _j.sent();
                        return [4 /*yield*/, redis.setEx(idempotencyKey, 3600, 'processed')];
                    case 12:
                        _j.sent();
                        logger_1["default"].info("Webhook processed: " + tx_ref + " - Status: " + paymentStatus);
                        return [3 /*break*/, 18];
                    case 13:
                        error_11 = _j.sent();
                        logger_1["default"].error('Webhook Processing Error', {
                            message: error_11.message,
                            webhookData: req.body.data,
                            rawBody: ((_f = req.rawBody) === null || _f === void 0 ? void 0 : _f.toString('utf8')) || 'undefined',
                            stack: error_11.stack
                        });
                        tx_ref = (_g = req.body.data) === null || _g === void 0 ? void 0 : _g.tx_ref;
                        if (!tx_ref) return [3 /*break*/, 17];
                        return [4 /*yield*/, db_1["default"].payment.findUnique({ where: { transactionRef: tx_ref } })];
                    case 14:
                        payment = _j.sent();
                        if (!payment) return [3 /*break*/, 17];
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: payment.userId,
                                    action: 'WEBHOOK_FAILED',
                                    entityType: 'Payment',
                                    entityId: payment.id,
                                    details: {
                                        error: error_11.message,
                                        webhookData: req.body.data
                                    },
                                    createdAt: new Date()
                                }
                            })];
                    case 15:
                        _j.sent();
                        if (!(error_11.message !== 'Invalid webhook signature' && error_11.message !== 'Webhook request aborted')) return [3 /*break*/, 17];
                        return [4 /*yield*/, this.scheduleWebhookRetry(tx_ref)];
                    case 16:
                        _j.sent();
                        _j.label = 17;
                    case 17: throw error_11;
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.handlePaymentCallback = function (req, res) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var _b, status, tx_ref, transaction_id, payment, paymentStatus, paymentDetails, creditAmount, error_12;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = req.query, status = _b.status, tx_ref = _b.tx_ref, transaction_id = _b.transaction_id;
                        logger_1["default"].info('Processing payment callback', {
                            status: status,
                            tx_ref: tx_ref,
                            transaction_id: transaction_id,
                            query: req.query
                        });
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 7, , 8]);
                        if (!tx_ref || !status) {
                            logger_1["default"].error('Missing tx_ref or status in callback', { query: req.query });
                            return [2 /*return*/, res.redirect(process.env.FRONTEND_URL + "/payment?status=error&message=Missing%20transaction%20details")];
                        }
                        return [4 /*yield*/, db_1["default"].payment.findUnique({
                                where: { transactionRef: tx_ref }
                            })];
                    case 2:
                        payment = _c.sent();
                        if (!payment) {
                            logger_1["default"].error("Payment not found for transactionRef: " + tx_ref);
                            return [2 /*return*/, res.redirect(process.env.FRONTEND_URL + "/payment?status=error&message=Payment%20not%20found")];
                        }
                        paymentStatus = void 0;
                        switch (status.toLowerCase()) {
                            case 'completed':
                            case 'successful':
                                paymentStatus = client_1.TransactionStatus.COMPLETED;
                                break;
                            case 'cancelled':
                                paymentStatus = client_1.TransactionStatus.CANCELLED;
                                break;
                            case 'failed':
                                paymentStatus = client_1.TransactionStatus.FAILED;
                                break;
                            default:
                                paymentStatus = client_1.TransactionStatus.PENDING;
                        }
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: tx_ref },
                                data: {
                                    status: paymentStatus,
                                    flwRef: transaction_id || payment.flwRef,
                                    updatedAt: new Date()
                                }
                            })];
                    case 3:
                        _c.sent();
                        paymentDetails = payment.paymentDetails;
                        if (!(paymentStatus === client_1.TransactionStatus.COMPLETED && (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.paymentType) === 'wallet_topup')) return [3 /*break*/, 5];
                        creditAmount = (_a = payment.requestedAmount) !== null && _a !== void 0 ? _a : payment.amount;
                        return [4 /*yield*/, this.creditWallet(payment.userId, creditAmount, tx_ref)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5: return [4 /*yield*/, db_1["default"].auditLog.create({
                            data: {
                                id: uuid_1.v4(),
                                userId: payment.userId,
                                action: 'CALLBACK_PROCESSED',
                                entityType: 'Payment',
                                entityId: payment.id,
                                details: {
                                    status: paymentStatus,
                                    callbackData: req.query
                                },
                                createdAt: new Date()
                            }
                        })];
                    case 6:
                        _c.sent();
                        logger_1["default"].info("Payment callback processed: " + tx_ref + " - Status: " + paymentStatus);
                        res.redirect(process.env.FRONTEND_URL + "/payment?status=" + status);
                        return [3 /*break*/, 8];
                    case 7:
                        error_12 = _c.sent();
                        logger_1["default"].error('Payment callback processing error', {
                            message: error_12.message,
                            tx_ref: tx_ref,
                            stack: error_12.stack
                        });
                        res.redirect(process.env.FRONTEND_URL + "/payment?status=error&message=Server%20error");
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.processRefund = function (transactionRef, userId, amount, flwTransactionId) {
        var _a, _b;
        return __awaiter(this, void 0, Promise, function () {
            var payment, transactionId, response, existingPaymentDetails, user, mailOptions, emailError_3, error_13;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 10, , 12]);
                        logger_1["default"].info("Initiating refund for transaction: " + transactionRef, {
                            userId: userId,
                            amount: amount,
                            flwTransactionId: flwTransactionId
                        });
                        return [4 /*yield*/, db_1["default"].payment.findUnique({
                                where: { transactionRef: transactionRef },
                                include: { provider: true }
                            })];
                    case 1:
                        payment = _c.sent();
                        if (!payment) {
                            throw new Error("Payment not found for transaction: " + transactionRef);
                        }
                        if (payment.status !== client_1.TransactionStatus.FAILED) {
                            throw new Error("Cannot refund transaction " + transactionRef + ": status is " + payment.status);
                        }
                        if (!payment.provider || payment.provider.name.toLowerCase() !== 'flutterwave') {
                            throw new Error('Refunds only supported for Flutterwave payments');
                        }
                        transactionId = flwTransactionId || payment.flwRef;
                        if (!transactionId) {
                            throw new Error("Flutterwave transaction ID or flwRef missing for transaction: " + transactionRef);
                        }
                        return [4 /*yield*/, axios_1["default"].post('https://api.flutterwave.com/v3/refunds', {
                                transaction_id: transactionId,
                                amount: amount
                            }, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 10000
                            })];
                    case 2:
                        response = _c.sent();
                        if (response.data.status !== 'success') {
                            throw new Error("Refund initiation failed: " + response.data.message);
                        }
                        existingPaymentDetails = payment.paymentDetails && typeof payment.paymentDetails === 'object'
                            ? payment.paymentDetails
                            : {};
                        return [4 /*yield*/, db_1["default"].payment.update({
                                where: { transactionRef: transactionRef },
                                data: {
                                    status: client_1.TransactionStatus.REFUND,
                                    paymentDetails: __assign(__assign({}, existingPaymentDetails), { refundId: response.data.data.id, refundStatus: response.data.data.status }),
                                    updatedAt: new Date()
                                }
                            })];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    action: 'REFUND_INITIATED',
                                    entityType: 'Payment',
                                    entityId: payment.id,
                                    details: JSON.stringify({
                                        transactionRef: transactionRef,
                                        flwTransactionId: transactionId,
                                        amount: amount,
                                        refundId: response.data.data.id,
                                        refundStatus: response.data.data.status
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 4:
                        _c.sent();
                        return [4 /*yield*/, db_1["default"].user.findUnique({ where: { id: userId } })];
                    case 5:
                        user = _c.sent();
                        if (!(user && user.email)) return [3 /*break*/, 9];
                        _c.label = 6;
                    case 6:
                        _c.trys.push([6, 8, , 9]);
                        mailOptions = {
                            from: 'Quicrefil <astralearnia@gmail.com>',
                            to: user.email,
                            subject: 'Quicrefil Payment Refund Confirmation',
                            html: "\n            <!DOCTYPE html>\n            <html>\n            <head>\n              <meta charset=\"UTF-8\">\n              <title>Quicrefil Refund Confirmation</title>\n            </head>\n            <body style=\"margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;\">\n              <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color: #f4f4f4; padding: 20px;\">\n                <tr>\n                  <td align=\"center\">\n                    <table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);\">\n                      <tr>\n                        <td style=\"padding: 20px; text-align: center;\">\n                          <img src=\"https://via.placeholder.com/150x50?text=Quicrefil+Logo\" alt=\"Quicrefil Logo\" style=\"max-width: 150px; height: auto;\" />\n                        </td>\n                      </tr>\n                      <tr>\n                        <td style=\"padding: 0 20px 20px;\">\n                          <h2 style=\"color: #2c3e50; font-size: 24px; margin: 0 0 10px;\">Hello " + (user.name || 'Customer') + ",</h2>\n                          <p style=\"color: #555555; font-size: 16px; line-height: 1.5; margin: 0 0 15px;\">We have initiated a refund for your failed payment.</p>\n                          <table width=\"100%\" cellpadding=\"10\" cellspacing=\"0\" border=\"0\" style=\"background-color: #f8f9fa; border-radius: 5px; margin-bottom: 20px;\">\n                            <tr>\n                              <td style=\"padding: 10px; color: #555555; font-size: 16px;\">\n                                <strong>Transaction Ref:</strong> " + transactionRef + "<br>\n                                <strong>Amount:</strong> \u20A6" + amount.toFixed(2) + "<br>\n                                <strong>Refund ID:</strong> " + response.data.data.id + "<br>\n                                <strong>Status:</strong> " + response.data.data.status + "<br>\n                              </td>\n                            </tr>\n                          </table>\n                          <p style=\"color: #555555; font-size: 16px; margin: 0 0 15px;\">The refund will be processed to your original payment method within 5-7 business days.</p>\n                        </td>\n                      </tr>\n                      <tr>\n                        <td style=\"padding: 20px; background-color: #2c3e50; color: #ffffff; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;\">\n                          <p style=\"font-size: 14px; margin: 0 0 5px;\">Best regards,<br><strong>The Quicrefil Support Team</strong></p>\n                          <p style=\"font-size: 12px; margin: 0;\">\u00A9 2025 Quicrefil. All rights reserved.</p>\n                        </td>\n                      </tr>\n                    </table>\n                  </td>\n                </tr>\n              </table>\n            </body>\n            </html>\n          "
                        };
                        return [4 /*yield*/, transporter.sendMail(mailOptions)];
                    case 7:
                        _c.sent();
                        logger_1["default"].info("Refund confirmation email sent to " + user.email, { transactionRef: transactionRef });
                        return [3 /*break*/, 9];
                    case 8:
                        emailError_3 = _c.sent();
                        logger_1["default"].error('Failed to send refund confirmation email', {
                            message: emailError_3.message,
                            userId: userId,
                            transactionRef: transactionRef
                        });
                        return [3 /*break*/, 9];
                    case 9:
                        logger_1["default"].info("Refund initiated successfully for transaction: " + transactionRef, {
                            refundId: response.data.data.id,
                            status: response.data.data.status
                        });
                        return [3 /*break*/, 12];
                    case 10:
                        error_13 = _c.sent();
                        logger_1["default"].error('Refund Processing Error', {
                            message: error_13.message,
                            transactionRef: transactionRef,
                            userId: userId,
                            amount: amount,
                            stack: error_13.stack,
                            response: (_a = error_13.response) === null || _a === void 0 ? void 0 : _a.data
                        });
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    action: 'REFUND_FAILED',
                                    entityType: 'Payment',
                                    entityId: transactionRef,
                                    details: JSON.stringify({
                                        error: error_13.message,
                                        transactionRef: transactionRef,
                                        amount: amount,
                                        response: (_b = error_13.response) === null || _b === void 0 ? void 0 : _b.data
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 11:
                        _c.sent();
                        throw new Error("Failed to process refund: " + error_13.message);
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.scheduleWebhookRetry = function (tx_ref) {
        return __awaiter(this, void 0, Promise, function () {
            var redis, retryKey, retryCount, _a, error_14;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        redis = redis_1.getRedisClient();
                        retryKey = "webhookRetry:" + tx_ref;
                        _a = parseInt;
                        return [4 /*yield*/, redis.get(retryKey)];
                    case 1:
                        retryCount = _a.apply(void 0, [(_b.sent()) || '0', 10]);
                        if (retryCount >= 3) {
                            logger_1["default"].warn("Max retry attempts reached for " + tx_ref);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, redis.setEx(retryKey, 3600, (retryCount + 1).toString())];
                    case 2:
                        _b.sent();
                        // Simulate webhook retry by calling verifyPayment
                        setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                            var retryError_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, this.verifyPayment(tx_ref)];
                                    case 1:
                                        _a.sent();
                                        logger_1["default"].info("Webhook retry successful for " + tx_ref);
                                        return [3 /*break*/, 3];
                                    case 2:
                                        retryError_2 = _a.sent();
                                        logger_1["default"].error("Webhook retry failed for " + tx_ref, {
                                            message: retryError_2.message,
                                            stack: retryError_2.stack
                                        });
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }, 1000 * 60 * (retryCount + 1)); // Delay increases with retry count (1min, 2min, 3min)
                        return [3 /*break*/, 4];
                    case 3:
                        error_14 = _b.sent();
                        logger_1["default"].error("Failed to schedule webhook retry for " + tx_ref, {
                            message: error_14.message,
                            stack: error_14.stack
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.checkPaymentMethodStatus = function (paymentMethod) {
        return __awaiter(this, void 0, Promise, function () {
            var config, error_15;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log("\uD83D\uDD0D Checking PaymentConfig status for payment method: " + paymentMethod);
                        return [4 /*yield*/, db_1["default"].paymentConfig.findUnique({
                                where: { paymentMethod: paymentMethod }
                            })];
                    case 1:
                        config = _a.sent();
                        if (!config) {
                            console.warn("No PaymentConfig entry found for " + paymentMethod + ". Defaulting to disabled.");
                            return [2 /*return*/, {
                                    paymentMethod: paymentMethod,
                                    isEnabled: false,
                                    gateway: null,
                                    lastUpdated: null,
                                    updatedBy: null
                                }];
                        }
                        console.log("PaymentConfig status for " + paymentMethod + ":", {
                            isEnabled: config.isEnabled,
                            gateway: config.gateway,
                            lastUpdated: config.updatedAt,
                            updatedBy: config.updatedBy
                        });
                        return [2 /*return*/, {
                                paymentMethod: config.paymentMethod,
                                isEnabled: config.isEnabled,
                                gateway: config.gateway,
                                lastUpdated: config.updatedAt,
                                updatedBy: config.updatedBy
                            }];
                    case 2:
                        error_15 = _a.sent();
                        console.error("Error checking PaymentConfig status for " + paymentMethod + ":", {
                            message: error_15.message,
                            stack: error_15.stack
                        });
                        throw new Error("Failed to check payment method status: " + error_15.message);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.verifyBVNForBankAccount = function (userId, bvn, bankName, accountNumber) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __awaiter(this, void 0, Promise, function () {
            var user, walletId, agentWalletId, transactionRef, verification, verificationResponse, response, error_16, verificationDetails, bankCardData, whereClause, bankCard, error_17;
            return __generator(this, function (_o) {
                switch (_o.label) {
                    case 0:
                        _o.trys.push([0, 13, , 14]);
                        logger_1["default"].info("Verifying BVN for user " + userId + ": " + bvn + " for bank account " + bankName + " - " + accountNumber);
                        // Input validation
                        if (!/^\d{11}$/.test(bvn)) {
                            throw new Error('Invalid BVN: Must be 11 digits');
                        }
                        if (!bankName || !/^[a-zA-Z\s]+$/.test(bankName)) {
                            throw new Error('Invalid bank name');
                        }
                        if (!/^\d{10}$/.test(accountNumber)) {
                            throw new Error('Invalid account number: Must be 10 digits');
                        }
                        return [4 /*yield*/, db_1["default"].user.findUnique({
                                where: { id: userId },
                                include: { wallet: true, agentWallet: true }
                            })];
                    case 1:
                        user = _o.sent();
                        if (!user)
                            throw new Error('User not found');
                        if (user.role !== client_1.Role.VENDOR) {
                            throw new Error('Only vendors can verify BVN for bank account linking');
                        }
                        if (!user.wallet && !user.agentWallet) {
                            throw new Error('No wallet or agent wallet found for user');
                        }
                        walletId = (_b = (_a = user.wallet) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : (_c = user.agentWallet) === null || _c === void 0 ? void 0 : _c.id;
                        agentWalletId = (_e = (_d = user.agentWallet) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : (_f = user.wallet) === null || _f === void 0 ? void 0 : _f.id;
                        if (!walletId || !agentWalletId) {
                            throw new Error('Unable to determine wallet IDs for BankCard creation');
                        }
                        transactionRef = "BVN-VERIFY-" + uuid_1.v4();
                        return [4 /*yield*/, db_1["default"].bVNVerification.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    walletId: (_h = (_g = user.wallet) === null || _g === void 0 ? void 0 : _g.id) !== null && _h !== void 0 ? _h : null,
                                    agentWalletId: (_k = (_j = user.agentWallet) === null || _j === void 0 ? void 0 : _j.id) !== null && _k !== void 0 ? _k : null,
                                    bvn: bvn,
                                    bankName: bankName,
                                    accountNumber: accountNumber,
                                    status: 'PENDING',
                                    transactionRef: transactionRef
                                }
                            })];
                    case 2:
                        verification = _o.sent();
                        verificationResponse = void 0;
                        _o.label = 3;
                    case 3:
                        _o.trys.push([3, 5, , 7]);
                        return [4 /*yield*/, axios_1["default"].get("https://api.flutterwave.com/v3/kyc/bvns/" + bvn, {
                                headers: {
                                    Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY,
                                    'Content-Type': 'application/json'
                                }
                            })];
                    case 4:
                        response = _o.sent();
                        if (response.data.status !== 'success') {
                            throw new Error("BVN verification failed: " + response.data.message);
                        }
                        verificationResponse = response.data;
                        return [3 /*break*/, 7];
                    case 5:
                        error_16 = _o.sent();
                        logger_1["default"].error('BVN Verification Error:', {
                            message: error_16.message,
                            response: (_l = error_16.response) === null || _l === void 0 ? void 0 : _l.data
                        });
                        return [4 /*yield*/, db_1["default"].bVNVerification.update({
                                where: { id: verification.id },
                                data: {
                                    status: 'FAILED',
                                    responseDetails: ((_m = error_16.response) === null || _m === void 0 ? void 0 : _m.data) || { message: error_16.message }
                                }
                            })];
                    case 6:
                        _o.sent();
                        throw new Error("BVN verification failed: " + error_16.message);
                    case 7:
                        if (!(verificationResponse.data.first_name.toLowerCase() !== user.firstName.toLowerCase() ||
                            verificationResponse.data.last_name.toLowerCase() !== user.lastName.toLowerCase())) return [3 /*break*/, 9];
                        return [4 /*yield*/, db_1["default"].bVNVerification.update({
                                where: { id: verification.id },
                                data: {
                                    status: 'FAILED',
                                    responseDetails: {
                                        message: 'BVN details do not match user profile',
                                        flutterwave: verificationResponse.data
                                    }
                                }
                            })];
                    case 8:
                        _o.sent();
                        throw new Error('BVN details do not match user profile');
                    case 9:
                        verificationDetails = {
                            firstName: verificationResponse.data.first_name,
                            lastName: verificationResponse.data.last_name,
                            dateOfBirth: verificationResponse.data.date_of_birth,
                            phoneNumber: verificationResponse.data.phone_number,
                            status: verificationResponse.data.status
                        };
                        bankCardData = {
                            id: uuid_1.v4(),
                            userId: userId,
                            bankName: bankName,
                            cardLast4: accountNumber.slice(-4),
                            cardType: 'BANK_ACCOUNT',
                            expiryDate: 'N/A',
                            isValidated: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            walletId: walletId,
                            agentWalletId: agentWalletId
                        };
                        whereClause = {
                            userId_walletId_agentWalletId: {
                                userId: userId,
                                walletId: walletId,
                                agentWalletId: agentWalletId
                            }
                        };
                        return [4 /*yield*/, db_1["default"].bankCard.upsert({
                                where: whereClause,
                                update: {
                                    bankName: bankName,
                                    cardLast4: accountNumber.slice(-4),
                                    cardType: 'BANK_ACCOUNT',
                                    expiryDate: 'N/A',
                                    isValidated: true,
                                    updatedAt: new Date()
                                },
                                create: bankCardData
                            })];
                    case 10:
                        bankCard = _o.sent();
                        // Update BVN verification status
                        return [4 /*yield*/, db_1["default"].bVNVerification.update({
                                where: { id: verification.id },
                                data: {
                                    status: 'SUCCESS',
                                    responseDetails: verificationDetails
                                }
                            })];
                    case 11:
                        // Update BVN verification status
                        _o.sent();
                        // Create audit log
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    action: 'BVN_VERIFICATION_BANK_ACCOUNT',
                                    entityType: 'BVNVerification',
                                    entityId: verification.id,
                                    details: {
                                        bvn: bvn,
                                        bankName: bankName,
                                        accountNumber: accountNumber.slice(-4),
                                        status: 'SUCCESS'
                                    }
                                }
                            })];
                    case 12:
                        // Create audit log
                        _o.sent();
                        logger_1["default"].info("BVN verified and bank account linked: " + transactionRef);
                        return [2 /*return*/, {
                                transactionId: transactionRef,
                                status: 'SUCCESS',
                                verificationDetails: verificationDetails,
                                bankAccountLinked: !!bankCard
                            }];
                    case 13:
                        error_17 = _o.sent();
                        logger_1["default"].error('BVN Verification Error:', {
                            message: error_17.message,
                            userId: userId,
                            bvn: bvn,
                            bankName: bankName,
                            accountNumber: accountNumber
                        });
                        throw new Error("BVN verification failed: " + error_17.message);
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    PaymentService.prototype.creditWallet = function (userId, amount, transactionRef) {
        return __awaiter(this, void 0, Promise, function () {
            var cacheKey, redisClient, pingResult, delResult, cacheError_1, error_18, wallet;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 11]);
                        console.log("Crediting wallet for user " + userId + ": " + amount + " (txn: " + transactionRef + ")");
                        return [4 /*yield*/, db_1["default"].$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var wallet, payment, existingTransaction, creditAmount, paymentDetails, serviceFee, vat, walletTransactionId, walletTransaction, updatedWallet;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0: return [4 /*yield*/, tx.wallet.findUnique({ where: { userId: userId } })];
                                        case 1:
                                            wallet = _c.sent();
                                            if (!wallet) {
                                                throw new Error("Wallet not found for user " + userId);
                                            }
                                            return [4 /*yield*/, tx.payment.findUnique({
                                                    where: { transactionRef: transactionRef }
                                                })];
                                        case 2:
                                            payment = _c.sent();
                                            if (!payment) {
                                                throw new Error("Payment not found for transaction " + transactionRef);
                                            }
                                            return [4 /*yield*/, tx.walletTransaction.findFirst({
                                                    where: {
                                                        paymentId: payment.id,
                                                        transactionType: client_1.TransactionType.DEPOSIT,
                                                        status: client_1.TransactionStatus.COMPLETED
                                                    }
                                                })];
                                        case 3:
                                            existingTransaction = _c.sent();
                                            if (existingTransaction) {
                                                console.warn("Wallet transaction already processed for payment " + payment.id + ". Skipping credit.");
                                                return [2 /*return*/];
                                            }
                                            creditAmount = payment.productType === "wallet_topup"
                                                ? new library_1.Decimal(payment.amount) // Total amount (e.g., 1075)
                                                : new library_1.Decimal(amount);
                                            console.log("Using creditAmount: " + creditAmount.toString() + " for wallet top-up");
                                            paymentDetails = payment.paymentDetails;
                                            serviceFee = (_a = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.serviceFee) !== null && _a !== void 0 ? _a : 0;
                                            vat = (_b = paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.vat) !== null && _b !== void 0 ? _b : 0;
                                            walletTransactionId = uuid_1.v4();
                                            return [4 /*yield*/, tx.walletTransaction.create({
                                                    data: {
                                                        id: walletTransactionId,
                                                        userId: userId,
                                                        walletId: wallet.id,
                                                        transactionType: client_1.TransactionType.DEPOSIT,
                                                        amount: creditAmount,
                                                        paymentId: payment.id,
                                                        status: client_1.TransactionStatus.COMPLETED,
                                                        createdAt: new Date(),
                                                        updatedAt: new Date(),
                                                        metadata: {
                                                            transactionRef: transactionRef,
                                                            serviceFee: serviceFee,
                                                            vat: vat
                                                        }
                                                    }
                                                })];
                                        case 4:
                                            walletTransaction = _c.sent();
                                            return [4 /*yield*/, tx.wallet.update({
                                                    where: { id: wallet.id },
                                                    data: {
                                                        balance: { increment: creditAmount },
                                                        updatedAt: new Date()
                                                    }
                                                })];
                                        case 5:
                                            updatedWallet = _c.sent();
                                            return [4 /*yield*/, tx.payment.update({
                                                    where: { transactionRef: transactionRef },
                                                    data: { status: client_1.TransactionStatus.COMPLETED }
                                                })];
                                        case 6:
                                            _c.sent();
                                            return [4 /*yield*/, tx.auditLog.create({
                                                    data: {
                                                        id: uuid_1.v4(),
                                                        userId: userId,
                                                        action: "WALLET_CREDIT",
                                                        entityType: "WALLET_TRANSACTION",
                                                        entityId: walletTransaction.id,
                                                        details: JSON.stringify({
                                                            amount: creditAmount.toNumber(),
                                                            transactionRef: transactionRef,
                                                            walletId: wallet.id,
                                                            newBalance: updatedWallet.balance.toString(),
                                                            serviceFee: serviceFee,
                                                            vat: vat
                                                        }),
                                                        createdAt: new Date()
                                                    }
                                                })];
                                        case 7:
                                            _c.sent();
                                            console.log("Wallet updated: new balance = " + updatedWallet.balance.toString());
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        cacheKey = "wallet:balance:" + userId;
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        redisClient = redis_1.getRedisClient();
                        return [4 /*yield*/, redisClient.ping()];
                    case 3:
                        pingResult = _a.sent();
                        if (pingResult !== 'PONG') {
                            console.warn('Redis not responding to ping');
                        }
                        return [4 /*yield*/, redisClient.del(cacheKey)];
                    case 4:
                        delResult = _a.sent();
                        console.log("Cache invalidation result: deleted " + delResult + " key(s) for " + cacheKey);
                        return [3 /*break*/, 6];
                    case 5:
                        cacheError_1 = _a.sent();
                        console.warn("Failed to invalidate cache: " + cacheError_1.message);
                        return [3 /*break*/, 6];
                    case 6:
                        console.log("Wallet credited successfully for user " + userId + ": " + amount);
                        return [3 /*break*/, 11];
                    case 7:
                        error_18 = _a.sent();
                        console.error("Wallet credit error:", {
                            message: error_18.message,
                            userId: userId,
                            transactionRef: transactionRef,
                            amount: amount,
                            stack: error_18.stack
                        });
                        return [4 /*yield*/, db_1["default"].wallet.findUnique({ where: { userId: userId } })];
                    case 8:
                        wallet = _a.sent();
                        if (!wallet) return [3 /*break*/, 10];
                        return [4 /*yield*/, db_1["default"].auditLog.create({
                                data: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    action: "WALLET_CREDIT_FAILED",
                                    entityType: "WALLET",
                                    entityId: wallet.id,
                                    details: JSON.stringify({
                                        error: error_18.message,
                                        transactionRef: transactionRef,
                                        amount: amount,
                                        stack: error_18.stack
                                    }),
                                    createdAt: new Date()
                                }
                            })];
                    case 9:
                        _a.sent();
                        _a.label = 10;
                    case 10: throw new Error("Failed to credit wallet: " + error_18.message);
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    return PaymentService;
}());
exports["default"] = new PaymentService();
