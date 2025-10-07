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
exports.generateAccessToken = exports.generateTokenPair = exports.REFRESH_TOKEN_EXPIRES_IN = exports.ACCESS_TOKEN_EXPIRES_IN = void 0;
// src/lib/utils/jwt/generateTokenPair.ts
var jsonwebtoken_1 = require("jsonwebtoken");
var secrets_1 = require("../../../secrets");
var jwt_tokens_1 = require("../../storage/jwt_tokens");
var verifyToken_1 = require("./verifyToken");
// Token expiration times
exports.ACCESS_TOKEN_EXPIRES_IN = 60 * 60; // 1 hour
exports.REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24; // 1 day
exports.generateTokenPair = function (payload) { return __awaiter(void 0, void 0, void 0, function () {
    var sanitizedPayload, accessToken, decodedAccessToken, refreshToken, decodedRefreshToken, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('generateTokenPair started with payload:', payload);
                // Validate secrets
                if (!secrets_1.JWT_ACCESS_SECRET || !secrets_1.JWT_REFRESH_SECRET) {
                    console.error('JWT secrets not configured:', {
                        accessSecret: secrets_1.JWT_ACCESS_SECRET ? 'Set' : 'Not set',
                        refreshSecret: secrets_1.JWT_REFRESH_SECRET ? 'Set' : 'Not set'
                    });
                    throw new Error('JWT secrets not configured');
                }
                // Validate payload
                if (!payload.userId || !payload.email || !payload.role) {
                    console.error('Invalid payload:', payload);
                    throw new Error('Missing required payload fields');
                }
                sanitizedPayload = {
                    userId: payload.userId,
                    email: payload.email,
                    role: payload.role,
                    contextRole: payload.contextRole
                };
                console.log('Sanitized payload:', sanitizedPayload);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                // Generate access token
                console.log('Generating access token...');
                accessToken = jsonwebtoken_1["default"].sign(sanitizedPayload, secrets_1.JWT_ACCESS_SECRET, {
                    expiresIn: exports.ACCESS_TOKEN_EXPIRES_IN,
                    algorithm: 'HS256'
                });
                decodedAccessToken = jsonwebtoken_1["default"].decode(accessToken, { complete: true });
                console.log('Decoded access token payload:', decodedAccessToken);
                // Generate refresh token
                console.log('Generating refresh token...');
                refreshToken = jsonwebtoken_1["default"].sign(sanitizedPayload, secrets_1.JWT_REFRESH_SECRET, {
                    expiresIn: exports.REFRESH_TOKEN_EXPIRES_IN,
                    algorithm: 'HS256'
                });
                decodedRefreshToken = jsonwebtoken_1["default"].decode(refreshToken, { complete: true });
                console.log('Decoded refresh token payload:', decodedRefreshToken);
                // Store access token
                console.log('Storing access token...');
                return [4 /*yield*/, jwt_tokens_1.storeAccessToken(accessToken, payload.userId)];
            case 2:
                _a.sent();
                console.log('Access token stored');
                return [2 /*return*/, {
                        accessToken: accessToken,
                        refreshToken: refreshToken
                    }];
            case 3:
                err_1 = _a.sent();
                console.error('Token generation error:', err_1.message);
                throw new Error('Failed to generate tokens');
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.generateAccessToken = function (refreshToken) { return __awaiter(void 0, void 0, void 0, function () {
    var payload, newPayload, accessToken;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('generateAccessToken started with refreshToken:', refreshToken.slice(0, 10) + '...');
                // Validate refresh token format
                if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
                    console.error('Invalid refresh token format:', refreshToken);
                    throw new Error('Invalid refresh token format');
                }
                return [4 /*yield*/, verifyToken_1.verifyToken(refreshToken, 'refresh')];
            case 1:
                payload = _a.sent();
                console.log('Verified refresh token payload:', payload);
                // Validate payload
                if (!payload.userId || !payload.email || !payload.role) {
                    console.error('Invalid payload from refresh token:', payload);
                    throw new Error('Invalid refresh token payload');
                }
                newPayload = {
                    userId: payload.userId,
                    email: payload.email,
                    role: payload.role,
                    contextRole: payload.contextRole
                };
                console.log('Generating new access token...');
                accessToken = jsonwebtoken_1["default"].sign(newPayload, secrets_1.JWT_ACCESS_SECRET, {
                    expiresIn: exports.ACCESS_TOKEN_EXPIRES_IN,
                    algorithm: 'HS256'
                });
                console.log('New access token generated:', accessToken.slice(0, 10) + '...');
                // Store access token
                console.log('Storing new access token...');
                return [4 /*yield*/, jwt_tokens_1.storeAccessToken(accessToken, payload.userId)];
            case 2:
                _a.sent();
                console.log('New access token stored');
                return [2 /*return*/, { accessToken: accessToken }];
        }
    });
}); };
