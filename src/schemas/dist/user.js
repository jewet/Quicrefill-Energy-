"use strict";
exports.__esModule = true;
exports.RegisterUserSchema = void 0;
var zod_1 = require("zod");
var client_1 = require("@prisma/client");
exports.RegisterUserSchema = zod_1.z.object({
    email: zod_1.z.string({
        required_error: "Email is required",
        invalid_type_error: "Email must be a string"
    }).email({ message: "Invalid email address" }),
    firstName: zod_1.z.string({
        required_error: "First name is required",
        invalid_type_error: "First name must be a string"
    }),
    lastName: zod_1.z.string({
        required_error: "Last name is required",
        invalid_type_error: "Last name must be a string"
    }),
    password: zod_1.z.string().min(6, { message: "Password must be at least 6 characters long" }).optional(),
    role: zod_1.z.nativeEnum(client_1.Role).optional(),
    isSocialAccount: zod_1.z.boolean()["default"](false).optional(),
    socialAccountProvider: zod_1.z["enum"](["FACEBOOK", "GOOGLE"]).nullable().optional(),
    address: zod_1.z.string().optional(),
    phoneNumber: zod_1.z.string().optional()
}).superRefine(function (data, ctx) {
    if (!data.isSocialAccount) {
        if (!data.password) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Password is required for non-social account registration",
                path: ["password"]
            });
        }
        if (data.socialAccountProvider !== null && data.socialAccountProvider !== undefined) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Social account type should not be provided for non-social account registration",
                path: ["socialAccountProvider"]
            });
        }
    }
    else {
        if (!data.socialAccountProvider) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Social account type is required for social account registration",
                path: ["socialAccountProvider"]
            });
        }
        if (data.password) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "Password should not be provided for social account registration",
                path: ["password"]
            });
        }
    }
});
