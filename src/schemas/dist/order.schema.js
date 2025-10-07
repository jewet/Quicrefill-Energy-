"use strict";
exports.__esModule = true;
exports.orderQuerySchema = exports.updatePaymentStatusSchema = exports.updateOrderStatusSchema = exports.createOrderSchema = void 0;
// src/schemas/order.schema.ts
var zod_1 = require("zod");
var enum_1 = require("../lib/types/enum");
exports.createOrderSchema = zod_1.z.object({
    deliveryAddress: zod_1.z.string({
        required_error: "Delivery address is required"
    }),
    paymentMethod: zod_1.z.string({
        required_error: "Payment method is required"
    }),
    notes: zod_1.z.string().optional()
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(enum_1.OrderStatus, {
        required_error: "Status is required"
    })
});
exports.updatePaymentStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(enum_1.TransactionStatus, {
        required_error: "Status is required"
    })
});
exports.orderQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform(function (val) { return val ? parseInt(val) : 1; }),
    limit: zod_1.z.string().optional().transform(function (val) { return val ? parseInt(val) : 10; }),
    status: zod_1.z.nativeEnum(enum_1.OrderStatus).optional(),
    sortBy: zod_1.z["enum"](['createdAt', 'total']).optional()["default"]('createdAt'),
    order: zod_1.z["enum"](['asc', 'desc']).optional()["default"]('desc')
});
