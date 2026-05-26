-- Phase 3: loyalty points settings + invoice point tracking
ALTER TABLE "PosInvoice"
  ADD COLUMN "pointsEarned"      INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN "pointsRedeemed"    INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN "pointsRedeemValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "PosSettings"
  ADD COLUMN "pointsEarnPerBaht" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "pointsValueBaht"   DOUBLE PRECISION NOT NULL DEFAULT 1;
