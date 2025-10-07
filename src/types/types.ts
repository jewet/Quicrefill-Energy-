// types.ts
export type ProductType = "diesel" | "petrol" | "gas" | "electricity"; // Add more types here in the future

// Optional: Export an array of valid product types for dynamic validation
export const VALID_PRODUCT_TYPES: ProductType[] = ["diesel", "petrol", "gas", "electricity"];