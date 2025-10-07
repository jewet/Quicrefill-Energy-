import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

// Global API rate limiter (100 requests per 15 mins per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit headers
  legacyHeaders: false, // Disable X-RateLimit headers
});

// Special rate limiter for login attempts (5 attempts per 5 minutes)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5-minute window
  max: 5, // Max 5 login attempts per 5 minutes
  message: "Too many login attempts. Try again in 5 minutes.",
  handler: (req, res) => {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
  },
});

// Special rate limiter for password reset requests (5 attempts per 15 minutes)
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // Max 5 password reset attempts per 15 minutes
  message: "Too many password reset requests. Try again in 15 minutes.",
  handler: (req, res) => {
    res.status(429).json({ error: "Too many password reset requests. Try again later." });
  },
});

export { limiter, loginLimiter, passwordResetLimiter };