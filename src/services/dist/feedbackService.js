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
exports.FeedbackService = void 0;
// File: src/services/feedbackService.ts
var client_1 = require("@prisma/client");
var http_1 = require("../utils/http");
var root_1 = require("../exceptions/root");
var uuid_1 = require("uuid");
var prisma = new client_1.PrismaClient();
var FeedbackService = /** @class */ (function () {
    function FeedbackService() {
    }
    FeedbackService.prototype.createFeedback = function (userId, role, input) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var receiver, order, serviceOrder, receiverRole, feedback, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (role === client_1.Role.ADMIN) {
                            throw new http_1.BadRequestError('Admins cannot submit feedback', root_1.AppErrorCode.BAD_REQUEST, null);
                        }
                        return [4 /*yield*/, prisma.user.findUnique({ where: { id: input.receiverId } })];
                    case 1:
                        receiver = _f.sent();
                        if (!receiver) {
                            throw new http_1.NotFoundError('Receiver not found', root_1.AppErrorCode.NOT_FOUND, null);
                        }
                        if (!input.orderId) return [3 /*break*/, 3];
                        return [4 /*yield*/, prisma.order.findUnique({ where: { id: input.orderId } })];
                    case 2:
                        order = _f.sent();
                        if (!order) {
                            throw new http_1.NotFoundError('Order not found', root_1.AppErrorCode.NOT_FOUND, null);
                        }
                        _f.label = 3;
                    case 3:
                        if (!input.serviceOrderId) return [3 /*break*/, 5];
                        return [4 /*yield*/, prisma.serviceOrder.findUnique({ where: { id: input.serviceOrderId } })];
                    case 4:
                        serviceOrder = _f.sent();
                        if (!serviceOrder) {
                            throw new http_1.NotFoundError('Service order not found', root_1.AppErrorCode.NOT_FOUND, null);
                        }
                        _f.label = 5;
                    case 5:
                        receiverRole = receiver.role === client_1.Role.DELIVERY_REP || receiver.role === client_1.Role.VENDOR
                            ? client_1.Role.VENDOR
                            : receiver.role;
                        return [4 /*yield*/, prisma.feedback.create({
                                data: {
                                    id: uuid_1.v4(),
                                    giverId: userId,
                                    giverRole: role,
                                    receiverId: input.receiverId,
                                    receiverRole: receiverRole,
                                    orderId: input.orderId,
                                    serviceOrderId: input.serviceOrderId,
                                    comment: input.comment,
                                    rating: input.rating,
                                    status: client_1.FeedbackStatus.PENDING
                                },
                                include: {
                                    giver: { select: { firstName: true, lastName: true, email: true } },
                                    receiver: { select: { firstName: true, lastName: true, email: true } },
                                    order: true,
                                    serviceOrder: true
                                }
                            })];
                    case 6:
                        feedback = _f.sent();
                        // Update receiver's average rating
                        return [4 /*yield*/, this.updateReceiverRating(input.receiverId, receiverRole)];
                    case 7:
                        // Update receiver's average rating
                        _f.sent();
                        _c = (_b = prisma.notificationLog).create;
                        _d = {};
                        _e = {
                            id: uuid_1.v4(),
                            userId: null,
                            vendorId: receiver.role === client_1.Role.VENDOR ? receiver.id : null,
                            type: 'FEEDBACK_SUBMITTED'
                        };
                        return [4 /*yield*/, prisma.eventType.findFirst({ where: { name: 'FEEDBACK_SUBMITTED' } })];
                    case 8: 
                    // Create notification for admin
                    return [4 /*yield*/, _c.apply(_b, [(_d.data = (_e.eventTypeId = (_a = (_f.sent())) === null || _a === void 0 ? void 0 : _a.id,
                                _e.payload = { feedbackId: feedback.id, comment: input.comment, rating: input.rating },
                                _e.status = 'PENDING',
                                _e.channel = 'EMAIL',
                                _e.recipient = 'admin@example.com',
                                _e.message = "New feedback submitted by " + feedback.giver.firstName + " " + feedback.giver.lastName,
                                _e),
                                _d)])];
                    case 9:
                        // Create notification for admin
                        _f.sent();
                        return [2 /*return*/, feedback];
                }
            });
        });
    };
    FeedbackService.prototype.updateReceiverRating = function (userId, role) {
        return __awaiter(this, void 0, void 0, function () {
            var feedbacks, avgRating;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.feedback.findMany({
                            where: { receiverId: userId, receiverRole: role },
                            select: { rating: true }
                        })];
                    case 1:
                        feedbacks = _a.sent();
                        avgRating = feedbacks.length
                            ? feedbacks.reduce(function (sum, f) { return sum + f.rating; }, 0) / feedbacks.length
                            : 0;
                        return [4 /*yield*/, prisma.rating.upsert({
                                where: { userId_role: { userId: userId, role: role } },
                                update: { avgRating: avgRating, ratingCount: feedbacks.length },
                                create: {
                                    id: uuid_1.v4(),
                                    userId: userId,
                                    role: role,
                                    avgRating: avgRating,
                                    ratingCount: feedbacks.length
                                }
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    FeedbackService.prototype.getFeedbacksForAdmin = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            var where, feedbacks;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        where = {};
                        if (filter.status)
                            where.status = filter.status;
                        if (filter.issueType)
                            where.order = { paymentStatus: filter.issueType };
                        if (filter.dateFrom)
                            where.createdAt = { gte: new Date(filter.dateFrom) };
                        if (filter.dateTo)
                            where.createdAt = { lte: new Date(filter.dateTo) };
                        return [4 /*yield*/, prisma.feedback.findMany({
                                where: where,
                                include: {
                                    giver: { select: { firstName: true, lastName: true, email: true } },
                                    receiver: { select: { firstName: true, lastName: true, email: true } },
                                    order: true,
                                    serviceOrder: true
                                },
                                orderBy: { createdAt: 'desc' }
                            })];
                    case 1:
                        feedbacks = _a.sent();
                        return [2 /*return*/, {
                                total: feedbacks.length,
                                open: feedbacks.filter(function (f) { return f.status === client_1.FeedbackStatus.PENDING; }).length,
                                resolved: feedbacks.filter(function (f) { return f.status === client_1.FeedbackStatus.RESOLVED; }).length,
                                avgResolutionTime: this.calculateAvgResolutionTime(feedbacks),
                                data: feedbacks
                            }];
                }
            });
        });
    };
    FeedbackService.prototype.updateFeedback = function (feedbackId, input) {
        return __awaiter(this, void 0, void 0, function () {
            var feedback, updatedFeedback;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.feedback.findUnique({ where: { id: feedbackId } })];
                    case 1:
                        feedback = _a.sent();
                        if (!feedback) {
                            throw new http_1.NotFoundError('Feedback not found', root_1.AppErrorCode.NOT_FOUND, null);
                        }
                        return [4 /*yield*/, prisma.feedback.update({
                                where: { id: feedbackId },
                                data: {
                                    comment: input.comment,
                                    rating: input.rating,
                                    status: input.status,
                                    resolvedAt: input.status === 'RESOLVED' ? new Date() : undefined
                                },
                                include: {
                                    giver: { select: { firstName: true, lastName: true } },
                                    receiver: { select: { firstName: true, lastName: true } }
                                }
                            })];
                    case 2:
                        updatedFeedback = _a.sent();
                        if (!input.rating) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.updateReceiverRating(feedback.receiverId, feedback.receiverRole)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, updatedFeedback];
                }
            });
        });
    };
    FeedbackService.prototype.getFeedbackById = function (feedbackId) {
        return __awaiter(this, void 0, void 0, function () {
            var feedback;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.feedback.findUnique({
                            where: { id: feedbackId },
                            include: {
                                giver: { select: { firstName: true, lastName: true, email: true } },
                                receiver: { select: { firstName: true, lastName: true, email: true } },
                                order: true,
                                serviceOrder: true
                            }
                        })];
                    case 1:
                        feedback = _a.sent();
                        if (!feedback) {
                            throw new http_1.NotFoundError('Feedback not found', root_1.AppErrorCode.NOT_FOUND, null);
                        }
                        return [2 /*return*/, feedback];
                }
            });
        });
    };
    FeedbackService.prototype.calculateAvgResolutionTime = function (feedbacks) {
        var resolved = feedbacks.filter(function (f) { return f.status === client_1.FeedbackStatus.RESOLVED && f.resolvedAt; });
        if (!resolved.length)
            return 'N/A';
        var totalTime = resolved.reduce(function (sum, f) {
            var created = new Date(f.createdAt).getTime();
            var resolved = new Date(f.resolvedAt).getTime();
            return sum + (resolved - created);
        }, 0);
        var avgMs = totalTime / resolved.length;
        var days = Math.floor(avgMs / (1000 * 60 * 60 * 24));
        return days ? days + " days" : 'Less than a day';
    };
    return FeedbackService;
}());
exports.FeedbackService = FeedbackService;
