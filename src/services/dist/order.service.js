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
exports.OrderService = void 0;
var client_1 = require("@prisma/client");
var appError_1 = require("../lib/utils/errors/appError");
var enum_1 = require("../lib/types/enum");
var prisma = new client_1.PrismaClient();
var OrderService = /** @class */ (function () {
    function OrderService() {
        this.DELIVERY_FEE = new client_1.Prisma.Decimal(1.50);
        this.SERVICE_CHARGE = new client_1.Prisma.Decimal(0.20);
    }
    /**
     * Create a new order from cart
     * @param userId - User ID
     * @param data - Order data
     * @returns Order
     */
    OrderService.prototype.createOrder = function (userId, data) {
        return __awaiter(this, void 0, Promise, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var user, deliveryAddress, cart, subtotal, orderItems, _i, _a, item, product, itemPrice, deliveryFee, serviceCharge, total, confirmationCode, isUnique, existingOrder, order, error_1;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 14, , 15]);
                                        return [4 /*yield*/, tx.user.findUnique({
                                                where: { id: userId }
                                            })];
                                    case 1:
                                        user = _b.sent();
                                        if (!user) {
                                            throw new appError_1.ApiError(404, "User not found");
                                        }
                                        return [4 /*yield*/, tx.customerAddress.findFirst({
                                                where: {
                                                    id: data.deliveryAddress,
                                                    customerId: userId
                                                }
                                            })];
                                    case 2:
                                        deliveryAddress = _b.sent();
                                        if (!deliveryAddress) {
                                            throw new appError_1.ApiError(404, "Delivery address not found");
                                        }
                                        return [4 /*yield*/, tx.cart.findUnique({
                                                where: { userId: userId },
                                                include: {
                                                    items: {
                                                        include: {
                                                            product: true
                                                        }
                                                    }
                                                }
                                            })];
                                    case 3:
                                        cart = _b.sent();
                                        if (!cart || cart.items.length === 0) {
                                            throw new appError_1.ApiError(400, "Cart is empty");
                                        }
                                        subtotal = 0;
                                        orderItems = [];
                                        _i = 0, _a = cart.items;
                                        _b.label = 4;
                                    case 4:
                                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                                        item = _a[_i];
                                        return [4 /*yield*/, tx.product.findUnique({
                                                where: { id: item.productId }
                                            })];
                                    case 5:
                                        product = _b.sent();
                                        if (!product) {
                                            throw new appError_1.ApiError(404, "Product " + item.productId + " not found");
                                        }
                                        if (product.status !== 'APPROVED') {
                                            throw new appError_1.ApiError(400, "Product " + product.name + " is not available for purchase");
                                        }
                                        if (product.stock < item.quantity) {
                                            throw new appError_1.ApiError(400, "Not enough stock for " + product.name + ". Only " + product.stock + " units available.");
                                        }
                                        itemPrice = parseFloat(product.price.toString()) * item.quantity;
                                        subtotal += itemPrice;
                                        // Prepare order item
                                        orderItems.push({
                                            productId: item.productId,
                                            quantity: item.quantity,
                                            price: product.price
                                        });
                                        // Update product stock and order count
                                        return [4 /*yield*/, tx.product.update({
                                                where: { id: item.productId },
                                                data: {
                                                    stock: product.stock - item.quantity,
                                                    orderCount: product.orderCount + 1
                                                }
                                            })];
                                    case 6:
                                        // Update product stock and order count
                                        _b.sent();
                                        _b.label = 7;
                                    case 7:
                                        _i++;
                                        return [3 /*break*/, 4];
                                    case 8:
                                        deliveryFee = this.DELIVERY_FEE;
                                        serviceCharge = this.SERVICE_CHARGE;
                                        total = new client_1.Prisma.Decimal(subtotal).add(deliveryFee).add(serviceCharge);
                                        confirmationCode = '';
                                        isUnique = false;
                                        _b.label = 9;
                                    case 9:
                                        if (!!isUnique) return [3 /*break*/, 11];
                                        confirmationCode = Math.floor(1000 + Math.random() * 9000).toString();
                                        return [4 /*yield*/, tx.order.findFirst({
                                                where: {
                                                    confirmationCode: confirmationCode,
                                                    orderStatus: {
                                                        notIn: [enum_1.OrderStatus.DELIVERED, enum_1.OrderStatus.CANCELLED]
                                                    }
                                                }
                                            })];
                                    case 10:
                                        existingOrder = _b.sent();
                                        // If no active order has this code, it's unique
                                        if (!existingOrder) {
                                            isUnique = true;
                                        }
                                        return [3 /*break*/, 9];
                                    case 11: return [4 /*yield*/, tx.order.create({
                                            data: {
                                                userId: userId,
                                                deliveryAddressId: data.deliveryAddress,
                                                subtotal: new client_1.Prisma.Decimal(subtotal),
                                                deliveryFee: deliveryFee,
                                                serviceCharge: serviceCharge,
                                                total: total,
                                                confirmationCode: confirmationCode,
                                                paymentMethod: data.paymentMethod,
                                                paymentStatus: data.paymentMethod === 'wallet' ? enum_1.TransactionStatus.COMPLETED : enum_1.TransactionStatus.PENDING,
                                                orderStatus: enum_1.OrderStatus.PENDING,
                                                notes: data.notes,
                                                items: {
                                                    create: orderItems.map(function (item) { return ({
                                                        productId: item.productId,
                                                        quantity: item.quantity,
                                                        price: item.price
                                                    }); })
                                                }
                                            },
                                            include: {
                                                items: {
                                                    include: {
                                                        product: true
                                                    }
                                                },
                                                deliveryAddress: true
                                            }
                                        })];
                                    case 12:
                                        order = _b.sent();
                                        // If payment method is wallet, process payment
                                        if (data.paymentMethod === 'wallet') {
                                            // TODO: Implement wallet payment processing
                                        }
                                        // Clear the cart after successful order creation
                                        return [4 /*yield*/, tx.cartItem.deleteMany({
                                                where: { cartId: cart.id }
                                            })];
                                    case 13:
                                        // Clear the cart after successful order creation
                                        _b.sent();
                                        return [2 /*return*/, order];
                                    case 14:
                                        error_1 = _b.sent();
                                        if (error_1 instanceof appError_1.ApiError)
                                            throw error_1;
                                        throw new appError_1.ApiError(500, "Failed to create order");
                                    case 15: return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Get all orders for a user with filtering, sorting, and pagination
     * @param userId - User ID
     * @param queryParams - Query parameters
     * @returns Orders and total count
     */
    OrderService.prototype.getUserOrders = function (userId, queryParams) {
        return __awaiter(this, void 0, Promise, function () {
            var where, totalCount, orders, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        where = {
                            userId: userId
                        };
                        if (queryParams.status) {
                            where.orderStatus = queryParams.status;
                        }
                        return [4 /*yield*/, prisma.order.count({ where: where })];
                    case 1:
                        totalCount = _b.sent();
                        return [4 /*yield*/, prisma.order.findMany({
                                where: where,
                                include: {
                                    items: {
                                        include: {
                                            product: true
                                        }
                                    },
                                    deliveryAddress: true,
                                    agent: {
                                        select: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true
                                        }
                                    }
                                },
                                take: queryParams.limit,
                                skip: (queryParams.page - 1) * queryParams.limit,
                                orderBy: (_a = {},
                                    _a[queryParams.sortBy] = queryParams.order,
                                    _a)
                            })];
                    case 2:
                        orders = _b.sent();
                        return [2 /*return*/, { orders: orders, totalCount: totalCount }];
                    case 3:
                        error_2 = _b.sent();
                        throw new appError_1.ApiError(500, "Failed to fetch orders");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all orders (admin only)
     * @param queryParams - Query parameters
     * @returns Orders and total count
     */
    OrderService.prototype.getAllOrders = function (queryParams) {
        return __awaiter(this, void 0, Promise, function () {
            var where, totalCount, orders, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        where = {};
                        if (queryParams.status) {
                            where.orderStatus = queryParams.status;
                        }
                        return [4 /*yield*/, prisma.order.count({ where: where })];
                    case 1:
                        totalCount = _b.sent();
                        return [4 /*yield*/, prisma.order.findMany({
                                where: where,
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            phoneNumber: true
                                        }
                                    },
                                    items: {
                                        include: {
                                            product: true
                                        }
                                    },
                                    deliveryAddress: true,
                                    agent: {
                                        select: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true
                                        }
                                    }
                                },
                                take: queryParams.limit,
                                skip: (queryParams.page - 1) * queryParams.limit,
                                orderBy: (_a = {},
                                    _a[queryParams.sortBy] = queryParams.order,
                                    _a)
                            })];
                    case 2:
                        orders = _b.sent();
                        return [2 /*return*/, { orders: orders, totalCount: totalCount }];
                    case 3:
                        error_3 = _b.sent();
                        throw new appError_1.ApiError(500, "Failed to fetch orders");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get order by ID
     * @param id - Order ID
     * @param userId - User ID
     * @param userRole - User role
     * @returns Order
     */
    OrderService.prototype.getOrderById = function (id, userId, userRole) {
        return __awaiter(this, void 0, Promise, function () {
            var order, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma.order.findUnique({
                                where: { id: id },
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            phoneNumber: true
                                        }
                                    },
                                    items: {
                                        include: {
                                            product: true
                                        }
                                    },
                                    deliveryAddress: true,
                                    agent: {
                                        select: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true
                                        }
                                    }
                                }
                            })];
                    case 1:
                        order = _a.sent();
                        if (!order) {
                            throw new appError_1.ApiError(404, "Order not found");
                        }
                        // Check if user has access to this order
                        if (userId &&
                            userRole !== client_1.Role.ADMIN &&
                            userRole !== client_1.Role.DELIVERY_AGENT &&
                            order.userId !== userId) {
                            throw new appError_1.ApiError(403, "You don't have permission to view this order");
                        }
                        return [2 /*return*/, order];
                    case 2:
                        error_4 = _a.sent();
                        if (error_4 instanceof appError_1.ApiError)
                            throw error_4;
                        throw new appError_1.ApiError(500, "Failed to fetch order");
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Cancel order
     * @param id - Order ID
     * @param userId - User ID
     * @param userRole - User role
     * @returns Order
     */
    OrderService.prototype.cancelOrder = function (id, userId, userRole) {
        return __awaiter(this, void 0, Promise, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var order, _i, _a, item, product, updatedOrder, error_5;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 10, , 11]);
                                        return [4 /*yield*/, tx.order.findUnique({
                                                where: { id: id },
                                                include: {
                                                    items: {
                                                        include: {
                                                            product: true
                                                        }
                                                    }
                                                }
                                            })];
                                    case 1:
                                        order = _b.sent();
                                        if (!order) {
                                            throw new appError_1.ApiError(404, "Order not found");
                                        }
                                        // Check if user has permission to cancel this order
                                        if (userRole !== client_1.Role.ADMIN && order.userId !== userId) {
                                            throw new appError_1.ApiError(403, "You don't have permission to cancel this order");
                                        }
                                        // Check if order can be cancelled
                                        if (order.orderStatus !== enum_1.OrderStatus.PENDING) {
                                            throw new appError_1.ApiError(400, "Only pending orders can be cancelled");
                                        }
                                        _i = 0, _a = order.items;
                                        _b.label = 2;
                                    case 2:
                                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                                        item = _a[_i];
                                        // Ensure productId exists (non-nullable in schema)
                                        if (!item.productId) {
                                            throw new appError_1.ApiError(500, "Order item " + item.id + " is missing productId");
                                        }
                                        if (!!item.product) return [3 /*break*/, 5];
                                        return [4 /*yield*/, tx.product.findUnique({
                                                where: { id: item.productId }
                                            })];
                                    case 3:
                                        product = _b.sent();
                                        if (!product) {
                                            throw new appError_1.ApiError(404, "Product " + item.productId + " not found for order item " + item.id);
                                        }
                                        return [4 /*yield*/, tx.product.update({
                                                where: { id: item.productId },
                                                data: {
                                                    stock: product.stock + item.quantity,
                                                    orderCount: product.orderCount - 1
                                                }
                                            })];
                                    case 4:
                                        _b.sent();
                                        return [3 /*break*/, 7];
                                    case 5: return [4 /*yield*/, tx.product.update({
                                            where: { id: item.productId },
                                            data: {
                                                stock: item.product.stock + item.quantity,
                                                orderCount: item.product.orderCount - 1
                                            }
                                        })];
                                    case 6:
                                        _b.sent();
                                        _b.label = 7;
                                    case 7:
                                        _i++;
                                        return [3 /*break*/, 2];
                                    case 8: return [4 /*yield*/, tx.order.update({
                                            where: { id: id },
                                            data: {
                                                orderStatus: enum_1.OrderStatus.CANCELLED,
                                                paymentStatus: enum_1.TransactionStatus.FAILED
                                            },
                                            include: {
                                                items: {
                                                    include: {
                                                        product: true
                                                    }
                                                },
                                                deliveryAddress: true
                                            }
                                        })];
                                    case 9:
                                        updatedOrder = _b.sent();
                                        // If payment was already processed, issue refund
                                        if (order.paymentStatus === enum_1.TransactionStatus.COMPLETED) {
                                            // TODO: Implement refund processing
                                        }
                                        return [2 /*return*/, updatedOrder];
                                    case 10:
                                        error_5 = _b.sent();
                                        if (error_5 instanceof appError_1.ApiError)
                                            throw error_5;
                                        throw new appError_1.ApiError(500, "Failed to cancel order");
                                    case 11: return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Update order status (admin and delivery agent only)
     * @param id - Order ID
     * @param data - Status data
     * @returns Order
     */
    OrderService.prototype.updateOrderStatus = function (id, data) {
        return __awaiter(this, void 0, Promise, function () {
            var order, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma.order.findUnique({
                                where: { id: id }
                            })];
                    case 1:
                        order = _a.sent();
                        if (!order) {
                            throw new appError_1.ApiError(404, "Order not found");
                        }
                        // Validate status transition
                        this.validateStatusTransition(order.orderStatus, data.status);
                        return [4 /*yield*/, prisma.order.update({
                                where: { id: id },
                                data: {
                                    orderStatus: data.status
                                },
                                include: {
                                    items: {
                                        include: {
                                            product: true
                                        }
                                    },
                                    deliveryAddress: true,
                                    agent: {
                                        select: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true
                                        }
                                    }
                                }
                            })];
                    case 2: 
                    // Update order status
                    return [2 /*return*/, _a.sent()];
                    case 3:
                        error_6 = _a.sent();
                        if (error_6 instanceof appError_1.ApiError)
                            throw error_6;
                        throw new appError_1.ApiError(500, "Failed to update order status");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update payment status (admin only)
     * @param id - Order ID
     * @param data - Status data
     * @returns Order
     */
    OrderService.prototype.updatePaymentStatus = function (id, data) {
        return __awaiter(this, void 0, Promise, function () {
            var order, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, prisma.order.findUnique({
                                where: { id: id }
                            })];
                    case 1:
                        order = _a.sent();
                        if (!order) {
                            throw new appError_1.ApiError(404, "Order not found");
                        }
                        return [4 /*yield*/, prisma.order.update({
                                where: { id: id },
                                data: {
                                    paymentStatus: data.status
                                },
                                include: {
                                    items: {
                                        include: {
                                            product: true
                                        }
                                    },
                                    deliveryAddress: true
                                }
                            })];
                    case 2: 
                    // Update payment status
                    return [2 /*return*/, _a.sent()];
                    case 3:
                        error_7 = _a.sent();
                        if (error_7 instanceof appError_1.ApiError)
                            throw error_7;
                        throw new appError_1.ApiError(500, "Failed to update payment status");
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Assign delivery agent to order (admin only)
     * @param orderId - Order ID
     * @param agentId - Delivery agent ID
     * @returns Order
     */
    OrderService.prototype.assignRider = function (orderId, agentId) {
        return __awaiter(this, void 0, Promise, function () {
            var order, agent, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, prisma.order.findUnique({
                                where: { id: orderId }
                            })];
                    case 1:
                        order = _a.sent();
                        if (!order) {
                            throw new appError_1.ApiError(404, "Order not found");
                        }
                        return [4 /*yield*/, prisma.user.findFirst({
                                where: {
                                    id: agentId,
                                    role: client_1.Role.DELIVERY_AGENT
                                }
                            })];
                    case 2:
                        agent = _a.sent();
                        if (!agent) {
                            throw new appError_1.ApiError(404, "Delivery agent not found");
                        }
                        return [4 /*yield*/, prisma.order.update({
                                where: { id: orderId },
                                data: {
                                    agentId: agentId,
                                    orderStatus: enum_1.OrderStatus.RIDER_ASSIGNED
                                },
                                include: {
                                    items: {
                                        include: {
                                            product: true
                                        }
                                    },
                                    deliveryAddress: true,
                                    agent: {
                                        select: {
                                            id: true,
                                            name: true,
                                            phoneNumber: true
                                        }
                                    }
                                }
                            })];
                    case 3: 
                    // Assign agent and update status to RIDER_ASSIGNED
                    return [2 /*return*/, _a.sent()];
                    case 4:
                        error_8 = _a.sent();
                        if (error_8 instanceof appError_1.ApiError)
                            throw error_8;
                        throw new appError_1.ApiError(500, "Failed to assign delivery agent");
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper to validate order status transitions
     * @param currentStatus - Current order status
     * @param newStatus - New order status
     */
    OrderService.prototype.validateStatusTransition = function (currentStatus, newStatus) {
        var _a;
        var _b;
        var validTransitions = (_a = {},
            _a[enum_1.OrderStatus.PENDING] = [enum_1.OrderStatus.PROCESSING, enum_1.OrderStatus.CANCELLED],
            _a[enum_1.OrderStatus.PROCESSING] = [enum_1.OrderStatus.RIDER_ASSIGNED, enum_1.OrderStatus.CANCELLED],
            _a[enum_1.OrderStatus.RIDER_ASSIGNED] = [enum_1.OrderStatus.OUT_FOR_DELIVERY, enum_1.OrderStatus.CANCELLED],
            _a[enum_1.OrderStatus.OUT_FOR_DELIVERY] = [enum_1.OrderStatus.DELIVERED, enum_1.OrderStatus.CANCELLED],
            _a[enum_1.OrderStatus.DELIVERED] = [],
            _a[enum_1.OrderStatus.CANCELLED] = [],
            _a);
        if (!((_b = validTransitions[currentStatus]) === null || _b === void 0 ? void 0 : _b.includes(newStatus))) {
            throw new appError_1.ApiError(400, "Cannot transition from " + currentStatus + " to " + newStatus);
        }
    };
    return OrderService;
}());
exports.OrderService = OrderService;
