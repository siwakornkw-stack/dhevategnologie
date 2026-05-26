-- Prevent same cashier from having multiple OPEN shifts (race-safe)
CREATE UNIQUE INDEX "PosShift_cashier_open_unique" ON "PosShift" ("cashierId") WHERE status = 'OPEN';
