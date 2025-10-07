/*
  Warnings:

  - Added the required column `updatedAt` to the `Reward` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Reward" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
