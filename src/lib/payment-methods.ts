// POS payment methods selectable in the UI. QR_FIELD ("QR สนาม") is a court/field QR
// kept separate from the regular QR so reports can tell them apart.
export const POS_PAY_METHODS = ['CASH', 'QR', 'QR_FIELD', 'TRANSFER', 'CARD'] as const;
export type PosPayMethod = (typeof POS_PAY_METHODS)[number];

// Display label for a payment-method value. Only QR_FIELD is relabelled; the rest show as-is
// to match the existing receipts/reports.
export function methodLabel(m: string): string {
  return m === 'QR_FIELD' ? 'QR สนาม' : m;
}
