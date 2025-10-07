-- AlterTable
ALTER TABLE "public"."ProductOrder" ADD COLUMN     "productTypeId" UUID;

-- AlterTable
ALTER TABLE "public"."ServiceOrder" ADD COLUMN     "serviceTypeId" UUID;

-- CreateIndex
CREATE INDEX "ProductOrder_productTypeId_idx" ON "public"."ProductOrder"("productTypeId");

-- AddForeignKey
ALTER TABLE "public"."ServiceOrder" ADD CONSTRAINT "ServiceOrder_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductOrder" ADD CONSTRAINT "ProductOrder_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
