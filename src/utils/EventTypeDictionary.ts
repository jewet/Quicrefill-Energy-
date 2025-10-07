import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const roleCache: Record<string, string[]> = {}; // Optional in-memory cache

export enum KnownEventTypes {
  NEW_ORDER = "NEW_ORDER",
  ORDER_UPDATE = "ORDER_UPDATE",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  WALLET_EVENT = "WALLET_EVENT",
  PREFERENCE_UPDATE = "PREFERENCE_UPDATE",
  DISCOUNT = "DISCOUNT",
  USER_REGISTRATION = "USER_REGISTRATION",
  PURCHASE = "PURCHASE",
  OTP_VERIFICATION = "OTP_VERIFICATION",
  ACCOUNT_VERIFICATION = "ACCOUNT_VERIFICATION",
  PHONE_VERIFICATION = "PHONE_VERIFICATION",
  MIGRATION_VERIFICATION = "MIGRATION_VERIFICATION",
  PROFILE_UPDATE = "PROFILE_UPDATE",
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  DELIVERY_ASSIGNED = "DELIVERY_ASSIGNED",
  DELIVERY_STARTED = "DELIVERY_STARTED",
  DELIVERY_COMPLETED = "DELIVERY_COMPLETED",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PROMO_OFFER = "PROMO_OFFER",
  FLASH_SALE = "FLASH_SALE",
  REFERRAL_INVITE = "REFERRAL_INVITE",
  VENDOR_PROMOTION = "VENDOR_PROMOTION",
  APP_UPDATE = "APP_UPDATE",
  MAINTENANCE_SCHEDULED = "MAINTENANCE_SCHEDULED",
  MAINTENANCE_COMPLETED = "MAINTENANCE_COMPLETED",
  PRIVACY_POLICY_UPDATE = "PRIVACY_POLICY_UPDATE",
  SECURITY_ALERT = "SECURITY_ALERT",
  PRICE_UPDATE = "PRICE_UPDATE",
  REGULATORY_NEWS = "REGULATORY_NEWS",
  AREA_SPECIFIC_ALERT = "AREA_SPECIFIC_ALERT",
  GENERAL_ANNOUNCEMENT = "GENERAL_ANNOUNCEMENT",
  VENDOR_STATUS_UPDATE = "VENDOR_STATUS_UPDATE",
  WALLET_TRANSACTION = "WALLET_TRANSACTION",
  ACCOUNT_DELETION_REQUEST = "ACCOUNT_DELETION_REQUEST",
  PASSWORD_RESET = "PASSWORD_RESET",
  REGISTRATION_SUCCESS = "REGISTRATION_SUCCESS",
  REGISTRATION_FAILED = "REGISTRATION_FAILED",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  WEBHOOK_FAILED = "WEBHOOK_FAILED",
  OTHERS = "OTHERS",
  EMAIL_VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED", // Added
}

export enum NotificationCategory {
  TRANSACTIONAL = "TRANSACTIONAL",
  MARKETING = "MARKETING",
  OPERATIONAL = "OPERATIONAL",
  INFORMATIONAL = "INFORMATIONAL",
}

export const EventTypeMapping: Record<string, string> = {
  "password change": KnownEventTypes.PASSWORD_CHANGE,
  "wallet transaction": KnownEventTypes.WALLET_TRANSACTION,
  "deposit": KnownEventTypes.WALLET_TRANSACTION,
  "deduction": KnownEventTypes.WALLET_TRANSACTION,
  "refund": KnownEventTypes.WALLET_TRANSACTION,
  "user registration": KnownEventTypes.USER_REGISTRATION,
  "account deletion": KnownEventTypes.ACCOUNT_DELETION_REQUEST,
  "account deletion request": KnownEventTypes.ACCOUNT_DELETION_REQUEST,
  "purchase": KnownEventTypes.PURCHASE,
  "order": KnownEventTypes.PURCHASE,
  "otp": KnownEventTypes.OTP_VERIFICATION,
  "otp verification": KnownEventTypes.OTP_VERIFICATION,
  "otp_verification": KnownEventTypes.OTP_VERIFICATION,
  "account verification": KnownEventTypes.ACCOUNT_VERIFICATION,
  "phone verification": KnownEventTypes.PHONE_VERIFICATION,
  "migration verification": KnownEventTypes.MIGRATION_VERIFICATION,
  "profile update": KnownEventTypes.PROFILE_UPDATE,
  "order confirmed": KnownEventTypes.ORDER_CONFIRMED,
  "order cancelled": KnownEventTypes.ORDER_CANCELLED,
  "delivery assigned": KnownEventTypes.DELIVERY_ASSIGNED,
  "delivery started": KnownEventTypes.DELIVERY_STARTED,
  "delivery completed": KnownEventTypes.DELIVERY_COMPLETED,
  "payment success": KnownEventTypes.PAYMENT_SUCCESS,
  "payment failed": KnownEventTypes.PAYMENT_FAILED,
  "promo offer": KnownEventTypes.PROMO_OFFER,
  "flash sale": KnownEventTypes.FLASH_SALE,
  "referral invite": KnownEventTypes.REFERRAL_INVITE,
  "vendor promotion": KnownEventTypes.VENDOR_PROMOTION,
  "app update": KnownEventTypes.APP_UPDATE,
  "maintenance scheduled": KnownEventTypes.MAINTENANCE_SCHEDULED,
  "maintenance completed": KnownEventTypes.MAINTENANCE_COMPLETED,
  "privacy policy update": KnownEventTypes.PRIVACY_POLICY_UPDATE,
  "security alert": KnownEventTypes.SECURITY_ALERT,
  "price update": KnownEventTypes.PRICE_UPDATE,
  "regulatory news": KnownEventTypes.REGULATORY_NEWS,
  "area specific alert": KnownEventTypes.AREA_SPECIFIC_ALERT,
  "general announcement": KnownEventTypes.GENERAL_ANNOUNCEMENT,
  "vendor status update": KnownEventTypes.VENDOR_STATUS_UPDATE,
  "password reset": KnownEventTypes.PASSWORD_RESET,
  "registration success": KnownEventTypes.REGISTRATION_SUCCESS,
  "registration_success": KnownEventTypes.REGISTRATION_SUCCESS,
  "registration failed": KnownEventTypes.REGISTRATION_FAILED,
  "login success": KnownEventTypes.LOGIN_SUCCESS,
  "login_success": KnownEventTypes.LOGIN_SUCCESS,
  "email verification required": KnownEventTypes.EMAIL_VERIFICATION_REQUIRED, // Added
  ACCOUNT_DELETION_REQUEST: KnownEventTypes.ACCOUNT_DELETION_REQUEST,
  MIGRATION_VERIFICATION: KnownEventTypes.MIGRATION_VERIFICATION,
  "webhook failed": KnownEventTypes.WEBHOOK_FAILED,
  WEBHOOK_FAILED: KnownEventTypes.WEBHOOK_FAILED,
};

export const mapToEventType = (event: string): string => {
  console.log(`Mapping event: ${event}`);
  for (const [key, value] of Object.entries(EventTypeMapping)) {
    if (event.toLowerCase() === key.toLowerCase()) {
      console.log(`Matched key: ${key}, value: ${value}`);
      return value;
    }
  }
  console.log(`No exact match, returning: ${KnownEventTypes.OTHERS}`);
  return KnownEventTypes.OTHERS;
};

export const EventTypeToCategory: Record<KnownEventTypes, NotificationCategory> = {
  [KnownEventTypes.NEW_ORDER]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.ORDER_UPDATE]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.ORDER_CANCELLED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.FEEDBACK_SUBMITTED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PASSWORD_CHANGE]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.WALLET_EVENT]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PREFERENCE_UPDATE]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.DISCOUNT]: NotificationCategory.MARKETING,
  [KnownEventTypes.USER_REGISTRATION]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PURCHASE]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.OTP_VERIFICATION]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.ACCOUNT_VERIFICATION]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PHONE_VERIFICATION]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.MIGRATION_VERIFICATION]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PROFILE_UPDATE]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.ORDER_CONFIRMED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.DELIVERY_ASSIGNED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.DELIVERY_STARTED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.DELIVERY_COMPLETED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PAYMENT_SUCCESS]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PAYMENT_FAILED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PROMO_OFFER]: NotificationCategory.MARKETING,
  [KnownEventTypes.FLASH_SALE]: NotificationCategory.MARKETING,
  [KnownEventTypes.REFERRAL_INVITE]: NotificationCategory.MARKETING,
  [KnownEventTypes.VENDOR_PROMOTION]: NotificationCategory.MARKETING,
  [KnownEventTypes.APP_UPDATE]: NotificationCategory.OPERATIONAL,
  [KnownEventTypes.MAINTENANCE_SCHEDULED]: NotificationCategory.OPERATIONAL,
  [KnownEventTypes.MAINTENANCE_COMPLETED]: NotificationCategory.OPERATIONAL,
  [KnownEventTypes.PRIVACY_POLICY_UPDATE]: NotificationCategory.OPERATIONAL,
  [KnownEventTypes.SECURITY_ALERT]: NotificationCategory.OPERATIONAL,
  [KnownEventTypes.PRICE_UPDATE]: NotificationCategory.INFORMATIONAL,
  [KnownEventTypes.REGULATORY_NEWS]: NotificationCategory.INFORMATIONAL,
  [KnownEventTypes.AREA_SPECIFIC_ALERT]: NotificationCategory.INFORMATIONAL,
  [KnownEventTypes.GENERAL_ANNOUNCEMENT]: NotificationCategory.INFORMATIONAL,
  [KnownEventTypes.VENDOR_STATUS_UPDATE]: NotificationCategory.INFORMATIONAL,
  [KnownEventTypes.WALLET_TRANSACTION]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.ACCOUNT_DELETION_REQUEST]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.PASSWORD_RESET]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.REGISTRATION_SUCCESS]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.REGISTRATION_FAILED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.LOGIN_SUCCESS]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.WEBHOOK_FAILED]: NotificationCategory.TRANSACTIONAL,
  [KnownEventTypes.OTHERS]: NotificationCategory.INFORMATIONAL,
  [KnownEventTypes.EMAIL_VERIFICATION_REQUIRED]: NotificationCategory.TRANSACTIONAL, // Added
};

export enum IdentityVerificationEventTypes {
  IDENTITY_VERIFICATION_SUBMITTED = "IDENTITY_VERIFICATION_SUBMITTED",
  IDENTITY_VERIFICATION_APPROVED = "IDENTITY_VERIFICATION_APPROVED",
  IDENTITY_VERIFICATION_REJECTED = "IDENTITY_VERIFICATION_REJECTED",
  IDENTITY_VERIFICATION_UNDER_REVIEW = "IDENTITY_VERIFICATION_UNDER_REVIEW",
  NEW_IDENTITY_VERIFICATION = "NEW_IDENTITY_VERIFICATION",
}

export const ExtendedKnownEventTypes = {
  ...KnownEventTypes,
  ...IdentityVerificationEventTypes,
};

export const RoleEventApplicability: Record<KnownEventTypes, string[]> = {
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

export const IdentityVerificationRoleApplicability: Record<IdentityVerificationEventTypes, string[]> = {
  [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_SUBMITTED]: ["CUSTOMER"],
  [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_APPROVED]: ["CUSTOMER"],
  [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_REJECTED]: ["CUSTOMER"],
  [IdentityVerificationEventTypes.IDENTITY_VERIFICATION_UNDER_REVIEW]: ["CUSTOMER"],
  [IdentityVerificationEventTypes.NEW_IDENTITY_VERIFICATION]: ["ADMIN", "MANAGER", "SUPERVISOR"],
};

// Function to dynamically fetch applicable roles for an event type with fallback
export async function getApplicableRoles(eventType: string): Promise<string[]> {
  if (roleCache[eventType]) {
    return roleCache[eventType];
  }

  try {
    const eventTypeRecord = await prisma.eventType.findUnique({
      where: { name: eventType },
      include: {
        eventTypeRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!eventTypeRecord) {
      console.warn(`Event type "${eventType}" not found in database, falling back to RoleEventApplicability.`);
      // Fallback to RoleEventApplicability or IdentityVerificationRoleApplicability
      const roles =
        RoleEventApplicability[eventType as KnownEventTypes] ||
        IdentityVerificationRoleApplicability[eventType as IdentityVerificationEventTypes] ||
        [];
      roleCache[eventType] = roles;
      return roles;
    }

    const roles = eventTypeRecord.eventTypeRoles.map((etr) => etr.role.name);
    roleCache[eventType] = roles;
    return roles;
  } catch (error) {
    console.error(`Error fetching applicable roles for event "${eventType}":`, error);
    // Fallback to RoleEventApplicability or IdentityVerificationRoleApplicability
    const roles =
      RoleEventApplicability[eventType as KnownEventTypes] ||
      IdentityVerificationRoleApplicability[eventType as IdentityVerificationEventTypes] ||
      [];
    roleCache[eventType] = roles;
    return roles;
  }
}

export function clearRoleCache() {
  for (const key in roleCache) {
    delete roleCache[key];
  }
}

export interface IdentityVerificationDynamicData {
  userName?: string;
  userEmail?: string;
  documentType?: string;
  country?: string;
  verificationId?: string;
  status?: string;
  rejectionReason?: string;
  submittedAt?: string;
  processedAt?: string;
  message: string;
}