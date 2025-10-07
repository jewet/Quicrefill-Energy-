/*
  Warnings:

  - You are about to drop the column `roles` on the `EmailTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `giverRole` on the `Feedback` table. All the data in the column will be lost.
  - You are about to drop the column `receiverRole` on the `Feedback` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `roles` on the `PushTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Rating` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `RolePrivilege` table. All the data in the column will be lost.
  - You are about to drop the column `roles` on the `SMSTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `restrictedToRoles` on the `Voucher` table. All the data in the column will be lost.
  - You are about to drop the column `roles` on the `Webhook` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `WithdrawalLimit` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,roleId]` on the table `Rating` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roleId]` on the table `RolePrivilege` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roleId,limitType]` on the table `WithdrawalLimit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `giverRoleId` to the `Feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiverRoleId` to the `Feedback` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `Rating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `RolePrivilege` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `WithdrawalLimit` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Profile_role_idx";

-- DropIndex
DROP INDEX "public"."Rating_userId_role_key";

-- DropIndex
DROP INDEX "public"."RolePrivilege_role_key";

-- DropIndex
DROP INDEX "public"."Staff_userId_role_idx";

-- DropIndex
DROP INDEX "public"."WithdrawalLimit_entityType_limitType_key";

-- AlterTable
ALTER TABLE "public"."EmailTemplate" DROP COLUMN "roles";

-- AlterTable
ALTER TABLE "public"."Feedback" DROP COLUMN "giverRole",
DROP COLUMN "receiverRole",
ADD COLUMN     "giverRoleId" UUID NOT NULL,
ADD COLUMN     "receiverRoleId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "public"."Profile" DROP COLUMN "role",
ADD COLUMN     "roleId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "public"."PushTemplate" DROP COLUMN "roles";

-- AlterTable
ALTER TABLE "public"."Rating" DROP COLUMN "role",
ADD COLUMN     "roleId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "public"."RolePrivilege" DROP COLUMN "role",
ADD COLUMN     "roleId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "public"."SMSTemplate" DROP COLUMN "roles";

-- AlterTable
ALTER TABLE "public"."Staff" DROP COLUMN "role",
ADD COLUMN     "roleId" UUID;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "role",
ADD COLUMN     "roleId" UUID;

-- AlterTable
ALTER TABLE "public"."Voucher" DROP COLUMN "restrictedToRoles";

-- AlterTable
ALTER TABLE "public"."Webhook" DROP COLUMN "roles";

-- AlterTable
ALTER TABLE "public"."WithdrawalLimit" DROP COLUMN "entityType",
ADD COLUMN     "roleId" UUID NOT NULL;

-- DropEnum
DROP TYPE "public"."Role";

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_SMSTemplateRoles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_SMSTemplateRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_WebhookRoles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_WebhookRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_VoucherRestrictedToRoles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_VoucherRestrictedToRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_EmailTemplateRoles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_EmailTemplateRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_PushTemplateRoles" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PushTemplateRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "public"."Role"("name");

-- CreateIndex
CREATE INDEX "Role_createdById_idx" ON "public"."Role"("createdById");

-- CreateIndex
CREATE INDEX "_SMSTemplateRoles_B_index" ON "public"."_SMSTemplateRoles"("B");

-- CreateIndex
CREATE INDEX "_WebhookRoles_B_index" ON "public"."_WebhookRoles"("B");

-- CreateIndex
CREATE INDEX "_VoucherRestrictedToRoles_B_index" ON "public"."_VoucherRestrictedToRoles"("B");

-- CreateIndex
CREATE INDEX "_EmailTemplateRoles_B_index" ON "public"."_EmailTemplateRoles"("B");

-- CreateIndex
CREATE INDEX "_PushTemplateRoles_B_index" ON "public"."_PushTemplateRoles"("B");

-- CreateIndex
CREATE INDEX "Profile_roleId_idx" ON "public"."Profile"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_roleId_key" ON "public"."Rating"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePrivilege_roleId_key" ON "public"."RolePrivilege"("roleId");

-- CreateIndex
CREATE INDEX "Staff_userId_roleId_idx" ON "public"."Staff"("userId", "roleId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "public"."User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalLimit_roleId_limitType_key" ON "public"."WithdrawalLimit"("roleId", "limitType");

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Role" ADD CONSTRAINT "Role_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Staff" ADD CONSTRAINT "Staff_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_giverRoleId_fkey" FOREIGN KEY ("giverRoleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_receiverRoleId_fkey" FOREIGN KEY ("receiverRoleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WithdrawalLimit" ADD CONSTRAINT "WithdrawalLimit_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WithdrawalLimit" ADD CONSTRAINT "WithdrawalLimit_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolePrivilege" ADD CONSTRAINT "RolePrivilege_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SMSTemplateRoles" ADD CONSTRAINT "_SMSTemplateRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SMSTemplateRoles" ADD CONSTRAINT "_SMSTemplateRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."SMSTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_WebhookRoles" ADD CONSTRAINT "_WebhookRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_WebhookRoles" ADD CONSTRAINT "_WebhookRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_VoucherRestrictedToRoles" ADD CONSTRAINT "_VoucherRestrictedToRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_VoucherRestrictedToRoles" ADD CONSTRAINT "_VoucherRestrictedToRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_EmailTemplateRoles" ADD CONSTRAINT "_EmailTemplateRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_EmailTemplateRoles" ADD CONSTRAINT "_EmailTemplateRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PushTemplateRoles" ADD CONSTRAINT "_PushTemplateRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."PushTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PushTemplateRoles" ADD CONSTRAINT "_PushTemplateRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
