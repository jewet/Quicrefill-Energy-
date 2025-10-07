-- CreateTable
CREATE TABLE "public"."ContactOption" (
    "id" SERIAL NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "details" TEXT NOT NULL,
    "responseTime" VARCHAR(100),
    "businessHours" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ContactOption_pkey" PRIMARY KEY ("id")
);
