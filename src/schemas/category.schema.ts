// src/schemas/category.schema.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string({
    required_error: "Name is required",
  }).min(2, "Name must be at least 2 characters long"),
  description: z.string().optional(),
  image: z.string().url("Image URL must be a valid URL").optional(),
  active: z.boolean().optional().default(true), // Added active field with default
});

export const updateCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").optional(),
  description: z.string().optional(),
  image: z.string().url("Image URL must be a valid URL").optional(),
  active: z.boolean().optional(), // Added active field
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;