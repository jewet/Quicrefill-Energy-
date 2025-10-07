-- AlterTable
ALTER TABLE "public"."WalletTransaction" ADD COLUMN     "productOrderId" UUID;

-- CreateIndex
CREATE INDEX "WalletTransaction_productOrderId_idx" ON "public"."WalletTransaction"("productOrderId");

-- AddForeignKey
ALTER TABLE "public"."WalletTransaction" ADD CONSTRAINT "WalletTransaction_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "public"."ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
