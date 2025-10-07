import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { authenticationMiddleware, authorizeRoles } from "../middlewares/authentication";
import { login } from "../controllers/accounts/auth/login";
import { getProfile } from "../controllers/accounts/auth/getProfile";
import { register } from "../controllers/accounts/auth/register";
import { logout } from "../controllers/accounts/auth/logout";
import { errorHandler } from "../lib/handlers/errorHandler";
import { RequestAccountVerify } from "../controllers/root";
import { JWT_ACCESS_SECRET } from "../secrets";

// Load environment variables
dotenv.config();

// Initialize the router
const authRoutes = express.Router();

// Wrapper to handle async middleware compatibility with Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response> | void | Response) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Register a new user
authRoutes.post("/register", errorHandler(register));

// Authenticate a user and return JWT token
authRoutes.post("/login", errorHandler(login));

// Get current user's profile
authRoutes.get("/me", asyncHandler(authenticationMiddleware), errorHandler(getProfile));

// Logout user and clear JWT cookie
authRoutes.post("/logout", asyncHandler(authenticationMiddleware), errorHandler(logout));

// Request email verification OTP
authRoutes.post("/request-account-verify", errorHandler(RequestAccountVerify));

// Generate test JWT token (Development only)
authRoutes.post(
  "/test-login",
  asyncHandler(async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Forbidden in production" });
    }
    try {
      const secretKey = JWT_ACCESS_SECRET;
      if (!secretKey) throw new Error("JWT_ACCESS_SECRET is not defined in .env");
      const token = jwt.sign({ id: "dummy-user-123", role: "CUSTOMER" }, secretKey, {
        expiresIn: "1h",
        algorithm: "HS256",
      });
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 1000,
      });
      res.json({ message: "Test login successful", user: { id: "dummy-user-123", role: "CUSTOMER" } });
    } catch (error) {
      console.error("❌ Test login error:", error);
      res.status(500).json({ error: "Failed to generate test token" });
    }
  })
);

// Admin-only test endpoint
authRoutes.get(
  "/admin-test",
  asyncHandler(authenticationMiddleware),
  asyncHandler(authorizeRoles(["ADMIN"])),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: "Welcome, Admin!" });
  })
);

export { authRoutes };