-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "public"."IdentityVerificationType" AS ENUM ('DRIVER_LICENSE', 'VOTER_CARD', 'INTERNATIONAL_PASSPORT', 'NIN', 'RESIDENCE_PERMIT');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CUSTOMER', 'DELIVERY_AGENT', 'DELIVERY_REP', 'VENDOR', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'FINANCE_MANAGER', 'STAFF', 'SERVICE_REP');

-- CreateEnum
CREATE TYPE "public"."IssueType" AS ENUM ('DELIVERY', 'PAYMENT', 'SERVICE', 'DEFECTIVE_PRODUCT', 'WRONG_ITEM', 'DELIVERY_ISSUE', 'GENERAL', 'PRODUCT');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('NEW_ORDER', 'ORDER_UPDATE', 'ORDER_CANCELLED', 'FEEDBACK_SUBMITTED', 'EMAIL', 'SMS', 'PUSH', 'WEBHOOK', 'ALL', 'DISCOUNT', 'PASSWORD_CHANGE', 'WALLET_EVENT', 'PREFERENCE_UPDATE', 'VENDOR_LINKING');

-- CreateEnum
CREATE TYPE "public"."ComplaintStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('MONNIFY', 'CARD', 'TRANSFER', 'WALLET', 'PAY_ON_DELIVERY', 'VIRTUAL_ACCOUNT', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "public"."AccessoryStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."AgentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'PENDING', 'SUSPENDED', 'DELIVERED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."AccountDeletionStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."RevenueType" AS ENUM ('SERVICE_CHARGE', 'TOPUP_CHARGE', 'DELIVERY_FEE', 'VAT');

-- CreateEnum
CREATE TYPE "public"."SocialAccountProvider" AS ENUM ('FACEBOOK', 'GOOGLE');

-- CreateEnum
CREATE TYPE "public"."AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'DEDUCTION', 'REFUND');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('FAILED', 'PENDING', 'CONFIRMED', 'COMPLETED', 'PENDING_MANUAL', 'PENDING_DELIVERY', 'CANCELLED', 'REFUND', 'AWAITING_APPROVAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."WithdrawalLimitType" AS ENUM ('DAILY_AMOUNT', 'DAILY_COUNT', 'AUTO_AMOUNT');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('VERIFIED', 'NOT_VERIFIED', 'PENDING', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "public"."ServiceType" AS ENUM ('DIESEL', 'PETROL', 'GAS', 'ELECTRICITY', 'GAS_SUPPLY', 'PETROL_SUPPLY', 'DIESEL_SUPPLY', 'ELECTRICITY_SUPPLY');

-- CreateEnum
CREATE TYPE "public"."DocumentType" AS ENUM ('NIN', 'INTERNATIONAL_PASSPORT', 'VOTER_CARD', 'DRIVING_LICENCE', 'RESIDENCE_PERMIT', 'CAC', 'SAFETY_CERTIFICATE', 'COMPLIANCE_CERTIFICATE', 'PLATE_NUMBER', 'VEHICLE_ROAD_LICENSE');

-- CreateEnum
CREATE TYPE "public"."VoucherType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DISCONTINUED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "public"."ServiceOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'AGENT_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED', 'OUT_OF_STOCK', 'PAYMENT_RECEIVED', 'ORDER_RECEIVED');

-- CreateEnum
CREATE TYPE "public"."LicenseType" AS ENUM ('DRIVERS_LICENSE', 'DRIVING_LICENSE', 'OPERATORS_LICENSE', 'BUSINESS', 'VEHICLE', 'SAFETY', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'AGENT_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED', 'OUT_OF_STOCK', 'PAYMENT_RECEIVED', 'ORDER_RECEIVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."FeedbackStatus" AS ENUM ('PENDING', 'RESOLVED', 'RESPONDED');

-- CreateEnum
CREATE TYPE "public"."DisputeStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."WithdrawalStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."LocationStatus" AS ENUM ('ENABLED', 'DISABLED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "public"."CrashStatus" AS ENUM ('PENDING', 'UNDER_INVESTIGATION', 'PRIORITY', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."StationType" AS ENUM ('GAS', 'PETROL', 'DIESEL');

-- CreateTable
CREATE TABLE "public"."Rating" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CUSTOMER',
    "email" TEXT NOT NULL,
    "username" VARCHAR(50),
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "name" TEXT,
    "uniqueDeliveryId" VARCHAR(50),
    "deviceToken" VARCHAR(255),
    "phoneNumber" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "bvnVerified" BOOLEAN NOT NULL DEFAULT false,
    "businessVerified" BOOLEAN NOT NULL DEFAULT false,
    "webAccessGranted" BOOLEAN NOT NULL DEFAULT false,
    "webAccessGrantedAt" TIMESTAMP(3),
    "migratedToVendor" BOOLEAN NOT NULL DEFAULT false,
    "migrationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inviteCode" TEXT,
    "publicKey" TEXT,
    "address" TEXT,
    "avatar" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "isSocialAccount" BOOLEAN NOT NULL DEFAULT false,
    "socialAccountProvider" "public"."SocialAccountProvider",
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" VARCHAR(255),
    "notificationPreference" "public"."NotificationType",
    "savedMeterNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isWithdrawalSuspended" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalSuspendedAt" TIMESTAMP(3),
    "withdrawalSuspensionReason" VARCHAR(255),
    "withdrawalSuspensionDuration" INTEGER,
    "gender" VARCHAR(20),
    "dateOfBirth" TIMESTAMP(3),
    "pushToken" VARCHAR(255),
    "last_login_at" TIMESTAMP(3),
    "isWithdrawalAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isDeliveryAgent" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isVendor" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(50),
    "banReason" VARCHAR(255),
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "isPenalized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "status" "public"."AgentStatus",
    "isWebEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webEnabledAt" TIMESTAMP(3),
    "department" VARCHAR(100),
    "jobTitle" VARCHAR(100),
    "permissions" JSONB,
    "vehicleType" VARCHAR(50),
    "vehiclePlate" VARCHAR(20),
    "lastLocationLat" DOUBLE PRECISION,
    "lastLocationLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "lastLocation" geometry(Point, 4326),
    "vendorId" UUID,
    "defaultDeliveryFee" DOUBLE PRECISION DEFAULT 0.0,
    "roleSpecificData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" UUID,
    "businessVerificationStatus" "public"."VerificationStatus" DEFAULT 'PENDING',
    "identityVerificationStatus" "public"."DocumentStatus" DEFAULT 'PENDING',
    "serviceVerificationStatus" "public"."VerificationStatus" DEFAULT 'PENDING',
    "walletBalance" DECIMAL(10,2) DEFAULT 0.00,
    "avatar" TEXT,
    "deliveries" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION DEFAULT 0.0,
    "yearsOnPlatform" DOUBLE PRECISION DEFAULT 0.0,
    "achievements" JSONB,
    "fiveStarRatingsCount" INTEGER DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "fiveStarCount" INTEGER,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Zone" (
    "id" UUID NOT NULL,
    "serviceId" UUID,
    "name" TEXT NOT NULL,
    "minDeliveryDays" INTEGER NOT NULL,
    "maxDeliveryDays" INTEGER NOT NULL,
    "orderCutoffTime" VARCHAR(5) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "providerId" UUID NOT NULL,
    "providerRole" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "serviceRadius" DOUBLE PRECISION,
    "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Complaint" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "serviceOrderId" UUID,
    "productId" UUID,
    "serviceId" UUID,
    "userId" UUID NOT NULL,
    "issueType" "public"."IssueType" NOT NULL DEFAULT 'GENERAL',
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "status" "public"."ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "internalNote" TEXT,
    "resolutionDetails" TEXT,
    "assignedTeamId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticketId" VARCHAR(50) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Staff" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileId" UUID,
    "role" "public"."Role" NOT NULL,
    "customRole" VARCHAR(50),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "discountsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationTypes" "public"."NotificationType"[] DEFAULT ARRAY[]::"public"."NotificationType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdentityVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileId" UUID,
    "documentType" "public"."IdentityVerificationType" NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "frontImageUrl" TEXT NOT NULL,
    "backImageUrl" TEXT,
    "selfieImageUrl" TEXT NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deviceInfo" TEXT,
    "documentNumber" VARCHAR(100),

    CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."License" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "licenseType" "public"."LicenseType" NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "documentUrl" TEXT NOT NULL,
    "documentBackUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "verifiedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "plateNumberUrl" TEXT NOT NULL,
    "driverLicenseUrl" TEXT NOT NULL,
    "vehicleRoadLicenseUrl" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "documentType" "public"."DocumentType" NOT NULL,
    "verifiedById" UUID,
    "plateNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VendorWalletConfig" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "deliveryAgentId" UUID NOT NULL,
    "withdrawalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalLimit" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "depositRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "virtualAccount1Id" UUID,
    "virtualAccount2Id" UUID,

    CONSTRAINT "VendorWalletConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceOrder" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "agentId" UUID,
    "serviceId" UUID,
    "zoneId" UUID,
    "vendorId" UUID,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2),
    "serviceCharge" DECIMAL(10,2),
    "paymentStatus" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "status" "public"."ServiceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentId" UUID,
    "deliveryAddressId" UUID,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "countryId" INTEGER,
    "stateId" INTEGER,
    "cityId" INTEGER,
    "virtualAccountId" UUID,
    "adminId" UUID,
    "orderQuantity" DECIMAL(10,2),
    "deliveryDistance" DOUBLE PRECISION,
    "customerReference" VARCHAR(50),
    "paymentMethod" "public"."PaymentMethod" DEFAULT 'PAY_ON_DELIVERY',
    "ST_Y(delivery_location::geometry)" DOUBLE PRECISION DEFAULT 0,
    "ST_X(delivery_location::geometry)" DOUBLE PRECISION DEFAULT 0,
    "confirmationCode" VARCHAR(50),
    "voucherId" UUID,
    "deliveryTime" DECIMAL(10,2),
    "providerId" INTEGER,
    "meterNumber" VARCHAR(255),
    "meterType" TEXT DEFAULT 'prepaid',
    "token" TEXT,
    "serviceFee" DOUBLE PRECISION,
    "voucherDiscount" DOUBLE PRECISION,
    "pointsDiscount" DOUBLE PRECISION,
    "flutterwaveFee" DOUBLE PRECISION,
    "monnifyFee" DOUBLE PRECISION,
    "vat" DOUBLE PRECISION,
    "transactionRef" VARCHAR(255),

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceOrderStatusHistory" (
    "id" UUID NOT NULL,
    "serviceOrderId" UUID NOT NULL,
    "status" "public"."ServiceOrderStatus" NOT NULL,
    "updatedBy" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BVNVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID,
    "bvn" VARCHAR(11) NOT NULL,
    "bankName" VARCHAR(255),
    "accountNumber" VARCHAR(10),
    "status" VARCHAR(20) NOT NULL,
    "responseDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transactionRef" VARCHAR(255) NOT NULL,

    CONSTRAINT "BVNVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Accessory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "stockCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."AccessoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" "public"."ServiceType" NOT NULL,
    "status" "public"."ServiceStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "pricePerUnit" DECIMAL(10,2) NOT NULL,
    "deliveryCost" DECIMAL(10,2),
    "minimumOrder" INTEGER NOT NULL DEFAULT 1,
    "maximumOrder" INTEGER,
    "paymentOptions" VARCHAR(255),
    "supportContact" VARCHAR(255),
    "businessHours" JSONB,
    "expectedDeliveryTime" INTEGER,
    "address" TEXT,
    "logoUrl" TEXT,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "location" geography(Point, 4326),
    "serviceRadius" DOUBLE PRECISION,
    "countryId" INTEGER,
    "stateId" INTEGER,
    "cityId" INTEGER,
    "lgaId" INTEGER,
    "providerId" UUID NOT NULL,
    "providerRole" VARCHAR(50) NOT NULL,
    "businessVerificationId" UUID,
    "deliveryRepId" UUID,
    "agentId" UUID,
    "categoryId" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "avgRating" DOUBLE PRECISION DEFAULT 0.0,
    "ratingCount" INTEGER DEFAULT 0,
    "vendorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceReview" (
    "id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewerName" TEXT NOT NULL,
    "reviewerId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusinessVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "profileId" UUID,
    "businessName" TEXT NOT NULL,
    "rcNumber" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "tinNumber" TEXT,
    "cacDocumentUrl" TEXT NOT NULL,
    "tinDocumentUrl" TEXT,
    "proofOfAddressUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "handles" JSONB,
    "status" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "adminId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vendorId" UUID,
    "deliveryAddressId" UUID NOT NULL,
    "agentId" UUID,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL,
    "serviceCharge" DECIMAL(10,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total" DECIMAL(10,2) NOT NULL,
    "confirmationCode" VARCHAR(4) NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "paymentStatus" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "orderStatus" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryRepId" UUID,
    "countryId" INTEGER,
    "stateId" INTEGER,
    "lgaId" INTEGER,
    "cityId" INTEGER,
    "notes" TEXT,
    "customerReference" VARCHAR(50) NOT NULL,
    "deliveryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deliveryTime" INTEGER,
    "deliveryDistance" DOUBLE PRECISION,
    "deliveryLocation" geometry(Point, 4326),
    "ST_Y(delivery_location::geometry)" DOUBLE PRECISION DEFAULT 0,
    "ST_X(delivery_location::geometry)" DOUBLE PRECISION DEFAULT 0,
    "voucherId" UUID,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceVerification" (
    "id" UUID NOT NULL,
    "serviceId" UUID,
    "profileId" UUID,
    "notes" TEXT,
    "status" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "adminId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "userId" UUID,

    CONSTRAINT "ServiceVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" VARCHAR(255) NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "entityType" VARCHAR(50),
    "entityId" UUID,
    "investigationStatus" VARCHAR(50),
    "investigatedBy" UUID,
    "investigatedAt" TIMESTAMP(3),
    "orderId" UUID,
    "orderAuditLogId" UUID,
    "serviceOrderId" UUID,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalletTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "transactionType" "public"."TransactionType",
    "amount" DECIMAL(10,2) NOT NULL,
    "topupCharge" DECIMAL(10,2),
    "serviceOrderId" UUID,
    "paymentId" UUID,
    "transactionRef" VARCHAR(255),
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "electricityProviderId" INTEGER,
    "metadata" JSONB,
    "vendorId" UUID,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Otp" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "medium" TEXT[],
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Voucher" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL,
    "type" "public"."VoucherType" NOT NULL,
    "maxUses" INTEGER,
    "maxUsesPerUser" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "appliesTo" VARCHAR(20) NOT NULL,
    "restrictedToRoles" "public"."Role"[],
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VoucherUsage" (
    "id" SERIAL NOT NULL,
    "voucherId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Favorite" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transfer" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "bankName" VARCHAR(255) NOT NULL,
    "accountNumber" VARCHAR(255) NOT NULL,
    "transactionId" UUID NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "proofOfPayment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAddress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "state" VARCHAR(50),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subAccountCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" UUID NOT NULL,
    "ticketId" VARCHAR(50) NOT NULL,
    "giverId" UUID NOT NULL,
    "giverRole" "public"."Role" NOT NULL,
    "receiverId" UUID NOT NULL,
    "receiverRole" "public"."Role" NOT NULL,
    "comment" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'LOW',
    "issueType" "public"."IssueType" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "agentProfileId" UUID,
    "vendorId" UUID,
    "orderId" UUID,
    "serviceOrderId" UUID,
    "customerId" UUID,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderReview" (
    "id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "orderId" UUID,
    "serviceOrderId" UUID,
    "serviceId" UUID,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayOnDeliveryOrder" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "serviceOrderId" UUID,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,

    CONSTRAINT "PayOnDeliveryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "transactionRef" VARCHAR(54),
    "flwRef" VARCHAR(255),
    "monnifyRef" VARCHAR(255),
    "productType" TEXT,
    "serviceType" TEXT,
    "providerId" INTEGER,
    "serviceOrderId" UUID,
    "meterNumber" VARCHAR(255),
    "paymentLink" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "requestedAmount" DOUBLE PRECISION,
    "topupCharge" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentDetails" JSONB,
    "electricityProviderId" INTEGER,
    "orderId" UUID,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "adminId" UUID,
    "category" VARCHAR(50) NOT NULL,
    "details" TEXT,
    "imageUrl" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "agentProfileId" UUID,
    "vendorId" UUID,
    "reporterName" VARCHAR(100),
    "reporterPhone" VARCHAR(20),
    "serviceOrderId" UUID,
    "productOrderId" UUID,
    "documentId" VARCHAR(255),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ElectricityProvider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "flutterwave_biller_code" TEXT NOT NULL,
    "prepaid_item_code" TEXT,
    "postpaid_item_code" TEXT,
    "serviceFee" INTEGER NOT NULL DEFAULT 500,
    "tariffPlan" TEXT,

    CONSTRAINT "ElectricityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" VARCHAR(54),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Wallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "totalTopupCharge" DECIMAL(10,2),
    "vendorLinkedAccount1" VARCHAR(255),
    "vendorLinkedAccount2" VARCHAR(255),
    "vendorBankName" VARCHAR(255),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountNumber" VARCHAR(255),

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentProvider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "flutterwave_biller_code" TEXT,
    "providerKey" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL DEFAULT 'https://via.placeholder.com/150',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2),
    "imageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brand" TEXT,
    "size" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" UUID NOT NULL,
    "productOwnerId" UUID NOT NULL,
    "rating" DECIMAL(2,1),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cart" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Infraction" (
    "id" UUID NOT NULL,
    "agentId" UUID,
    "deliveryRepId" UUID,
    "vendorId" UUID,
    "type" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Infraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "accessoryId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentConfig" (
    "id" SERIAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gateway" TEXT,
    "publicKey" TEXT,
    "secretKey" TEXT,
    "contractCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dispute" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "serviceOrderId" UUID,
    "productId" UUID,
    "serviceId" UUID,
    "reason" TEXT NOT NULL,
    "riskFactors" BOOLEAN NOT NULL DEFAULT false,
    "internalNotes" TEXT,
    "status" "public"."DisputeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Withdrawal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "bankName" VARCHAR(255) NOT NULL,
    "accountNumber" VARCHAR(255),
    "status" "public"."WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveryRepId" UUID,
    "vendorId" UUID,
    "processedAt" TIMESTAMP(3),
    "transactionRef" VARCHAR(255),
    "isAccountValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedBy" UUID,
    "validationDate" TIMESTAMP(3),
    "bvnVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WithdrawalLimit" (
    "id" SERIAL NOT NULL,
    "entityType" "public"."Role" NOT NULL,
    "limitType" "public"."WithdrawalLimitType" NOT NULL,
    "limitValue" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "WithdrawalLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuicrifillWallet" (
    "id" UUID NOT NULL,
    "accountNumber" VARCHAR(255) NOT NULL,
    "bankName" VARCHAR(255) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuicrifillWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuicrifillWithdrawal" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "bankName" VARCHAR(255) NOT NULL,
    "accountNumber" VARCHAR(255) NOT NULL,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "transactionRef" VARCHAR(255),
    "requestedBy" UUID NOT NULL,

    CONSTRAINT "QuicrifillWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppInstallation" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "deviceType" VARCHAR(50) NOT NULL,
    "deviceId" VARCHAR(255) NOT NULL,
    "deviceToken" VARCHAR(255),
    "isRecognized" BOOLEAN NOT NULL DEFAULT false,
    "recognizedAt" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "banReason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "isPenalized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AppInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Country" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "status" "public"."LocationStatus" NOT NULL DEFAULT 'ENABLED',
    "restrictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."State" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "countryId" INTEGER NOT NULL,
    "status" "public"."LocationStatus" NOT NULL DEFAULT 'ENABLED',
    "restrictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."City" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "lgaId" INTEGER NOT NULL,
    "stateId" INTEGER NOT NULL,
    "status" "public"."LocationStatus" NOT NULL DEFAULT 'ENABLED',
    "restrictions" JSONB,
    "location" geography(Point, 4326),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lga" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "stateId" INTEGER NOT NULL,
    "status" "public"."LocationStatus" NOT NULL DEFAULT 'ENABLED',
    "restrictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VirtualAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "vendorId" UUID,
    "accountNumber" VARCHAR(255) NOT NULL,
    "bankName" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "monnifyRef" VARCHAR(255) NOT NULL,
    "isVendorMain" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FraudAlert" (
    "id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" UUID,
    "vendorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "roles" "public"."Role"[],
    "eventTypeId" UUID,
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolePrivilege" (
    "id" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "privileges" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePrivilege_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CrashReport" (
    "id" UUID NOT NULL,
    "appVersion" VARCHAR(50) NOT NULL,
    "deviceType" VARCHAR(50) NOT NULL,
    "deviceModel" VARCHAR(100),
    "osVersion" VARCHAR(50),
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT NOT NULL,
    "userId" UUID,
    "status" "public"."CrashStatus" NOT NULL DEFAULT 'PENDING',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "deviceId" VARCHAR(255),
    "metadata" JSONB,

    CONSTRAINT "CrashReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountDeletionRequest" (
    "id" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "reason" TEXT,
    "additionalComments" TEXT,
    "status" "public"."AccountDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledDeletionAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminSettings" (
    "id" SERIAL NOT NULL,
    "defaultServiceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.075,
    "defaultTopupCharge" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appeal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vendorId" UUID,
    "reason" TEXT NOT NULL,
    "status" "public"."AppealStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WalletSettings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID,
    "isDeliveryWithdrawalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalLimitDaily" DECIMAL(65,30),
    "withdrawalLimitSingle" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BankCard" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID,
    "profileId" UUID,
    "cardLast4" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "bankCode" TEXT,
    "expiryDate" TEXT NOT NULL,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "flutterwaveToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderStatusHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "serviceOrderId" UUID,
    "entityType" VARCHAR(20) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" UUID,
    "notes" TEXT,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookAttempt" (
    "id" UUID NOT NULL,
    "walletTransactionId" UUID,
    "eventType" VARCHAR(50) NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "payload" JSONB,
    "status" VARCHAR,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventType" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SMSTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "roles" "public"."Role"[],
    "eventTypeId" UUID,
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SMSTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "vendorId" UUID,
    "type" VARCHAR(50) NOT NULL,
    "eventTypeId" UUID NOT NULL,
    "payload" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "channel" VARCHAR(50) NOT NULL,
    "recipient" VARCHAR(255),
    "errorMessage" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PushTemplate" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "roles" "public"."Role"[],
    "eventTypeId" UUID,
    "updatedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PushTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Webhook" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "eventTypeId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roles" "public"."Role"[],
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailSettings" (
    "id" SERIAL NOT NULL,
    "smtpHost" VARCHAR(255),
    "smtpPort" INTEGER,
    "smtpUser" VARCHAR(255),
    "smtpPassword" VARCHAR(255),
    "emailFrom" VARCHAR(255),
    "enableNotifications" BOOLEAN NOT NULL DEFAULT true,
    "deliveryTimeStart" VARCHAR(5),
    "deliveryTimeEnd" VARCHAR(5),
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SMSSettings" (
    "id" SERIAL NOT NULL,
    "enableNotifications" BOOLEAN NOT NULL DEFAULT true,
    "senderId" VARCHAR(50),
    "deliveryTimeStart" VARCHAR(5),
    "deliveryTimeEnd" VARCHAR(5),
    "smsProvider" VARCHAR(100),
    "serviceType" VARCHAR(50),
    "user" VARCHAR(255),
    "password" VARCHAR(255),
    "host" VARCHAR(255),
    "port" INTEGER,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SMSSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChurnInsight" (
    "id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "poorCustomerSupport" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "highServiceFees" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "paymentIssues" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "serviceDelays" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "other" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurnInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RewardRule" (
    "id" UUID NOT NULL,
    "pointsPerNaira" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "appliesTo" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reward" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ServiceToLicenses" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ServiceToLicenses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ServiceToVehicles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ServiceToVehicles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Rating_userId_idx" ON "public"."Rating"("userId");

-- CreateIndex
CREATE INDEX "Rating_createdAt_idx" ON "public"."Rating"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_role_key" ON "public"."Rating"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_uniqueDeliveryId_key" ON "public"."User"("uniqueDeliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "public"."User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "public"."Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "public"."Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_role_idx" ON "public"."Profile"("role");

-- CreateIndex
CREATE INDEX "Profile_createdAt_idx" ON "public"."Profile"("createdAt");

-- CreateIndex
CREATE INDEX "Zone_serviceId_idx" ON "public"."Zone"("serviceId");

-- CreateIndex
CREATE INDEX "Zone_providerId_idx" ON "public"."Zone"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_ticketId_key" ON "public"."Complaint"("ticketId");

-- CreateIndex
CREATE INDEX "Complaint_orderId_productId_userId_idx" ON "public"."Complaint"("orderId", "productId", "userId");

-- CreateIndex
CREATE INDEX "Complaint_serviceOrderId_idx" ON "public"."Complaint"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Complaint_serviceId_idx" ON "public"."Complaint"("serviceId");

-- CreateIndex
CREATE INDEX "Complaint_createdAt_idx" ON "public"."Complaint"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "public"."Staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_profileId_key" ON "public"."Staff"("profileId");

-- CreateIndex
CREATE INDEX "Staff_userId_role_idx" ON "public"."Staff"("userId", "role");

-- CreateIndex
CREATE INDEX "Staff_createdById_idx" ON "public"."Staff"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "public"."NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "public"."NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_createdAt_idx" ON "public"."NotificationPreference"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityVerification_userId_key" ON "public"."IdentityVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityVerification_profileId_key" ON "public"."IdentityVerification"("profileId");

-- CreateIndex
CREATE INDEX "IdentityVerification_userId_status_idx" ON "public"."IdentityVerification"("userId", "status");

-- CreateIndex
CREATE INDEX "IdentityVerification_profileId_idx" ON "public"."IdentityVerification"("profileId");

-- CreateIndex
CREATE INDEX "License_userId_idx" ON "public"."License"("userId");

-- CreateIndex
CREATE INDEX "Vehicle_userId_idx" ON "public"."Vehicle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorWalletConfig_virtualAccount1Id_key" ON "public"."VendorWalletConfig"("virtualAccount1Id");

-- CreateIndex
CREATE UNIQUE INDEX "VendorWalletConfig_virtualAccount2Id_key" ON "public"."VendorWalletConfig"("virtualAccount2Id");

-- CreateIndex
CREATE INDEX "VendorWalletConfig_virtualAccount1Id_idx" ON "public"."VendorWalletConfig"("virtualAccount1Id");

-- CreateIndex
CREATE INDEX "VendorWalletConfig_virtualAccount2Id_idx" ON "public"."VendorWalletConfig"("virtualAccount2Id");

-- CreateIndex
CREATE UNIQUE INDEX "VendorWalletConfig_vendorId_deliveryAgentId_key" ON "public"."VendorWalletConfig"("vendorId", "deliveryAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_customerReference_key" ON "public"."ServiceOrder"("customerReference");

-- CreateIndex
CREATE INDEX "ServiceOrder_paymentId_idx" ON "public"."ServiceOrder"("paymentId");

-- CreateIndex
CREATE INDEX "ServiceOrder_userId_agentId_serviceId_zoneId_idx" ON "public"."ServiceOrder"("userId", "agentId", "serviceId", "zoneId");

-- CreateIndex
CREATE INDEX "ServiceOrder_virtualAccountId_idx" ON "public"."ServiceOrder"("virtualAccountId");

-- CreateIndex
CREATE INDEX "ServiceOrder_adminId_idx" ON "public"."ServiceOrder"("adminId");

-- CreateIndex
CREATE INDEX "ServiceOrder_voucherId_idx" ON "public"."ServiceOrder"("voucherId");

-- CreateIndex
CREATE INDEX "ServiceOrder_providerId_idx" ON "public"."ServiceOrder"("providerId");

-- CreateIndex
CREATE INDEX "ServiceOrder_createdAt_idx" ON "public"."ServiceOrder"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrderStatusHistory_serviceOrderId_idx" ON "public"."ServiceOrderStatusHistory"("serviceOrderId");

-- CreateIndex
CREATE INDEX "ServiceOrderStatusHistory_createdAt_idx" ON "public"."ServiceOrderStatusHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BVNVerification_transactionRef_key" ON "public"."BVNVerification"("transactionRef");

-- CreateIndex
CREATE INDEX "BVNVerification_userId_idx" ON "public"."BVNVerification"("userId");

-- CreateIndex
CREATE INDEX "BVNVerification_walletId_idx" ON "public"."BVNVerification"("walletId");

-- CreateIndex
CREATE INDEX "BVNVerification_createdAt_idx" ON "public"."BVNVerification"("createdAt");

-- CreateIndex
CREATE INDEX "Service_providerId_idx" ON "public"."Service"("providerId");

-- CreateIndex
CREATE INDEX "Service_providerRole_idx" ON "public"."Service"("providerRole");

-- CreateIndex
CREATE INDEX "Service_businessVerificationId_idx" ON "public"."Service"("businessVerificationId");

-- CreateIndex
CREATE INDEX "Service_serviceType_idx" ON "public"."Service"("serviceType");

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "public"."Service"("status");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "public"."Service"("categoryId");

-- CreateIndex
CREATE INDEX "Service_agentId_idx" ON "public"."Service"("agentId");

-- CreateIndex
CREATE INDEX "Service_lgaId_idx" ON "public"."Service"("lgaId");

-- CreateIndex
CREATE INDEX "Service_vendorId_idx" ON "public"."Service"("vendorId");

-- CreateIndex
CREATE INDEX "ServiceReview_serviceId_idx" ON "public"."ServiceReview"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceReview_reviewerId_idx" ON "public"."ServiceReview"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerification_userId_key" ON "public"."BusinessVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerification_profileId_key" ON "public"."BusinessVerification"("profileId");

-- CreateIndex
CREATE INDEX "BusinessVerification_userId_idx" ON "public"."BusinessVerification"("userId");

-- CreateIndex
CREATE INDEX "BusinessVerification_profileId_idx" ON "public"."BusinessVerification"("profileId");

-- CreateIndex
CREATE INDEX "BusinessVerification_status_idx" ON "public"."BusinessVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_customerReference_key" ON "public"."ProductOrder"("customerReference");

-- CreateIndex
CREATE INDEX "ProductOrder_createdAt_customerReference_idx" ON "public"."ProductOrder"("createdAt", "customerReference");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVerification_profileId_key" ON "public"."ServiceVerification"("profileId");

-- CreateIndex
CREATE INDEX "ServiceVerification_status_idx" ON "public"."ServiceVerification"("status");

-- CreateIndex
CREATE INDEX "ServiceVerification_profileId_idx" ON "public"."ServiceVerification"("profileId");

-- CreateIndex
CREATE INDEX "ServiceVerification_serviceId_idx" ON "public"."ServiceVerification"("serviceId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_orderId_idx" ON "public"."AuditLog"("orderId");

-- CreateIndex
CREATE INDEX "AuditLog_orderAuditLogId_idx" ON "public"."AuditLog"("orderAuditLogId");

-- CreateIndex
CREATE INDEX "AuditLog_serviceOrderId_idx" ON "public"."AuditLog"("serviceOrderId");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "public"."WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_vendorId_idx" ON "public"."WalletTransaction"("vendorId");

-- CreateIndex
CREATE INDEX "WalletTransaction_serviceOrderId_idx" ON "public"."WalletTransaction"("serviceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Otp_transactionReference_key" ON "public"."Otp"("transactionReference");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "public"."Voucher"("code");

-- CreateIndex
CREATE INDEX "VoucherUsage_voucherId_userId_idx" ON "public"."VoucherUsage"("voucherId", "userId");

-- CreateIndex
CREATE INDEX "Favorite_profileId_entityType_entityId_idx" ON "public"."Favorite"("profileId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_transactionId_key" ON "public"."Transfer"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAddress_userId_address_key" ON "public"."CustomerAddress"("userId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "SubAccount_subAccountCode_key" ON "public"."SubAccount"("subAccountCode");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_ticketId_key" ON "public"."Feedback"("ticketId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "public"."Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "OrderReview_orderId_idx" ON "public"."OrderReview"("orderId");

-- CreateIndex
CREATE INDEX "OrderReview_serviceOrderId_idx" ON "public"."OrderReview"("serviceOrderId");

-- CreateIndex
CREATE INDEX "OrderReview_serviceId_idx" ON "public"."OrderReview"("serviceId");

-- CreateIndex
CREATE INDEX "PayOnDeliveryOrder_orderId_idx" ON "public"."PayOnDeliveryOrder"("orderId");

-- CreateIndex
CREATE INDEX "PayOnDeliveryOrder_serviceOrderId_idx" ON "public"."PayOnDeliveryOrder"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Payment_transactionRef_idx" ON "public"."Payment"("transactionRef");

-- CreateIndex
CREATE INDEX "Payment_monnifyRef_idx" ON "public"."Payment"("monnifyRef");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "public"."Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_serviceOrderId_idx" ON "public"."Payment"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Report_reporterId_adminId_idx" ON "public"."Report"("reporterId", "adminId");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "public"."Report"("createdAt");

-- CreateIndex
CREATE INDEX "Report_serviceOrderId_idx" ON "public"."Report"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Report_productOrderId_idx" ON "public"."Report"("productOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityProvider_name_key" ON "public"."ElectricityProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityProvider_flutterwave_biller_code_key" ON "public"."ElectricityProvider"("flutterwave_biller_code");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "public"."Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_name_key" ON "public"."PaymentProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_flutterwave_biller_code_key" ON "public"."PaymentProvider"("flutterwave_biller_code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "public"."Category"("name");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "public"."Product"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "public"."Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "public"."CartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "public"."OrderItem"("orderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_accessoryId_key" ON "public"."OrderItem"("orderId", "accessoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfig_paymentMethod_key" ON "public"."PaymentConfig"("paymentMethod");

-- CreateIndex
CREATE INDEX "Dispute_createdAt_idx" ON "public"."Dispute"("createdAt");

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "public"."Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_serviceOrderId_idx" ON "public"."Dispute"("serviceOrderId");

-- CreateIndex
CREATE INDEX "Dispute_productId_idx" ON "public"."Dispute"("productId");

-- CreateIndex
CREATE INDEX "Dispute_serviceId_idx" ON "public"."Dispute"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_transactionRef_key" ON "public"."Withdrawal"("transactionRef");

-- CreateIndex
CREATE INDEX "Withdrawal_createdAt_idx" ON "public"."Withdrawal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalLimit_entityType_limitType_key" ON "public"."WithdrawalLimit"("entityType", "limitType");

-- CreateIndex
CREATE INDEX "QuicrifillWithdrawal_createdAt_idx" ON "public"."QuicrifillWithdrawal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppInstallation_deviceId_key" ON "public"."AppInstallation"("deviceId");

-- CreateIndex
CREATE INDEX "AppInstallation_createdAt_idx" ON "public"."AppInstallation"("createdAt");

-- CreateIndex
CREATE INDEX "AppInstallation_userId_deviceId_idx" ON "public"."AppInstallation"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "public"."Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "public"."Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_countryId_key" ON "public"."State"("name", "countryId");

-- CreateIndex
CREATE INDEX "City_stateId_idx" ON "public"."City"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_lgaId_key" ON "public"."City"("name", "lgaId");

-- CreateIndex
CREATE UNIQUE INDEX "Lga_name_stateId_key" ON "public"."Lga"("name", "stateId");

-- CreateIndex
CREATE INDEX "VirtualAccount_userId_idx" ON "public"."VirtualAccount"("userId");

-- CreateIndex
CREATE INDEX "VirtualAccount_vendorId_idx" ON "public"."VirtualAccount"("vendorId");

-- CreateIndex
CREATE INDEX "VirtualAccount_walletId_idx" ON "public"."VirtualAccount"("walletId");

-- CreateIndex
CREATE INDEX "FraudAlert_createdAt_idx" ON "public"."FraudAlert"("createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_entityId_entityType_idx" ON "public"."FraudAlert"("entityId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_name_key" ON "public"."EmailTemplate"("name");

-- CreateIndex
CREATE INDEX "EmailTemplate_name_idx" ON "public"."EmailTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePrivilege_role_key" ON "public"."RolePrivilege"("role");

-- CreateIndex
CREATE INDEX "CrashReport_reportedAt_idx" ON "public"."CrashReport"("reportedAt");

-- CreateIndex
CREATE INDEX "CrashReport_userId_idx" ON "public"."CrashReport"("userId");

-- CreateIndex
CREATE INDEX "CrashReport_deviceId_idx" ON "public"."CrashReport"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionRequest_userId_key" ON "public"."AccountDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_userId_idx" ON "public"."AccountDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_status_idx" ON "public"."AccountDeletionRequest"("status");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_requestedAt_idx" ON "public"."AccountDeletionRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_reviewedById_idx" ON "public"."AccountDeletionRequest"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSettings_userId_key" ON "public"."WalletSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletSettings_walletId_key" ON "public"."WalletSettings"("walletId");

-- CreateIndex
CREATE INDEX "BankCard_profileId_idx" ON "public"."BankCard"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BankCard_userId_walletId_key" ON "public"."BankCard"("userId", "walletId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "public"."OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_serviceOrderId_idx" ON "public"."OrderStatusHistory"("serviceOrderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_createdAt_idx" ON "public"."OrderStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookAttempt_walletTransactionId_idx" ON "public"."WebhookAttempt"("walletTransactionId");

-- CreateIndex
CREATE INDEX "WebhookAttempt_createdAt_idx" ON "public"."WebhookAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_name_key" ON "public"."EventType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SMSTemplate_name_key" ON "public"."SMSTemplate"("name");

-- CreateIndex
CREATE INDEX "SMSTemplate_name_idx" ON "public"."SMSTemplate"("name");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "public"."NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "public"."NotificationLog"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_vendorId_idx" ON "public"."NotificationLog"("vendorId");

-- CreateIndex
CREATE INDEX "NotificationLog_eventTypeId_idx" ON "public"."NotificationLog"("eventTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PushTemplate_name_key" ON "public"."PushTemplate"("name");

-- CreateIndex
CREATE INDEX "PushTemplate_name_idx" ON "public"."PushTemplate"("name");

-- CreateIndex
CREATE INDEX "ChurnInsight_month_idx" ON "public"."ChurnInsight"("month");

-- CreateIndex
CREATE INDEX "_ServiceToLicenses_B_index" ON "public"."_ServiceToLicenses"("B");

-- CreateIndex
CREATE INDEX "_ServiceToVehicles_B_index" ON "public"."_ServiceToVehicles"("B");

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Zone" ADD CONSTRAINT "Zone_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdentityVerification" ADD CONSTRAINT "IdentityVerification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdentityVerification" ADD CONSTRAINT "IdentityVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."License" ADD CONSTRAINT "License_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VendorWalletConfig" ADD CONSTRAINT "VendorWalletConfig_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VendorWalletConfig" ADD CONSTRAINT "VendorWalletConfig_deliveryAgentId_fkey" FOREIGN KEY ("deliveryAgentId") REFERENCES "public"."Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VendorWalletConfig" ADD CONSTRAINT "VendorWalletConfig_virtualAccount1Id_fkey" FOREIGN KEY ("virtualAccount1Id") REFERENCES "public"."VirtualAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VendorWalletConfig" ADD CONSTRAINT "VendorWalletConfig_virtualAccount2Id_fkey" FOREIGN KEY ("virtualAccount2Id") REFERENCES "public"."VirtualAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "public"."Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "public"."CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "public"."City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "public"."VirtualAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "public"."Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."ElectricityProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrderStatusHistory" ADD CONSTRAINT "ServiceOrderStatusHistory_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrderStatusHistory" ADD CONSTRAINT "ServiceOrderStatusHistory_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BVNVerification" ADD CONSTRAINT "BVNVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BVNVerification" ADD CONSTRAINT "BVNVerification_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "public"."City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "public"."Lga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_businessVerificationId_fkey" FOREIGN KEY ("businessVerificationId") REFERENCES "public"."BusinessVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_deliveryRepId_fkey" FOREIGN KEY ("deliveryRepId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceReview" ADD CONSTRAINT "ServiceReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessVerification" ADD CONSTRAINT "BusinessVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessVerification" ADD CONSTRAINT "BusinessVerification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "public"."CustomerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "public"."Lga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "public"."City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "public"."Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVerification" ADD CONSTRAINT "ServiceVerification_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVerification" ADD CONSTRAINT "ServiceVerification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVerification" ADD CONSTRAINT "ServiceVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_orderAuditLogId_fkey" FOREIGN KEY ("orderAuditLogId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_electricityProviderId_fkey" FOREIGN KEY ("electricityProviderId") REFERENCES "public"."ElectricityProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Voucher" ADD CONSTRAINT "Voucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherUsage" ADD CONSTRAINT "VoucherUsage_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "public"."Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherUsage" ADD CONSTRAINT "VoucherUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transfer" ADD CONSTRAINT "Transfer_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."WalletTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAddress" ADD CONSTRAINT "CustomerAddress_user_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAddress" ADD CONSTRAINT "CustomerAddress_profile_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Profile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubAccount" ADD CONSTRAINT "SubAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderReview" ADD CONSTRAINT "OrderReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderReview" ADD CONSTRAINT "OrderReview_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderReview" ADD CONSTRAINT "OrderReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderReview" ADD CONSTRAINT "OrderReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayOnDeliveryOrder" ADD CONSTRAINT "PayOnDeliveryOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayOnDeliveryOrder" ADD CONSTRAINT "PayOnDeliveryOrder_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PayOnDeliveryOrder" ADD CONSTRAINT "PayOnDeliveryOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."PaymentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_electricityProviderId_fkey" FOREIGN KEY ("electricityProviderId") REFERENCES "public"."ElectricityProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_agentProfileId_fkey" FOREIGN KEY ("agentProfileId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "public"."ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."ElectricityProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wallet" ADD CONSTRAINT "Wallet_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_productOwnerId_fkey" FOREIGN KEY ("productOwnerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Infraction" ADD CONSTRAINT "Infraction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Infraction" ADD CONSTRAINT "Infraction_deliveryRep_fkey" FOREIGN KEY ("deliveryRepId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Infraction" ADD CONSTRAINT "Infraction_vendor_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "public"."Accessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispute" ADD CONSTRAINT "Dispute_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispute" ADD CONSTRAINT "Dispute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispute" ADD CONSTRAINT "Dispute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Withdrawal" ADD CONSTRAINT "Withdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuicrifillWithdrawal" ADD CONSTRAINT "QuicrifillWithdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."QuicrifillWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppInstallation" ADD CONSTRAINT "AppInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."City" ADD CONSTRAINT "City_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "public"."Lga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."City" ADD CONSTRAINT "City_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lga" ADD CONSTRAINT "Lga_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VirtualAccount" ADD CONSTRAINT "VirtualAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VirtualAccount" ADD CONSTRAINT "VirtualAccount_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FraudAlert" ADD CONSTRAINT "FraudAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FraudAlert" ADD CONSTRAINT "FraudAlert_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FraudAlert" ADD CONSTRAINT "FraudAlert_productOrder_fkey" FOREIGN KEY ("entityId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FraudAlert" ADD CONSTRAINT "FraudAlert_serviceOrder_fkey" FOREIGN KEY ("entityId") REFERENCES "public"."ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FraudAlert" ADD CONSTRAINT "FraudAlert_payment_fkey" FOREIGN KEY ("entityId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailTemplate" ADD CONSTRAINT "EmailTemplate_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailTemplate" ADD CONSTRAINT "EmailTemplate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrashReport" ADD CONSTRAINT "CrashReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CrashReport" ADD CONSTRAINT "CrashReport_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."AppInstallation"("deviceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appeal" ADD CONSTRAINT "Appeal_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletSettings" ADD CONSTRAINT "WalletSettings_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WalletSettings" ADD CONSTRAINT "WalletSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankCard" ADD CONSTRAINT "BankCard_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankCard" ADD CONSTRAINT "BankCard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BankCard" ADD CONSTRAINT "BankCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookAttempt" ADD CONSTRAINT "WebhookAttempt_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "public"."WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventType" ADD CONSTRAINT "EventType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SMSTemplate" ADD CONSTRAINT "SMSTemplate_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SMSTemplate" ADD CONSTRAINT "SMSTemplate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushTemplate" ADD CONSTRAINT "PushTemplate_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushTemplate" ADD CONSTRAINT "PushTemplate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Webhook" ADD CONSTRAINT "Webhook_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailSettings" ADD CONSTRAINT "EmailSettings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SMSSettings" ADD CONSTRAINT "SMSSettings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardRule" ADD CONSTRAINT "RewardRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RewardRule" ADD CONSTRAINT "RewardRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reward" ADD CONSTRAINT "Reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServiceToLicenses" ADD CONSTRAINT "_ServiceToLicenses_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServiceToLicenses" ADD CONSTRAINT "_ServiceToLicenses_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServiceToVehicles" ADD CONSTRAINT "_ServiceToVehicles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServiceToVehicles" ADD CONSTRAINT "_ServiceToVehicles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
