/*
  Warnings:

  - You are about to drop the column `serviceType` on the `Service` table. All the data in the column will be lost.
  - Added the required column `serviceTypeId` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropIndex
DROP INDEX "public"."Service_serviceType_idx";

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "productTypeId" UUID,
ALTER COLUMN "categoryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Service" DROP COLUMN "serviceType",
ADD COLUMN     "serviceTypeId" UUID NOT NULL;

-- DropEnum
DROP TYPE "public"."ServiceType";

-- CreateTable
CREATE TABLE "public"."ServiceType" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductType" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_name_key" ON "public"."ServiceType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "public"."ProductType"("name");

-- CreateIndex
CREATE INDEX "ProductType_categoryId_idx" ON "public"."ProductType"("categoryId");

-- CreateIndex
CREATE INDEX "Product_productTypeId_idx" ON "public"."Product"("productTypeId");

-- CreateIndex
CREATE INDEX "Service_serviceTypeId_idx" ON "public"."Service"("serviceTypeId");

-- AddForeignKey
ALTER TABLE "public"."ServiceType" ADD CONSTRAINT "ServiceType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductType" ADD CONSTRAINT "ProductType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
