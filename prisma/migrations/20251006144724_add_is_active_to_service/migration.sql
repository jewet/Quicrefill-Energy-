-- AlterTable
ALTER TABLE "public"."Service" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "public"."Service"("isActive");
