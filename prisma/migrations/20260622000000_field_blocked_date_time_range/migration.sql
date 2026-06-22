-- Optional time window for a blocked date. Both NULL = whole day closed (existing rows).
ALTER TABLE "FieldBlockedDate" ADD COLUMN "startTime" TEXT;
ALTER TABLE "FieldBlockedDate" ADD COLUMN "endTime" TEXT;
