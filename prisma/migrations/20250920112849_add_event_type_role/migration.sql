-- CreateTable
CREATE TABLE "public"."EventTypeRole" (
    "id" UUID NOT NULL,
    "eventTypeId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTypeRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTypeRole_eventTypeId_idx" ON "public"."EventTypeRole"("eventTypeId");

-- CreateIndex
CREATE INDEX "EventTypeRole_roleId_idx" ON "public"."EventTypeRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTypeRole_eventTypeId_roleId_key" ON "public"."EventTypeRole"("eventTypeId", "roleId");

-- AddForeignKey
ALTER TABLE "public"."EventTypeRole" ADD CONSTRAINT "EventTypeRole_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventTypeRole" ADD CONSTRAINT "EventTypeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
