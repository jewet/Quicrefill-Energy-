import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { verifyToken } from "../../../lib/utils/jwt/verifyToken";

export const TokenVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Define the Zod schema for token validation
    const tokenSchema = z.object({
      token: z.string({
        required_error: "Token is required",
        invalid_type_error: "Token must be a string",
      }).min(1, "Token cannot be empty"),
    });

    // Parse and validate the request body
    const { token } = await tokenSchema.parseAsync(req.body);

    // Verify the token
    const payload = await verifyToken(token);

    // Send success response
    res.status(200).json({
      success: true,
      data: payload,
      message: "Token verified successfully",
    });
  } catch (error) {
    // Handle specific Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: error.errors,
        message: "Invalid or missing token",
      });
    }

    // Pass other errors to the error handler middleware
    next(error);
  }
};