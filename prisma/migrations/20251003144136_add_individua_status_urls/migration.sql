-- AlterTable
ALTER TABLE "public"."BusinessVerification" ADD COLUMN     "urlStatuses" JSONB;

-- AlterTable
ALTER TABLE "public"."License" ADD COLUMN     "urlStatuses" JSONB;

-- AlterTable
ALTER TABLE "public"."Vehicle" ADD COLUMN     "urlStatuses" JSONB;
