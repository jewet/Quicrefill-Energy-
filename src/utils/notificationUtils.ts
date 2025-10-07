// src/utils/notificationUtils.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function logNotification(
  userId: string,
  eventTypeId: string,
  channel: string,
  payload: string,
  status: string,
  message: string
): Promise<void> {
  await prisma.notificationLog.create({
    data: {
      userId,
      eventTypeId,
      channel,
      type: channel, // Valid string values: "PUSH", "EMAIL", "SMS", "WEBHOOK"
      payload: JSON.parse(payload),
      status,
      recipient: channel === "EMAIL" ? "user-email" : channel === "SMS" ? "user-phone" : "device-token",
      message, // Store the message field
      createdAt: new Date(),
    },
  });
}