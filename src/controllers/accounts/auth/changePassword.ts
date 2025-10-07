import { NextFunction, Request, Response } from "express";
import { prismaClient } from "../../../config/db";
import bcrypt from "bcryptjs";
import { setWithExpiry } from "../../../utils/inMemoryStore";
import { emailTemplateService } from "../../../services/email"; // Import EmailService
import { HttpResponse } from "../../../utils/http.util";
import winston from "winston";

export const TWO_HOURS_IN_SECONDS = 2 * 60 * 60;

// Logger setup (consistent with EmailService and EmailController)
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console(),
  ],
});

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { oldPassword, newPassword } = req.body;

    // Validate inputs
    if (!userId || !oldPassword || !newPassword) {
      return HttpResponse.error(res, "All fields (oldPassword, newPassword) are required", 400);
    }
    if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
      return HttpResponse.error(res, "Passwords must be strings", 400);
    }
    if (newPassword.length < 6) {
      return HttpResponse.error(res, "New password must be at least 6 characters long", 400);
    }

    // Verify user and old password
    const user = await prismaClient.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(oldPassword, user.password || ""))) {
      return HttpResponse.error(res, "Invalid old password", 401);
    }

    // Update password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prismaClient.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // Blacklist the current token
    const currentToken = req.cookies?.token || req.headers.authorization?.split(" ")[1] || "";
    if (currentToken) {
      setWithExpiry(`blacklist:${currentToken}`, "true", TWO_HOURS_IN_SECONDS);
    }

    // Send password change confirmation email
    try {
      await emailTemplateService.sendEmail({
        eventType: "PASSWORD_CHANGED",
        customPayload: {
          to: user.email,
          subject: "Your Quicrefill Password Has Been Changed",
          htmlContent: `<p>Dear ${user.name || "User"},</p>
                        <p>Your password has been successfully changed.</p>
                        <p>If you did not initiate this change, please contact support immediately.</p>
                        <p>Best regards,<br>Quicrefill Team</p>`,
        },
        metadata: {
          userId: user.id,
          name: user.name || "User",
          email: user.email,
        },
      });
      logger.info("Password change email sent", { email: user.email });
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
      logger.error("Failed to send password change email", { email: user.email, error: errorMessage });
      // Don’t block response due to email failure
    }

    return HttpResponse.success(res, null, "Password changed successfully");
  } catch (error) {
    logger.error("changePassword error", { error: error instanceof Error ? error.message : "Unknown error" });
    next(error);
  }
};