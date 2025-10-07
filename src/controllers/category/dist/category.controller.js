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
exports.CategoryController = void 0;
var category_service_1 = require("../../services/category.service");
var category_schema_1 = require("../../schemas/category.schema");
var appError_1 = require("../../lib/utils/errors/appError");
// UUID validation regex
var UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
var categoryService = new category_service_1.CategoryService();
var CategoryController = /** @class */ (function () {
    function CategoryController() {
        // Bind all methods to ensure correct 'this' context
        this.createCategory = this.createCategory.bind(this);
        this.getAllCategories = this.getAllCategories.bind(this);
        this.getCategoryById = this.getCategoryById.bind(this);
        this.updateCategory = this.updateCategory.bind(this);
        this.deleteCategory = this.deleteCategory.bind(this);
    }
    /**
     * Create a new category
     * @param req - Request
     * @param res - Response
     * @param next - Next function
     */
    CategoryController.prototype.createCategory = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var validatedData, category, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        validatedData = category_schema_1.createCategorySchema.parse(req.body);
                        return [4 /*yield*/, categoryService.createCategory(validatedData)];
                    case 1:
                        category = _a.sent();
                        res.status(201).json({
                            status: 'success',
                            data: category
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        next(error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all categories
     * @param req - Request
     * @param res - Response
     * @param next - Next function
     * @query includeProducts - Include products in response
     */
    CategoryController.prototype.getAllCategories = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var includeProducts, categories, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        includeProducts = req.query.includeProducts === 'true';
                        return [4 /*yield*/, categoryService.getAllCategories(includeProducts)];
                    case 1:
                        categories = _a.sent();
                        res.status(200).json({
                            status: 'success',
                            results: categories.length,
                            data: categories
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        next(error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get category by ID
     * @param req - Request
     * @param res - Response
     * @param next - Next function
     * @query includeProducts - Include products in response
     */
    CategoryController.prototype.getCategoryById = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var id, includeProducts, category, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        // Validate ID before passing to service
                        if (!id || typeof id !== 'string') {
                            throw new appError_1.ApiError(400, "Invalid category ID: must be a non-empty string");
                        }
                        if (!UUID_REGEX.test(id)) {
                            throw new appError_1.ApiError(400, "Invalid category ID: must be a valid UUID");
                        }
                        includeProducts = req.query.includeProducts === 'true';
                        return [4 /*yield*/, categoryService.getCategoryById(id, includeProducts)];
                    case 1:
                        category = _a.sent();
                        res.status(200).json({
                            status: 'success',
                            data: category
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        console.error("Error in getCategoryById controller with ID " + req.params.id + ":", error_3); // Debug logging
                        next(error_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update category
     * @param req - Request
     * @param res - Response
     * @param next - Next function
     */
    CategoryController.prototype.updateCategory = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var id, validatedData, category, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        validatedData = category_schema_1.updateCategorySchema.parse(req.body);
                        return [4 /*yield*/, categoryService.updateCategory(id, validatedData)];
                    case 1:
                        category = _a.sent();
                        res.status(200).json({
                            status: 'success',
                            data: category
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        next(error_4);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete category
     * @param req - Request
     * @param res - Response
     * @param next - Next function
     */
    CategoryController.prototype.deleteCategory = function (req, res, next) {
        return __awaiter(this, void 0, Promise, function () {
            var id, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        id = req.params.id;
                        return [4 /*yield*/, categoryService.deleteCategory(id)];
                    case 1:
                        _a.sent();
                        res.status(204).send();
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        next(error_5);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return CategoryController;
}());
exports.CategoryController = CategoryController;
