-- AlterTable
ALTER TABLE "public"."Service" ADD COLUMN     "billerCode" VARCHAR(50),
ADD COLUMN     "destinationAccountNumber" VARCHAR(50),
ADD COLUMN     "destinationBankCode" VARCHAR(50),
ADD COLUMN     "itemCode" VARCHAR(50);
