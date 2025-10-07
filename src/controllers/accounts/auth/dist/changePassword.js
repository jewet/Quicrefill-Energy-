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
exports.changePassword = exports.TWO_HOURS_IN_SECONDS = void 0;
var db_1 = require("../../../config/db");
var bcryptjs_1 = require("bcryptjs");
var inMemoryStore_1 = require("../../../utils/inMemoryStore");
var email_1 = require("../../../services/email"); // Import EmailService
var http_util_1 = require("../../../utils/http.util");
var winston_1 = require("winston");
exports.TWO_HOURS_IN_SECONDS = 2 * 60 * 60;
// Logger setup (consistent with EmailService and EmailController)
var logger = winston_1["default"].createLogger({
    level: "info",
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: "logs/error.log", level: "error" }),
        new winston_1["default"].transports.File({ filename: "logs/combined.log" }),
        new winston_1["default"].transports.Console(),
    ]
});
exports.changePassword = function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, oldPassword, newPassword, user, _b, hashedNewPassword, currentToken, emailError_1, errorMessage, error_1;
    var _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 10, , 11]);
                userId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
                _a = req.body, oldPassword = _a.oldPassword, newPassword = _a.newPassword;
                // Validate inputs
                if (!userId || !oldPassword || !newPassword) {
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "All fields (oldPassword, newPassword) are required", 400)];
                }
                if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "Passwords must be strings", 400)];
                }
                if (newPassword.length < 6) {
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "New password must be at least 6 characters long", 400)];
                }
                return [4 /*yield*/, db_1.prismaClient.user.findUnique({ where: { id: userId } })];
            case 1:
                user = _f.sent();
                _b = !user;
                if (_b) return [3 /*break*/, 3];
                return [4 /*yield*/, bcryptjs_1["default"].compare(oldPassword, user.password || "")];
            case 2:
                _b = !(_f.sent());
                _f.label = 3;
            case 3:
                if (_b) {
                    return [2 /*return*/, http_util_1.HttpResponse.error(res, "Invalid old password", 401)];
                }
                return [4 /*yield*/, bcryptjs_1["default"].hash(newPassword, 10)];
            case 4:
                hashedNewPassword = _f.sent();
                return [4 /*yield*/, db_1.prismaClient.user.update({
                        where: { id: userId },
                        data: { password: hashedNewPassword }
                    })];
            case 5:
                _f.sent();
                currentToken = ((_d = req.cookies) === null || _d === void 0 ? void 0 : _d.token) || ((_e = req.headers.authorization) === null || _e === void 0 ? void 0 : _e.split(" ")[1]) || "";
                if (currentToken) {
                    inMemoryStore_1.setWithExpiry("blacklist:" + currentToken, "true", exports.TWO_HOURS_IN_SECONDS);
                }
                _f.label = 6;
            case 6:
                _f.trys.push([6, 8, , 9]);
                return [4 /*yield*/, email_1.emailTemplateService.sendEmail({
                        eventType: "PASSWORD_CHANGED",
                        customPayload: {
                            to: user.email,
                            subject: "Your Quicrefill Password Has Been Changed",
                            htmlContent: "<p>Dear " + (user.name || "User") + ",</p>\n                        <p>Your password has been successfully changed.</p>\n                        <p>If you did not initiate this change, please contact support immediately.</p>\n                        <p>Best regards,<br>Quicrefill Team</p>"
                        },
                        metadata: {
                            userId: user.id,
                            name: user.name || "User",
                            email: user.email
                        }
                    })];
            case 7:
                _f.sent();
                logger.info("Password change email sent", { email: user.email });
                return [3 /*break*/, 9];
            case 8:
                emailError_1 = _f.sent();
                errorMessage = emailError_1 instanceof Error ? emailError_1.message : "Unknown error";
                logger.error("Failed to send password change email", { email: user.email, error: errorMessage });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/, http_util_1.HttpResponse.success(res, null, "Password changed successfully")];
            case 10:
                error_1 = _f.sent();
                logger.error("changePassword error", { error: error_1 instanceof Error ? error_1.message : "Unknown error" });
                next(error_1);
                return [3 /*break*/, 11];
            case 11: return [2 /*return*/];
        }
    });
}); };
