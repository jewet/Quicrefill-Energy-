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
exports.sendPasswordResetToken = exports.validateResetToken = exports.createResetToken = void 0;
var crypto_1 = require("crypto");
var bcryptjs_1 = require("bcryptjs");
var crypto_2 = require("../../storage/crypto");
var email_1 = require("../../../services/email"); // Corrected import
var unauthorizedRequests_1 = require("../../../exceptions/unauthorizedRequests");
var root_1 = require("../../../exceptions/root");
exports.createResetToken = function (email) { return __awaiter(void 0, void 0, void 0, function () {
    var token, key, hashedToken;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = crypto_1["default"].randomBytes(32).toString("hex");
                key = "user:reset-password-token:" + email;
                return [4 /*yield*/, bcryptjs_1["default"].hash(token, 10)];
            case 1:
                hashedToken = _a.sent();
                return [4 /*yield*/, crypto_2.storeCryptoHash(key, hashedToken)];
            case 2:
                _a.sent();
                return [2 /*return*/, token];
        }
    });
}); };
exports.validateResetToken = function (email, token) { return __awaiter(void 0, void 0, void 0, function () {
    var key, hashedToken, _a, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                key = "user:reset-password-token:" + email;
                return [4 /*yield*/, crypto_2.getCryptoHash(key)];
            case 1:
                hashedToken = _b.sent();
                _a = hashedToken;
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, bcryptjs_1["default"].compare(token, hashedToken)];
            case 2:
                _a = (_b.sent());
                _b.label = 3;
            case 3:
                if (!_a) return [3 /*break*/, 5];
                return [4 /*yield*/, crypto_2.deleteCryptoHash(key)];
            case 4:
                _b.sent();
                return [2 /*return*/, true];
            case 5: return [2 /*return*/, false];
            case 6:
                err_1 = _b.sent();
                throw new unauthorizedRequests_1.UnauthorizedRequest(err_1.message || "Invalid token", root_1.AppErrorCode.INVALID_TOKEN);
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.sendPasswordResetToken = function (email, name) { return __awaiter(void 0, void 0, void 0, function () {
    var token, link, companyName, companyAddress, subject, htmlBody;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.createResetToken(email)];
            case 1:
                token = _a.sent();
                link = "http://127.0.0.1:4000/reset-password?token=" + token;
                companyName = "Quicrefill";
                companyAddress = "Abuja";
                subject = "Password Reset Request";
                htmlBody = "\n    <html>\n        <head>\n            <meta charset=\"UTF-8\">\n            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n            <title>Reset Your Password</title>\n            <style>\n                body {\n                    font-family: Arial, sans-serif;\n                    line-height: 1.6;\n                    color: #333333;\n                    margin: 0;\n                    padding: 0;\n                }\n                .container {\n                    max-width: 600px;\n                    margin: 0 auto;\n                    padding: 20px;\n                    background-color: #ffffff;\n                }\n                .header {\n                    text-align: center;\n                    padding: 20px 0;\n                    background-color: #f8f9fa;\n                }\n                .logo {\n                    max-height: 50px;\n                }\n                .content {\n                    padding: 30px 20px;\n                }\n                .button {\n                    display: inline-block;\n                    padding: 12px 24px;\n                    background-color: #007bff;\n                    color: #ffffff;\n                    text-decoration: none;\n                    border-radius: 4px;\n                    margin: 20px 0;\n                }\n                .footer {\n                    text-align: center;\n                    padding: 20px;\n                    font-size: 12px;\n                    color: #666666;\n                    border-top: 1px solid #eeeeee;\n                }\n                .warning {\n                    font-size: 12px;\n                    color: #666666;\n                    font-style: italic;\n                }\n                @media only screen and (max-width: 600px) {\n                    .container {\n                        width: 100% !important;\n                    }\n                }\n            </style>\n        </head>\n        <body>\n            <div class=\"container\">\n                <div class=\"content\">\n                    <h2>Password Reset Request</h2>\n                    <p>Hello " + name + ",</p>\n                    <p>We received a request to reset the password for your account. If you made this request, please click the button below to reset your password:</p>\n                    <div style=\"text-align: center;\">\n                        <a href=\"" + link + "\" class=\"button\">Reset Password</a>\n                    </div>\n                    <p>This password reset link will expire in 30 minutes for security reasons.</p>\n                    <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns about your account's security.</p>\n                    <p class=\"warning\">For security reasons, never share this email or the reset link with anyone.</p>\n                    <p>Best regards,<br>\n                    The " + companyName + " Team</p>\n                </div>\n                <div class=\"footer\">\n                    <p>This is an automated message, please do not reply to this email.</p>\n                    <p>" + companyName + " | " + companyAddress + "</p>\n                </div>\n            </div>\n        </body>\n    </html>\n  ";
                return [4 /*yield*/, email_1.sendMail(email, { subject: subject, htmlBody: htmlBody, metadata: { userId: email, eventType: "PASSWORD_RESET" } })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
