import { z } from "zod";
import { OrderStatus, TransactionStatus, PaymentMethod } from '@prisma/client';

export const createOrderSchema = z.object({
  deliveryAddressId: z.string({
    required_error: "Delivery address ID is required",
  }).uuid("Delivery address ID must be a valid UUID"),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    required_error: "Payment method is required",
  }),
  notes: z.string().optional(),
  voucherCode: z.string().optional(),
  cardDetails: z
    .object({
      cardno: z.string({
        required_error: "Card number is required for CARD payment",
      }).regex(/^\d{13,19}$/, "Card number must be 13 to 19 digits"),
      cvv: z.string({
        required_error: "CVV is required for CARD payment",
      }).regex(/^\d{3,4}$/, "CVV must be 3 or 4 digits"),
      expirymonth: z.string({
        required_error: "Expiry month is required for CARD payment",
      }).regex(/^\d{2}$/, "Expiry month must be a two-digit number").refine(
        (val) => {
          const month = parseInt(val);
          return month >= 1 && month <= 12;
        },
        "Expiry month must be between 01 and 12"
      ),
      expiryyear: z.string({
        required_error: "Expiry year is required for CARD payment",
      }).regex(/^\d{2}$/, "Expiry year must be a two-digit number").refine(
        (val) => {
          const year = parseInt(val);
          const currentYear = new Date().getFullYear() % 100;
          return year >= currentYear;
        },
        "Expiry year must be current year or later"
      ),
      pin: z.string().optional(),
      suggested_auth: z.string().optional(),
      billingzip: z.string().optional(),
      billingcity: z.string().optional(),
      billingaddress: z.string().optional(),
      billingstate: z.string().optional(),
      billingcountry: z.string().optional(),
    })
    .optional(),
}).superRefine((data, ctx) => {
  // Validate that cardDetails is provided when paymentMethod is CARD
  if (data.paymentMethod === PaymentMethod.CARD && !data.cardDetails) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Card details are required for CARD payment",
      path: ["cardDetails"],
    });
  }

  // Validate cardDetails completeness and expiration
  if (data.cardDetails && data.paymentMethod === PaymentMethod.CARD) {
    const { cardno, cvv, expirymonth, expiryyear } = data.cardDetails;
    if (!cardno || !cvv || !expirymonth || !expiryyear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Incomplete card details: cardno, cvv, expirymonth, and expiryyear are required",
        path: ["cardDetails"],
      });
    } else {
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;
      const month = parseInt(expirymonth);
      const year = parseInt(expiryyear);
      if (year === currentYear && month < currentMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid or expired card details",
          path: ["cardDetails"],
        });
      }
    }
  }
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    required_error: "Status is required",
  }),
  notes: z.string().optional(), // Added optional notes field
});

export const updatePaymentStatusSchema = z.object({
  status: z.nativeEnum(TransactionStatus, {
    required_error: "Status is required",
  }),
});

export const orderQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).optional().transform(val => {
    if (val === undefined) return 1;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return isNaN(num) ? 1 : num;
  }),
  limit: z.union([z.string(), z.number()]).optional().transform(val => {
    if (val === undefined) return 10;
    const num = typeof val === 'string' ? parseInt(val) : val;
    return isNaN(num) ? 10 : num;
  }),
  status: z.nativeEnum(OrderStatus).optional(),
  sortBy: z.enum(['createdAt', 'total']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;