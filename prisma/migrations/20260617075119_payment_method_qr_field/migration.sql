-- Add a distinct "QR สนาม" payment method (field QR) separate from the regular QR.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'QR_FIELD';
