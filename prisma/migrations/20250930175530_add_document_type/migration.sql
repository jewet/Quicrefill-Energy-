/*
  Warnings:

  - Added the required column `documentType` to the `BusinessVerification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentType` to the `License` table without a default value. This is not possible if the table is not empty.
  - Made the column `documentBackUrl` on table `License` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."BusinessVerification" ADD COLUMN     "documentType" "public"."DocumentType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."License" ADD COLUMN     "documentType" "public"."DocumentType" NOT NULL,
ALTER COLUMN "documentBackUrl" SET NOT NULL;
