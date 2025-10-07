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
var email_1 = require("../../services/email"); // Adjusted path
var EmailController = /** @class */ (function () {
    function EmailController() {
    }
    EmailController.prototype.createTemplate = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var data, template, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        data = req.body;
                        if (!data.name || !data.subject || !data.htmlContent) {
                            res.status(400).json({ success: false, message: "Name, subject, and htmlContent are required" });
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        if (!req.user || !req.user.id) {
                            res.status(401).json({ success: false, message: "Unauthorized: User not found" });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.createTemplate(data, req.user.id)];
                    case 2:
                        template = _a.sent();
                        res.status(201).json({ success: true, data: template });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        res.status(500).json({ success: false, message: error_1.message });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.prototype.updateTemplate = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var id, data, template, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = req.params.id;
                        data = req.body;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        if (!req.user || !req.user.id) {
                            res.status(401).json({ success: false, message: "Unauthorized: User not found" });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.updateTemplate(id, data, req.user.id)];
                    case 2:
                        template = _a.sent();
                        res.status(200).json({ success: true, data: template });
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        res.status(500).json({ success: false, message: error_2.message });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.prototype.deleteTemplate = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var id, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = req.params.id;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        if (!req.user || !req.user.id) {
                            res.status(401).json({ success: false, message: "Unauthorized: User not found" });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, email_1.emailTemplateService.deleteTemplate(id, req.user.id)];
                    case 2:
                        _a.sent();
                        res.status(200).json({ success: true, message: "Template deleted" });
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        res.status(500).json({ success: false, message: error_3.message });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.prototype.getTemplates = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var templates, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, email_1.emailTemplateService.getTemplates()];
                    case 1:
                        templates = _a.sent();
                        res.status(200).json({ success: true, data: templates });
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        res.status(500).json({ success: false, message: error_4.message });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    EmailController.prototype.sendEmail = function (req, res) {
        return __awaiter(this, void 0, Promise, function () {
            var data, error_5;
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
                        res.status(200).json({ success: true, message: "Email(s) sent successfully" });
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        res.status(500).json({ success: false, message: error_5.message });
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
