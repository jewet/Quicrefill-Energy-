import { PrismaClient } from "@prisma/client";
import { KnownEventTypes, IdentityVerificationEventTypes } from "../src/utils/EventTypeDictionary";

const prisma = new PrismaClient();

async function seedEventTypeRoles() {
  // Fetch a valid ADMIN user ID for createdBy
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" } },
    select: { id: true },
  });

  if (!adminUser) {
    throw new Error("No ADMIN user found in the database. Please seed at least one ADMIN user.");
  }

  const createdById = adminUser.id;

  // Define the RoleEventApplicability mapping
  const roleEventApplicability: Record<string, string[]> = {
    [KnownEventTypes.NEW_ORDER]: ["CUSTOMER", "VENDOR", "ADMIN", "SERVICE_REP"],
    [KnownEventTypes.ORDER_UPDATE]: ["CUSTOMER", "VENDOR", "ADMIN", "SERVICE_REP"],
    [KnownEventTypes.ORDER_CANCELLED]: ["CUSTOMER", "VENDOR", "ADMIN", "SERVICE_REP"],
    [KnownEventTypes.FEEDBACK_SUBMITTED]: ["CUSTOMER", "VENDOR", "ADMIN"],
    [KnownEventTypes.PASSWORD_CHANGE]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.WALLET_EVENT]: ["CUSTOMER", "VENDOR", "FINANCE_MANAGER"],
    [KnownEventTypes.PREFERENCE_UPDATE]: ["CUSTOMER", "VENDOR", "ADMIN"],
    [KnownEventTypes.DISCOUNT]: ["CUSTOMER"],
    [KnownEventTypes.USER_REGISTRATION]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "ADMIN", "SERVICE_REP"],
    [KnownEventTypes.PURCHASE]: ["CUSTOMER", "VENDOR", "FINANCE_MANAGER"],
    [KnownEventTypes.OTP_VERIFICATION]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.ACCOUNT_VERIFICATION]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.PHONE_VERIFICATION]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.MIGRATION_VERIFICATION]: ["DELIVERY_AGENT"],
    [KnownEventTypes.PROFILE_UPDATE]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "ADMIN", "SERVICE_REP"],
    [KnownEventTypes.ORDER_CONFIRMED]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "ADMIN", "SERVICE_REP"],
    [KnownEventTypes.DELIVERY_ASSIGNED]: ["DELIVERY_AGENT", "CUSTOMER", "ADMIN"],
    [KnownEventTypes.DELIVERY_STARTED]: ["DELIVERY_AGENT", "CUSTOMER", "ADMIN"],
    [KnownEventTypes.DELIVERY_COMPLETED]: ["DELIVERY_AGENT", "CUSTOMER", "VENDOR", "ADMIN"],
    [KnownEventTypes.PAYMENT_SUCCESS]: ["CUSTOMER", "VENDOR", "FINANCE_MANAGER", "ADMIN"],
    [KnownEventTypes.PAYMENT_FAILED]: ["CUSTOMER", "VENDOR", "FINANCE_MANAGER", "ADMIN"],
    [KnownEventTypes.PROMO_OFFER]: ["CUSTOMER"],
    [KnownEventTypes.FLASH_SALE]: ["CUSTOMER"],
    [KnownEventTypes.REFERRAL_INVITE]: ["CUSTOMER"],
    [KnownEventTypes.VENDOR_PROMOTION]: ["CUSTOMER", "VENDOR"],
    [KnownEventTypes.APP_UPDATE]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "STAFF", "SERVICE_REP"],
    [KnownEventTypes.MAINTENANCE_SCHEDULED]: ["ADMIN", "MANAGER", "SUPERVISOR", "STAFF", "SERVICE_REP"],
    [KnownEventTypes.MAINTENANCE_COMPLETED]: ["ADMIN", "MANAGER", "SUPERVISOR", "STAFF", "SERVICE_REP"],
    [KnownEventTypes.PRIVACY_POLICY_UPDATE]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.SECURITY_ALERT]: ["ADMIN", "MANAGER", "SUPERVISOR", "STAFF", "SERVICE_REP"],
    [KnownEventTypes.PRICE_UPDATE]: ["CUSTOMER", "VENDOR", "ADMIN", "MANAGER"],
    [KnownEventTypes.REGULATORY_NEWS]: ["VENDOR", "ADMIN", "MANAGER", "SUPERVISOR"],
    [KnownEventTypes.AREA_SPECIFIC_ALERT]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "ADMIN"],
    [KnownEventTypes.GENERAL_ANNOUNCEMENT]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.VENDOR_STATUS_UPDATE]: ["VENDOR", "ADMIN", "MANAGER", "SERVICE_REP"],
    [KnownEventTypes.WALLET_TRANSACTION]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "FINANCE_MANAGER"],
    [KnownEventTypes.ACCOUNT_DELETION_REQUEST]: ["CUSTOMER", "VENDOR", "DELIVERY_AGENT", "ADMIN", "MANAGER"],
    [KnownEventTypes.PASSWORD_RESET]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.REGISTRATION_SUCCESS]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.REGISTRATION_FAILED]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.LOGIN_SUCCESS]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
      "ADMIN",
    ],
    [KnownEventTypes.WEBHOOK_FAILED]: ["CUSTOMER", "FINANCE_MANAGER", "ADMIN"],
    [KnownEventTypes.OTHERS]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ],
    [KnownEventTypes.EMAIL_VERIFICATION_REQUIRED]: [
      "CUSTOMER",
      "VENDOR",
      "DELIVERY_AGENT",
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
      "FINANCE_MANAGER",
      "STAFF",
      "SERVICE_REP",
    ], // Added
  };

  // Define IdentityVerificationEventTypes mappings
  const identityVerificationEvents = {
    [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_SUBMITTED]: ["CUSTOMER"],
    [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_APPROVED]: ["CUSTOMER"],
    [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_REJECTED]: ["CUSTOMER"],
    [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_UNDER_REVIEW]: ["CUSTOMER"],
    [IdentityVerificationEventTypes.NEW_IDENTITY_VERIFICATION]: ["ADMIN", "MANAGER", "SUPERVISOR"],
  };

  // Combine all event types
  const allEventTypes = {
    ...roleEventApplicability,
    ...identityVerificationEvents,
  };

  // Seed event types and their role mappings
  for (const [eventTypeName, roleNames] of Object.entries(allEventTypes)) {
    // Ensure the event type exists
    const eventType = await prisma.eventType.upsert({
      where: { name: eventTypeName },
      update: {},
      create: {
        name: eventTypeName,
        description: `Event type for ${eventTypeName.toLowerCase()}`,
        createdBy: createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Verify that each role exists and create EventTypeRole mappings
    for (const roleName of roleNames) {
      const role = await prisma.role.findUnique({
        where: { name: roleName },
      });
      if (!role) {
        console.warn(`Role "${roleName}" not found for event "${eventTypeName}". Skipping.`);
        continue;
      }

      await prisma.eventTypeRole.upsert({
        where: {
          eventTypeId_roleId: {
            eventTypeId: eventType.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          eventTypeId: eventType.id,
          roleId: role.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log("Event types and role mappings seeded successfully.");
}

async function main() {
  try {
    await seedEventTypeRoles();
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed script failed:", error);
});