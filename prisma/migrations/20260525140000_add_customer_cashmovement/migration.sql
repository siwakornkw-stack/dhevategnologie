-- Phase 2: full tax invoice fields + petty cash movement + requireShift toggle
CREATE TYPE "CashMovementType" AS ENUM ('PAY_IN', 'PAY_OUT');

ALTER TABLE "PosInvoice"
  ADD COLUMN "customerId"      TEXT,
  ADD COLUMN "customerName"    TEXT,
  ADD COLUMN "customerTaxId"   TEXT,
  ADD COLUMN "customerAddress" TEXT,
  ADD COLUMN "customerPhone"   TEXT;

ALTER TABLE "PosSettings"
  ADD COLUMN "requireShift" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PosCashMovement" (
  "id"        TEXT NOT NULL,
  "shiftId"   TEXT NOT NULL,
  "type"      "CashMovementType" NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL,
  "reason"    TEXT,
  "userId"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosCashMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosCashMovement_shiftId_idx"   ON "PosCashMovement"("shiftId");
CREATE INDEX "PosCashMovement_createdAt_idx" ON "PosCashMovement"("createdAt");

ALTER TABLE "PosCashMovement"
  ADD CONSTRAINT "PosCashMovement_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
