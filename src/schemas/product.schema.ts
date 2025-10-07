import { z } from "zod";
import { ProductStatus } from "../lib/types/enum";

export const createProductSchema = z.object({
  name: z.string({
    required_error: "Name is required",
  }).min(2, "Name must be at least 2 characters long"),
  description: z.string({
    required_error: "Description is required",
  }).min(10, "Description must be at least 10 characters long"),
  price: z.number({
    required_error: "Price is required",
  }).positive("Price must be a positive number"),
  salePrice: z.number().positive("Sale price must be a positive number").optional(),
  imageUrl: z.string().url("Image URL must be a valid URL").optional(),
  images: z.array(z.string().url("Image URL must be a valid URL")).optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  stock: z.number().int().nonnegative("Stock cannot be negative").default(0),
  featured: z.boolean().optional(),
  categoryId: z.string({
    required_error: "Category ID is required",
  }),
  productTypeId: z.string().optional(), // Added productTypeId
});

export const updateProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").optional(),
  description: z.string().min(10, "Description must be at least 10 characters long").optional(),
  price: z.number().positive("Price must be a positive number").optional(),
  salePrice: z.number().positive("Sale price must be a positive number").optional(),
  imageUrl: z.string().url("Image URL must be a valid URL").optional(),
  images: z.array(z.string().url("Image URL must be a valid URL")).optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  stock: z.number().int().nonnegative("Stock cannot be negative").optional(),
  featured: z.boolean().optional(),
  categoryId: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  productTypeId: z.string().optional(), // Added productTypeId
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export const productQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  brand: z.string().optional(),
  sortBy: z.enum(['price', 'name', 'rating', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  productTypeId: z.string().optional(), // Added productTypeId
});

export const vendorProductQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  brand: z.string().optional(),
  sortBy: z.enum(['price', 'name', 'rating', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.union([z.nativeEnum(ProductStatus), z.literal('ALL')]).optional(),
  productTypeId: z.string().optional(), // Added productTypeId
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type VendorProductQueryInput = z.infer<typeof vendorProductQuerySchema>;