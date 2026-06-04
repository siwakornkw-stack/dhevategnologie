-- Split booking invoice from POS invoice: self-relation back to source invoice
ALTER TABLE "PosInvoice"
  ADD COLUMN "relatedInvoiceId" TEXT;

ALTER TABLE "PosInvoice"
  ADD CONSTRAINT "PosInvoice_relatedInvoiceId_fkey"
  FOREIGN KEY ("relatedInvoiceId") REFERENCES "PosInvoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PosInvoice_relatedInvoiceId_idx" ON "PosInvoice"("relatedInvoiceId");
