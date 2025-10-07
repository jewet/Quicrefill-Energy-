"use strict";
exports.__esModule = true;
exports.ProfileUpdateSchema = void 0;
var zod_1 = require("zod");
// Profile update schema (must provide at least one of these fields)
exports.ProfileUpdateSchema = zod_1.z
    .object({
    email: zod_1.z.string().email({ message: "Invalid email address" }).optional(),
    firstName: zod_1.z.string().min(1, { message: "First name cannot be empty" }).optional(),
    lastName: zod_1.z.string().min(1, { message: "Last name cannot be empty" }).optional(),
    name: zod_1.z.string().min(1, { message: "Name cannot be empty" }).optional(),
    phoneNumber: zod_1.z.string().min(1, { message: "Phone number cannot be empty" }).optional(),
    avatar: zod_1.z.string().url({ message: "Avatar must be a valid URL" }).optional(),
    dateOfBirth: zod_1.z
        .string()
        .optional()
        .refine(function (val) { return !val || !isNaN(Date.parse(val)); }, { message: "Invalid date format for date of birth (expected ISO format, e.g., '1990-01-01')" })
})
    .superRefine(function (data, ctx) {
    if (!Object.values(data).some(function (value) { return value !== undefined; })) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "You must provide at least one field to update",
            path: []
        });
    }
});
