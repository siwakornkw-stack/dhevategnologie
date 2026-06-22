export function generateTimeSlots(openTime: string, closeTime: string, stepMin: number = 60): string[] {
  const slots: string[] = [];
  const [openH, openM = 0] = openTime.split(':').map(Number);
  const [closeH, closeM = 0] = closeTime.split(':').map(Number);
  const openMin = openH * 60 + openM;
  let closeMin = closeH * 60 + closeM;
  if (closeMin === openMin) return slots;
  if (closeMin < openMin) closeMin += 1440;
  if (stepMin <= 0) return slots;

  const fmt = (totalMin: number) => {
    const t = ((totalMin % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  for (let m = openMin; m < closeMin; m += stepMin) {
    const end = Math.min(m + stepMin, closeMin);
    slots.push(`${fmt(m)}-${fmt(end)}`);
  }
  return slots;
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
 * Parse a timeslot string "HH:MM-HH:MM" into minute pair [start, end].
 * Returns null on invalid input. Overnight ranges (end <= start) wrap +1440.
 */
export function parseSlotRange(ts: string): [number, number] | null {
  if (typeof ts !== 'string') return null;
  const parts = ts.split('-');
  if (parts.length !== 2) return null;
  const s = toMinutes(parts[0]);
  let e = toMinutes(parts[1]);
  if (isNaN(s) || isNaN(e) || s === e) return null;
  if (e < s) e += 1440;
  return [s, e];
}

/** Half-open interval overlap: [aStart, aEnd) ∩ [bStart, bEnd) != empty */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Detect whether any incoming slot overlaps any existing booked slot.
 * Uses minute-based half-open interval overlap, so partial 15-min slots
 * correctly conflict with hourly slots.
 */
export function hasSlotConflict(existingTimeSlots: string[], incomingTimeSlots: string[]): boolean {
  const existing = existingTimeSlots
    .map(parseSlotRange)
    .filter((r): r is [number, number] => r !== null);
  const incoming = incomingTimeSlots
    .map(parseSlotRange)
    .filter((r): r is [number, number] => r !== null);
  return incoming.some(([is, ie]) => existing.some(([es, ee]) => rangesOverlap(is, ie, es, ee)));
}

/**
 * Does a blocked-date entry close the given time slot?
 * A block with no time window (start/end null) closes the whole day. With a
 * window it closes only slots that overlap [startTime, endTime). Unparseable
 * input is treated as blocking, to fail safe.
 */
export function blockBlocksSlot(block: { startTime: string | null; endTime: string | null }, timeSlot: string): boolean {
  if (!block.startTime || !block.endTime) return true;
  const req = parseSlotRange(timeSlot);
  const blk = parseSlotRange(`${block.startTime}-${block.endTime}`);
  if (!req || !blk) return true;
  return rangesOverlap(req[0], req[1], blk[0], blk[1]);
}

/**
 * Expand a range like "08:00-10:00" into hourly slots ["08:00-09:00","09:00-10:00"].
 * A single-hour range is returned as-is.
 */
export function expandTimeSlot(ts: string): string[] {
  const [start, end] = ts.split('-');
  const startM = toMinutes(start);
  let endM = toMinutes(end);
  if (endM <= startM) endM += 1440;
  if (endM - startM <= 60) return [ts];
  const result: string[] = [];
  for (let m = startM; m < endM; m += 60) {
    const next = Math.min(m + 60, endM);
    result.push(`${toTime(m % 1440)}-${toTime(next % 1440)}`);
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

export type PriceRule = { startTime: string; endTime: string; pricePerHour: number; label?: string | null };

export function calculatePriceWithRules(
  bookingStart: string,
  bookingEnd: string,
  defaultPricePerHour: number,
  rules: PriceRule[],
): number {
  const startM = toMinutes(bookingStart);
  let endM = toMinutes(bookingEnd);
  if (endM <= startM) endM += 1440;
  if (!rules.length) return ((endM - startM) / 60) * defaultPricePerHour;
  let total = 0;
  for (let m = startM; m < endM; m += 30) {
    const seg = m % 1440;
    const rule = rules.find((r) => {
      const rStart = toMinutes(r.startTime);
      let rEnd = toMinutes(r.endTime);
      if (rEnd <= rStart) rEnd += 1440;
      const segAdj = seg < rStart ? seg + 1440 : seg;
      return segAdj >= rStart && segAdj < rEnd;
    });
    total += (rule?.pricePerHour ?? defaultPricePerHour) / 2;
  }
  return total;
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
