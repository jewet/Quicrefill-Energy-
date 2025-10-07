import { PrismaClient, NotificationType } from "@prisma/client";
import retry from "async-retry";
import { messaging } from "../config/firebase";
import axios from "axios";
import { renderTemplate, DynamicData } from "../utils/templateRenderer";
import { logNotification } from "../utils/notificationUtils";
import { KnownEventTypes, RoleEventApplicability } from "../utils/EventTypeDictionary";
import { Request, Response } from "express";
import { notificationLimiter } from "../middlewares/notificationLimiterMiddleware";
import { emailTemplateService } from "./email";
import { smsTemplateService } from "./SMSTemplateService";

const prisma = new PrismaClient();

interface NotificationPayload {
  eventTypeName: KnownEventTypes;
  dynamicData: DynamicData;
  userIds?: string[];
  roles?: string[]; // Role IDs as strings (from Role table)
}

// Helper function to apply notification limiter as a promise
async function applyNotificationLimiter(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    notificationLimiter(req, res, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Helper function to fetch valid role IDs from the Role table
async function getValidRoleIds(): Promise<string[]> {
  const roles = await prisma.role.findMany({
    select: { id: true },
  });
  return roles.map((role) => role.id);
}

async function dispatchPushNotification(payload: NotificationPayload, req: Request, res: Response): Promise<void> {
  await applyNotificationLimiter(req, res);

  const { eventTypeName, dynamicData, userIds, roles } = payload;

  const eventType = await prisma.eventType.findFirst({
    where: { name: eventTypeName },
  });

  if (!eventType) {
    throw new Error(`Event type ${eventTypeName} not found`);
  }

  // Use provided roles or fallback to RoleEventApplicability, validated against Role table
  const validRoleIds = await getValidRoleIds();
  const applicableRoles = roles?.filter((roleId) => validRoleIds.includes(roleId)) || RoleEventApplicability[eventTypeName] || [];
  const notificationType = mapEventTypeToNotificationType(eventTypeName);

  const template = await prisma.pushTemplate.findFirst({
    where: {
      eventType: { name: eventTypeName },
      isActive: true,
      roles: { some: { id: { in: applicableRoles } } },
    },
  });

  if (!template) {
    throw new Error(`No active push template found for event ${eventTypeName}`);
  }

  const { content: body, title } = renderTemplate(template, dynamicData, "PUSH");
  const safeBody = body || `Notification: ${dynamicData.message || "You have a new notification."}`;
  const safeTitle = title || "Quicrefill Notification";

  const batchSize = 500; // FCM multicast limit
  const users = await prisma.user.findMany({
    where: {
      OR: [
        userIds ? { id: { in: userIds } } : {},
        applicableRoles.length ? { roleId: { in: applicableRoles } } : {},
      ].filter(Boolean),
      pushToken: { not: undefined },
      notificationPreferences: {
        pushEnabled: true,
        notificationTypes: { has: notificationType },
        ...(eventTypeName === KnownEventTypes.PASSWORD_CHANGE && { passwordChangeEnabled: true }),
      },
    },
    select: { id: true, pushToken: true },
  });

  if (!users.length) {
    console.warn(`No users with push tokens and enabled preferences found for event ${eventTypeName}`);
    return;
  }

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const tokens = batch.map((user) => user.pushToken).filter((token): token is string => !!token);

    if (tokens.length) {
      const message = {
        notification: {
          title: safeTitle,
          body: safeBody,
        },
        tokens,
      };

      await retry(
        async () => {
          const response = await messaging.sendEachForMulticast(message);
          console.log(`Sent ${response.successCount} push notifications in batch ${i / batchSize + 1}`);

          for (const user of batch) {
            await logNotification(
              user.id,
              eventType.id,
              "PUSH",
              JSON.stringify({ title: safeTitle, body: safeBody }),
              response.successCount > 0 ? "SENT" : "FAILED",
              `${safeTitle}: ${safeBody}`
            );
          }

          if (response.failureCount) {
            throw new Error(`Failed to send ${response.failureCount} push notifications in batch`);
          }
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (err: Error) => console.warn(`Retrying push notification batch: ${err.message}`),
        }
      ).catch((error: Error) => {
        console.error(`Error sending push batch ${i / batchSize + 1}: ${error.message}`);
        for (const user of batch) {
          logNotification(
            user.id,
            eventType.id,
            "PUSH",
            JSON.stringify({ title: safeTitle, body: safeBody }),
            "FAILED",
            `${safeTitle}: ${safeBody}`
          );
        }
      });
    }
  }
}

async function dispatchEmailNotification(payload: NotificationPayload, req: Request, res: Response): Promise<void> {
  await applyNotificationLimiter(req, res);

  const { eventTypeName, dynamicData, userIds, roles } = payload;

  const eventType = await prisma.eventType.findFirst({
    where: { name: eventTypeName },
  });

  if (!eventType) {
    throw new Error(`Event type ${eventTypeName} not found`);
  }

  const validRoleIds = await getValidRoleIds();
  const applicableRoles = roles?.filter((roleId) => validRoleIds.includes(roleId)) || RoleEventApplicability[eventTypeName] || [];
  const notificationType = mapEventTypeToNotificationType(eventTypeName);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        userIds ? { id: { in: userIds } } : {},
        applicableRoles.length ? { roleId: { in: applicableRoles } } : {},
      ].filter(Boolean),
      email: { not: undefined },
      notificationPreferences: {
        emailEnabled: true,
        notificationTypes: { has: notificationType },
        ...(eventTypeName === KnownEventTypes.PASSWORD_CHANGE && { passwordChangeEnabled: true }),
      },
    },
    select: { id: true, email: true },
  });

  if (!users.length) {
    console.warn(`No users with emails and enabled preferences found for event ${eventTypeName}`);
    return;
  }

  await emailTemplateService.sendEmail({
    eventType: eventTypeName,
    userIds: users.map((user) => user.id),
    metadata: dynamicData,
  });

  for (const user of users) {
    const template = await prisma.emailTemplate.findFirst({
      where: { eventType: { name: eventTypeName }, isActive: true },
    });
    const { content: body, title: subject } = template
      ? renderTemplate(template, dynamicData, "EMAIL")
      : { content: `Notification: ${dynamicData.message || "You have a new notification."}`, title: "Quicrefill Notification" };
    const safeBody = body || `Notification: ${dynamicData.message || "You have a new notification."}`;
    const safeSubject = subject || "Quicrefill Notification";

    await logNotification(
      user.id,
      eventType.id,
      "EMAIL",
      JSON.stringify({ eventType: eventTypeName, email: user.email, subject: safeSubject, body: safeBody }),
      "SENT",
      `${safeSubject}: ${safeBody}`
    );
  }
}

async function dispatchSMSNotification(payload: NotificationPayload, req: Request, res: Response): Promise<void> {
  await applyNotificationLimiter(req, res);

  const { eventTypeName, dynamicData, userIds, roles } = payload;

  const eventType = await prisma.eventType.findFirst({
    where: { name: eventTypeName },
  });

  if (!eventType) {
    throw new Error(`Event type ${eventTypeName} not found`);
  }

  const validRoleIds = await getValidRoleIds();
  const applicableRoles = roles?.filter((roleId) => validRoleIds.includes(roleId)) || RoleEventApplicability[eventTypeName] || [];
  const notificationType = mapEventTypeToNotificationType(eventTypeName);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        userIds ? { id: { in: userIds } } : {},
        applicableRoles.length ? { roleId: { in: applicableRoles } } : {},
      ].filter(Boolean),
      phoneNumber: { not: undefined },
      notificationPreferences: {
        smsEnabled: true,
        notificationTypes: { has: notificationType },
        ...(eventTypeName === KnownEventTypes.PASSWORD_CHANGE && { passwordChangeEnabled: true }),
      },
    },
    select: { id: true, phoneNumber: true },
  });

  if (!users.length) {
    console.warn(`No users with phone numbers and enabled preferences found for event ${eventTypeName}`);
    return;
  }

  try {
    await smsTemplateService.sendSMS({
      eventType: eventTypeName,
      userIds: users.map((user) => user.id),
      metadata: dynamicData,
    });

    const template = await prisma.sMSTemplate.findFirst({
      where: { eventTypeId: eventType.id, isActive: true },
    });
    const { content: body } = template
      ? renderTemplate(template, dynamicData, "SMS")
      : { content: `Notification: ${dynamicData.message || "You have a new notification."}` };
    const safeBody = body || `Notification: ${dynamicData.message || "You have a new notification."}`;

    for (const user of users) {
      await logNotification(
        user.id,
        eventType.id,
        "SMS",
        JSON.stringify({ eventType: eventTypeName, phoneNumber: user.phoneNumber, body: safeBody }),
        "SENT",
        safeBody
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error sending SMS notifications: ${errorMessage}`);

    const template = await prisma.sMSTemplate.findFirst({
      where: { eventTypeId: eventType.id, isActive: true },
    });
    const { content: body } = template
      ? renderTemplate(template, dynamicData, "SMS")
      : { content: `Notification: ${dynamicData.message || "You have a new notification."}` };
    const safeBody = body || `Notification: ${dynamicData.message || "You have a new notification."}`;

    for (const user of users) {
      await logNotification(
        user.id,
        eventType.id,
        "SMS",
        JSON.stringify({ eventType: eventTypeName, phoneNumber: user.phoneNumber, body: safeBody, error: errorMessage }),
        "FAILED",
        safeBody
      );
    }
  }
}

async function dispatchWebhookNotification(payload: NotificationPayload, req: Request, res: Response): Promise<void> {
  await applyNotificationLimiter(req, res);

  const { eventTypeName, dynamicData, userIds, roles } = payload;

  const eventType = await prisma.eventType.findFirst({
    where: { name: eventTypeName },
  });

  if (!eventType) {
    throw new Error(`Event type ${eventTypeName} not found`);
  }

  const validRoleIds = await getValidRoleIds();
  const applicableRoles = roles?.filter((roleId) => validRoleIds.includes(roleId)) || RoleEventApplicability[eventTypeName] || [];
  const webhooks = await prisma.webhook.findMany({
    where: {
      eventType: { name: eventTypeName },
      isActive: true,
      roles: { some: { id: { in: applicableRoles } } },
    },
  });

  if (!webhooks.length) {
    console.warn(`No active webhooks found for event ${eventTypeName}`);
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        userIds ? { id: { in: userIds } } : {},
        applicableRoles.length ? { roleId: { in: applicableRoles } } : {},
      ].filter(Boolean),
    },
    select: { id: true, email: true, phoneNumber: true },
  });

  const message = JSON.stringify({ eventType: eventTypeName, users, dynamicData });

  for (const webhook of webhooks) {
    await retry(
      async () => {
        await axios.post(webhook.url, {
          eventType: eventTypeName,
          users: users.map((user) => ({
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
          })),
          dynamicData,
        });
        await logNotification(
          webhook.createdBy,
          eventType.id,
          "WEBHOOK",
          JSON.stringify({ url: webhook.url, eventType: eventTypeName, dynamicData }),
          "SENT",
          message
        );
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onRetry: (err: Error) => console.warn(`Retrying webhook to ${webhook.url}: ${err.message}`),
      }
    ).catch((error: Error) => {
      console.error(`Error sending webhook to ${webhook.url}: ${error.message}`);
      logNotification(
        webhook.createdBy,
        eventType.id,
        "WEBHOOK",
        JSON.stringify({ url: webhook.url, eventType: eventTypeName, dynamicData }),
        "FAILED",
        message
      );
    });
  }
}

async function dispatchNotification(payload: NotificationPayload, req: Request, res: Response): Promise<void> {
  await Promise.all([
    dispatchPushNotification(payload, req, res),
    dispatchEmailNotification(payload, req, res),
    dispatchSMSNotification(payload, req, res),
    dispatchWebhookNotification(payload, req, res),
  ]);
}

function mapEventTypeToNotificationType(eventType: KnownEventTypes): NotificationType {
  switch (eventType) {
    case KnownEventTypes.NEW_ORDER:
    case KnownEventTypes.ORDER_UPDATE:
    case KnownEventTypes.ORDER_CONFIRMED:
      return NotificationType.NEW_ORDER;
    case KnownEventTypes.ORDER_CANCELLED:
      return NotificationType.ORDER_CANCELLED;
    case KnownEventTypes.PASSWORD_CHANGE:
      return NotificationType.PASSWORD_CHANGE;
    case KnownEventTypes.FEEDBACK_SUBMITTED:
      return NotificationType.FEEDBACK_SUBMITTED;
    case KnownEventTypes.PREFERENCE_UPDATE:
    case KnownEventTypes.PROFILE_UPDATE:
      return NotificationType.PREFERENCE_UPDATE;
    case KnownEventTypes.WALLET_EVENT:
    case KnownEventTypes.WALLET_TRANSACTION:
    case KnownEventTypes.PURCHASE:
    case KnownEventTypes.PAYMENT_SUCCESS:
    case KnownEventTypes.PAYMENT_FAILED:
    case KnownEventTypes.WEBHOOK_FAILED:
      return NotificationType.WALLET_EVENT;
    case KnownEventTypes.DISCOUNT:
    case KnownEventTypes.PROMO_OFFER:
    case KnownEventTypes.FLASH_SALE:
    case KnownEventTypes.REFERRAL_INVITE:
    case KnownEventTypes.VENDOR_PROMOTION:
      return NotificationType.DISCOUNT;
    case KnownEventTypes.USER_REGISTRATION:
    case KnownEventTypes.REGISTRATION_SUCCESS:
    case KnownEventTypes.REGISTRATION_FAILED:
    case KnownEventTypes.OTP_VERIFICATION:
    case KnownEventTypes.ACCOUNT_VERIFICATION:
    case KnownEventTypes.PHONE_VERIFICATION:
    case KnownEventTypes.MIGRATION_VERIFICATION:
    case KnownEventTypes.LOGIN_SUCCESS:
      return NotificationType.ALL;
    case KnownEventTypes.DELIVERY_ASSIGNED:
    case KnownEventTypes.DELIVERY_STARTED:
    case KnownEventTypes.DELIVERY_COMPLETED:
      return NotificationType.ORDER_UPDATE;
    case KnownEventTypes.APP_UPDATE:
    case KnownEventTypes.MAINTENANCE_SCHEDULED:
    case KnownEventTypes.MAINTENANCE_COMPLETED:
    case KnownEventTypes.PRIVACY_POLICY_UPDATE:
    case KnownEventTypes.SECURITY_ALERT:
      return NotificationType.ALL;
    case KnownEventTypes.PRICE_UPDATE:
    case KnownEventTypes.REGULATORY_NEWS:
    case KnownEventTypes.AREA_SPECIFIC_ALERT:
    case KnownEventTypes.GENERAL_ANNOUNCEMENT:
    case KnownEventTypes.VENDOR_STATUS_UPDATE:
      return NotificationType.ALL;
    case KnownEventTypes.ACCOUNT_DELETION_REQUEST:
    case KnownEventTypes.PASSWORD_RESET:
      return NotificationType.ALL;
    default:
      return NotificationType.ALL;
  }
}

export {
  dispatchNotification,
  dispatchPushNotification,
  dispatchEmailNotification,
  dispatchSMSNotification,
  dispatchWebhookNotification,
  NotificationPayload,
};