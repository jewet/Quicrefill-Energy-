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
exports.emailController = exports.EmailController = void 0;
var email_1 = require("../../services/email");
var http_util_1 = require("../../utils/http.util");
var winston_1 = require("winston");
var logger = winston_1["default"].createLogger({
    level: 'info',
    format: winston_1["default"].format.combine(winston_1["default"].format.timestamp(), winston_1["default"].format.json()),
    transports: [
        new winston_1["default"].transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1["default"].transports.File({ filename: 'logs/combined.log' }),
        new winston_1["default"].transports.Console(),
    ]
});
var EmailController = /** @class */ (function () {
    function EmailController() {
    }
    EmailController.createTemplate = function (req, res) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var data, updatedBy, template, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        data = req.body;
                        if (!data.name || !data.subject || !data.htmlContent) {
                            http_util_1.HttpResponse.error(res, 'Name, subject, and htmlContent are required', 400);
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        updatedBy = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                        if (!updatedBy) {
                            http_util_1.HttpResponse.error(res, 'Unauthorized: User not found', 401);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.createTemplate(data, updatedBy)];
                    case 2:
                        template = _b.sent();
                        http_util_1.HttpResponse.success(res, template, 'Email template created', 201);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        logger.error('createTemplate Controller Error', { error: errorMessage });
                        http_util_1.HttpResponse.error(res, errorMessage, 400);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.updateTemplate = function (req, res) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var id, data, updatedBy, template, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = req.params.id;
                        data = req.body;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        updatedBy = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                        if (!updatedBy) {
                            http_util_1.HttpResponse.error(res, 'Unauthorized: User not found', 401);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.updateTemplate(id, data, updatedBy)];
                    case 2:
                        template = _b.sent();
                        http_util_1.HttpResponse.success(res, template, 'Email template updated');
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Unknown error';
                        logger.error('updateTemplate Controller Error', { id: id, error: errorMessage });
                        http_util_1.HttpResponse.error(res, errorMessage, 400);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.deleteTemplate = function (req, res) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var id, deletedBy, error_3, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = req.params.id;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        deletedBy = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                        if (!deletedBy) {
                            http_util_1.HttpResponse.error(res, 'Unauthorized: User not found', 401);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.deleteTemplate(id, deletedBy)];
                    case 2:
                        _b.sent();
                        http_util_1.HttpResponse.success(res, null, 'Email template deleted');
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _b.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'Unknown error';
                        logger.error('deleteTemplate Controller Error', { id: id, error: errorMessage });
                        http_util_1.HttpResponse.error(res, errorMessage, 400);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.getTemplates = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var templates, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, email_1.emailTemplateService.getTemplates()];
                    case 1:
                        templates = _a.sent();
                        http_util_1.HttpResponse.success(res, templates);
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'Unknown error';
                        logger.error('getTemplates Controller Error', { error: errorMessage });
                        http_util_1.HttpResponse.error(res, errorMessage, 500);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.getTemplateById = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var id, template, error_5, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = req.params.id;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, email_1.emailTemplateService.getById(id)];
                    case 2:
                        template = _a.sent();
                        if (!template) {
                            http_util_1.HttpResponse.error(res, 'Email template not found', 404);
                            return [2 /*return*/];
                        }
                        http_util_1.HttpResponse.success(res, template);
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : 'Unknown error';
                        logger.error('getTemplateById Controller Error', { id: id, error: errorMessage });
                        http_util_1.HttpResponse.error(res, errorMessage, 500);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.sendEmail = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var data, error_6, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        data = req.body;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, email_1.emailTemplateService.sendEmail(data)];
                    case 2:
                        _a.sent();
                        http_util_1.HttpResponse.success(res, null, 'Email(s) sent successfully');
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _a.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : 'Unknown error';
                        logger.error('sendEmail Controller Error', { error: errorMessage });
                        http_util_1.HttpResponse.error(res, errorMessage, 400);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return EmailController;
}());
exports.EmailController = EmailController;
exports.emailController = new EmailController();
