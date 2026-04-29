export function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  const [openH] = openTime.split(':').map(Number);
  const [closeH] = closeTime.split(':').map(Number);

  for (let h = openH; h < closeH; h++) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const end = `${String(h + 1).padStart(2, '0')}:00`;
    slots.push(`${start}-${end}`);
  }
  return slots;
}


export function formatDate(date: Date): string {
  return date.toLocaleDateString('th-TH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const SPORT_TYPE_LABELS: Record<string, string> = {
  FOOTBALL: 'ฟุตบอล',
  BASKETBALL: 'บาสเกตบอล',
  BADMINTON: 'แบดมินตัน',
  TENNIS: 'เทนนิส',
  VOLLEYBALL: 'วอลเลย์บอล',
  SWIMMING: 'ว่ายน้ำ',
  OTHER: 'อื่นๆ',
};

export const SPORT_TYPE_EMOJI: Record<string, string> = {
  FOOTBALL: '⚽',
  BASKETBALL: '🏀',
  BADMINTON: '🏸',
  TENNIS: '🎾',
  VOLLEYBALL: '🏐',
  SWIMMING: '🏊',
  OTHER: '🏟️',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
  CANCELLED: 'ยกเลิก',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// --- Pure helpers (unit-tested) ---

const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const toTime = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Expand a range like "08:00-10:00" into hourly slots ["08:00-09:00","09:00-10:00"].
 * A single-hour range is returned as-is.
 */
export function expandTimeSlot(ts: string): string[] {
  const [start, end] = ts.split('-');
  const startM = toMinutes(start);
  const endM = toMinutes(end);
  if (endM - startM <= 60) return [ts];
  const result: string[] = [];
  for (let m = startM; m < endM; m += 60) {
    result.push(`${toTime(m)}-${toTime(m + 60)}`);
  }
  return result;
}

/**
 * Compute discount amount for a coupon (PERCENT or FIXED) against a base total.
 * Percent discounts are rounded; fixed discounts never exceed the base amount.
 */
export function calculateCouponDiscount(
  coupon: { discountType: string; discountValue: number } | null,
  baseAmount: number,
): number {
  if (!coupon) return 0;
  if (coupon.discountType === 'PERCENT') {
    return Math.round((baseAmount * coupon.discountValue) / 100);
  }
  return Math.min(coupon.discountValue, baseAmount);
}

/** Points earned per booking: 1 point per 10 THB paid (floor, min 0). */
export function calculatePointsEarned(paidAmount: number): number {
  return Math.floor(Math.max(0, paidAmount) / 10);
}

/** 100 points = 10 THB. Returns THB value of redeemed points. */
export function pointsToDiscount(points: number): number {
  return Math.floor(Math.max(0, points) / 100) * 10;
}

/** Check whether a coupon (already fetched) is usable right now. */
export function isCouponUsable(coupon: {
  isActive: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
}, now: Date = new Date()): boolean {
  if (!coupon.isActive) return false;
  if (coupon.expiresAt && coupon.expiresAt < now) return false;
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return false;
  return true;
}
