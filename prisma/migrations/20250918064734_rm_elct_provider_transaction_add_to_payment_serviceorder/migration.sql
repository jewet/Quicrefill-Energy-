/*
  Warnings:

  - You are about to drop the column `electricityProviderId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `providerId` on the `ServiceOrder` table. All the data in the column will be lost.
  - You are about to drop the column `electricityProviderId` on the `WalletTransaction` table. All the data in the column will be lost.
  - You are about to drop the `ElectricityProvider` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_electricityProviderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceOrder" DROP CONSTRAINT "ServiceOrder_providerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_providerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WalletTransaction" DROP CONSTRAINT "WalletTransaction_electricityProviderId_fkey";

-- DropIndex
DROP INDEX "public"."ServiceOrder_providerId_idx";

-- AlterTable
ALTER TABLE "public"."Payment" DROP COLUMN "electricityProviderId",
ADD COLUMN     "billerCode" VARCHAR(50);

-- AlterTable
ALTER TABLE "public"."ServiceOrder" DROP COLUMN "providerId",
ADD COLUMN     "billerCode" VARCHAR(50),
ADD COLUMN     "itemCode" VARCHAR(50);

-- AlterTable
ALTER TABLE "public"."WalletTransaction" DROP COLUMN "electricityProviderId",
ADD COLUMN     "billerCode" VARCHAR(50);

-- DropTable
DROP TABLE "public"."ElectricityProvider";

-- DropTable
DROP TABLE "public"."Transaction";

-- CreateIndex
CREATE INDEX "Payment_billerCode_idx" ON "public"."Payment"("billerCode");

-- CreateIndex
CREATE INDEX "ServiceOrder_billerCode_idx" ON "public"."ServiceOrder"("billerCode");

-- CreateIndex
CREATE INDEX "WalletTransaction_billerCode_idx" ON "public"."WalletTransaction"("billerCode");
