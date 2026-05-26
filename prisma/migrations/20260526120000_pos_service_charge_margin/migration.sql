-- Phase 4a: service charge + margin (additive)
ALTER TABLE "PosInvoice"
  ADD COLUMN "serviceCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "totalCost"     DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "PosSettings"
  ADD COLUMN "serviceChargeRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
