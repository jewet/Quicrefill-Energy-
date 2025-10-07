import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticationMiddleware, AuthUser } from "../../middlewares/authentication";

const router = express.Router();
const prisma = new PrismaClient();

// Define the request body validation schema
const deviceTokenSchema = z.object({
  deviceToken: z.string().min(1, "Device token is required"),
});

// Define the request type
interface DeviceTokenRequest extends Request {
  body: {
    deviceToken: string;
  };
  user?: AuthUser;
}

/**
 * @swagger
 * /device-token:
 *   post:
 *     summary: Register FCM device token for a user
 *     tags: [Device]
 *     description: Registers a Firebase Cloud Messaging (FCM) device token for the authenticated user to enable push notifications.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceToken
 *             properties:
 *               deviceToken:
 *                 type: string
 *                 description: The FCM device token to register for push notifications.
 *                 example: "fcm_device_token_example"
 *     responses:
 *       200:
 *         description: Device token successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Device token registered"
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Device token is required"
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User not authenticated"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post(
  "/device-token",
  authenticationMiddleware,
  async (req: DeviceTokenRequest, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const { deviceToken } = deviceTokenSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { pushToken: deviceToken },
      });

      res.status(200).json({ message: "Device token registered" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;