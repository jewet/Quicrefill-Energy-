/*
  Warnings:

  - Made the column `profileId` on table `IdentityVerification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `documentNumber` on table `IdentityVerification` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."IdentityVerification" ALTER COLUMN "profileId" SET NOT NULL,
ALTER COLUMN "documentNumber" SET NOT NULL;
