// src/schemas/cart.schema.ts
import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string({
    required_error: "Product ID is required",
  }),
  quantity: z.number({
    required_error: "Quantity is required",
  }).int().positive("Quantity must be a positive integer"),
});

export const updateCartItemSchema = z.object({
  quantity: z.number({
    required_error: "Quantity is required",
  }).int().positive("Quantity must be a positive integer"),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;