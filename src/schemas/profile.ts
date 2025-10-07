import { z } from "zod";

// Profile update schema (must provide at least one of these fields)
export const ProfileUpdateSchema = z
  .object({
    email: z.string().email({ message: "Invalid email address" }).optional(),
    firstName: z.string().min(1, { message: "First name cannot be empty" }).optional(),
    lastName: z.string().min(1, { message: "Last name cannot be empty" }).optional(),
    name: z.string().min(1, { message: "Name cannot be empty" }).optional(), // Kept as optional since User has a nullable name field
    phoneNumber: z.string().min(1, { message: "Phone number cannot be empty" }).optional(),
    avatar: z.string().url({ message: "Avatar must be a valid URL" }).optional(),
    dateOfBirth: z
      .string()
      .optional()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        { message: "Invalid date format for date of birth (expected ISO format, e.g., '1990-01-01')" }
      ),
  })
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "You must provide at least one field to update",
        path: [], // Apply to the root object
      });
    }
  });

export type ProfileUpdateData = z.infer<typeof ProfileUpdateSchema>;