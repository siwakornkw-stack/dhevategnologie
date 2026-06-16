-- Stock-variant: a pack/bundle product draws from a base product's stock pool.
ALTER TABLE "PosProduct" ADD COLUMN "stockParentId" TEXT;
ALTER TABLE "PosProduct" ADD COLUMN "unitsPerStock" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PosProduct" ADD CONSTRAINT "PosProduct_stockParentId_fkey" FOREIGN KEY ("stockParentId") REFERENCES "PosProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PosProduct_stockParentId_idx" ON "PosProduct"("stockParentId");
