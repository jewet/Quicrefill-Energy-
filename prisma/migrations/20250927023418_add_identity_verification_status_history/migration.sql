-- CreateTable
CREATE TABLE "public"."IdentityVerificationStatusHistory" (
    "id" UUID NOT NULL,
    "verificationId" UUID NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL,
    "updatedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityVerificationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdentityVerificationStatusHistory_verificationId_idx" ON "public"."IdentityVerificationStatusHistory"("verificationId");

-- CreateIndex
CREATE INDEX "IdentityVerificationStatusHistory_createdAt_idx" ON "public"."IdentityVerificationStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."IdentityVerificationStatusHistory" ADD CONSTRAINT "IdentityVerificationStatusHistory_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "public"."IdentityVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdentityVerificationStatusHistory" ADD CONSTRAINT "IdentityVerificationStatusHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
