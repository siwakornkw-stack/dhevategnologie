-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "PosInvoice"
  ADD COLUMN "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "shiftId" TEXT;

-- CreateTable
CREATE TABLE "PosShift" (
    "id" TEXT NOT NULL,
    "shiftNo" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingNote" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "countedCash" DOUBLE PRECISION,
    "closingNote" TEXT,

    CONSTRAINT "PosShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosRefund" (
    "id" TEXT NOT NULL,
    "refundNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "shiftId" TEXT,
    "cashierId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "itemsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosShift_shiftNo_key" ON "PosShift"("shiftNo");

-- CreateIndex
CREATE INDEX "PosShift_status_idx" ON "PosShift"("status");

-- CreateIndex
CREATE INDEX "PosShift_openedAt_idx" ON "PosShift"("openedAt");

-- CreateIndex
CREATE INDEX "PosShift_cashierId_idx" ON "PosShift"("cashierId");

-- CreateIndex
CREATE UNIQUE INDEX "PosRefund_refundNo_key" ON "PosRefund"("refundNo");

-- CreateIndex
CREATE INDEX "PosRefund_invoiceId_idx" ON "PosRefund"("invoiceId");

-- CreateIndex
CREATE INDEX "PosRefund_shiftId_idx" ON "PosRefund"("shiftId");

-- CreateIndex
CREATE INDEX "PosRefund_createdAt_idx" ON "PosRefund"("createdAt");

-- CreateIndex
CREATE INDEX "PosInvoice_shiftId_idx" ON "PosInvoice"("shiftId");

-- AddForeignKey
ALTER TABLE "PosInvoice" ADD CONSTRAINT "PosInvoice_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PosInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRefund" ADD CONSTRAINT "PosRefund_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "PosShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
