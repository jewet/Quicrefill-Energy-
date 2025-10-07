/*
  Warnings:

  - Made the column `customerReference` on table `ServiceOrder` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."AdminSettings" ADD COLUMN     "defaultPetroleumTaxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."ServiceOrder" ALTER COLUMN "customerReference" SET NOT NULL;
