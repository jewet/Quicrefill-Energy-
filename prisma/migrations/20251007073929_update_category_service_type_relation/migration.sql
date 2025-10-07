/*
  Warnings:

  - You are about to drop the `Service` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ServiceToLicenses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ServiceToVehicles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Complaint" DROP CONSTRAINT "Complaint_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Dispute" DROP CONSTRAINT "Dispute_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderReview" DROP CONSTRAINT "OrderReview_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_agentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_businessVerificationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_cityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_countryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_deliveryRepId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_lgaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_providerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_serviceTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_stateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Service" DROP CONSTRAINT "Service_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOrder" DROP CONSTRAINT "ServiceOrder_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceReview" DROP CONSTRAINT "ServiceReview_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceVerification" DROP CONSTRAINT "ServiceVerification_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Zone" DROP CONSTRAINT "Zone_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ServiceToLicenses" DROP CONSTRAINT "_ServiceToLicenses_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ServiceToLicenses" DROP CONSTRAINT "_ServiceToLicenses_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ServiceToVehicles" DROP CONSTRAINT "_ServiceToVehicles_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ServiceToVehicles" DROP CONSTRAINT "_ServiceToVehicles_B_fkey";

-- AlterTable
ALTER TABLE "public"."ServiceType" ADD COLUMN     "categoryId" UUID;

-- DropTable
DROP TABLE "public"."Service";

-- DropTable
DROP TABLE "public"."_ServiceToLicenses";

-- DropTable
DROP TABLE "public"."_ServiceToVehicles";

-- CreateTable
CREATE TABLE "public"."Services" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceTypeId" UUID NOT NULL,
    "status" "public"."ServiceStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "pricePerUnit" DECIMAL(10,2) NOT NULL,
    "deliveryCost" DECIMAL(10,2),
    "minimumOrder" INTEGER NOT NULL DEFAULT 1,
    "maximumOrder" INTEGER,
    "paymentOptions" VARCHAR(255),
    "Contact" VARCHAR(255),
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
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verificationStatus" "public"."VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "avgRating" DOUBLE PRECISION DEFAULT 0.0,
    "ratingCount" INTEGER DEFAULT 0,
    "billerCode" VARCHAR(50),
    "itemCode" VARCHAR(50),
    "destinationBankCode" VARCHAR(50),
    "destinationAccountNumber" VARCHAR(50),
    "vendorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessName" VARCHAR(255),

    CONSTRAINT "Services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ServicesToLicenses" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ServicesToLicenses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ServicesToVehicles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ServicesToVehicles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Services_providerId_idx" ON "public"."Services"("providerId");

-- CreateIndex
CREATE INDEX "Services_providerRole_idx" ON "public"."Services"("providerRole");

-- CreateIndex
CREATE INDEX "Services_businessVerificationId_idx" ON "public"."Services"("businessVerificationId");

-- CreateIndex
CREATE INDEX "Services_serviceTypeId_idx" ON "public"."Services"("serviceTypeId");

-- CreateIndex
CREATE INDEX "Services_status_idx" ON "public"."Services"("status");

-- CreateIndex
CREATE INDEX "Services_isActive_idx" ON "public"."Services"("isActive");

-- CreateIndex
CREATE INDEX "Services_agentId_idx" ON "public"."Services"("agentId");

-- CreateIndex
CREATE INDEX "Services_lgaId_idx" ON "public"."Services"("lgaId");

-- CreateIndex
CREATE INDEX "Services_vendorId_idx" ON "public"."Services"("vendorId");

-- CreateIndex
CREATE INDEX "_ServicesToLicenses_B_index" ON "public"."_ServicesToLicenses"("B");

-- CreateIndex
CREATE INDEX "_ServicesToVehicles_B_index" ON "public"."_ServicesToVehicles"("B");

-- CreateIndex
CREATE INDEX "ServiceType_categoryId_idx" ON "public"."ServiceType"("categoryId");

-- AddForeignKey
ALTER TABLE "public"."Zone" ADD CONSTRAINT "Zone_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Complaint" ADD CONSTRAINT "Complaint_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceType" ADD CONSTRAINT "ServiceType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "public"."City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "public"."Lga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_businessVerificationId_fkey" FOREIGN KEY ("businessVerificationId") REFERENCES "public"."BusinessVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_deliveryRepId_fkey" FOREIGN KEY ("deliveryRepId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Services" ADD CONSTRAINT "Services_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceReview" ADD CONSTRAINT "ServiceReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceVerification" ADD CONSTRAINT "ServiceVerification_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderReview" ADD CONSTRAINT "OrderReview_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispute" ADD CONSTRAINT "Dispute_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServicesToLicenses" ADD CONSTRAINT "_ServicesToLicenses_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServicesToLicenses" ADD CONSTRAINT "_ServicesToLicenses_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServicesToVehicles" ADD CONSTRAINT "_ServicesToVehicles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ServicesToVehicles" ADD CONSTRAINT "_ServicesToVehicles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
