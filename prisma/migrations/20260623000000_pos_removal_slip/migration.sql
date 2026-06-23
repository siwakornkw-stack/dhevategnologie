-- "รายการที่ลบ" slips: quantities removed from saved cart lines, kept for the history page.
CREATE TABLE "PosRemovalSlip" (
    "id" TEXT NOT NULL,
    "tabId" TEXT,
    "tabName" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "cashierId" TEXT,
    "cashierName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosRemovalSlip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosRemovalSlip_createdAt_idx" ON "PosRemovalSlip"("createdAt");
