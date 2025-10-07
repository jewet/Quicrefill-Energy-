/*
  Warnings:

  - You are about to drop the column `supportContact` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Service" DROP COLUMN "supportContact",
ADD COLUMN     "Contact" VARCHAR(255);
