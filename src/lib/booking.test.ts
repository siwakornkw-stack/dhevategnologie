import { describe, it, expect } from 'vitest';
import {
  generateTimeSlots,
  expandTimeSlot,
  calculateCouponDiscount,
  calculatePointsEarned,
  pointsToDiscount,
  isCouponUsable,
  formatDateISO,
} from './booking';

describe('generateTimeSlots', () => {
  it('produces hourly ranges between open and close', () => {
    expect(generateTimeSlots('08:00', '11:00')).toEqual([
      '08:00-09:00',
      '09:00-10:00',
      '10:00-11:00',
    ]);
  });

  it('returns empty when close <= open', () => {
    expect(generateTimeSlots('10:00', '10:00')).toEqual([]);
  });

  it('pads single-digit hours with leading zero', () => {
    expect(generateTimeSlots('08:00', '09:00')).toEqual(['08:00-09:00']);
  });
});

describe('expandTimeSlot', () => {
  it('returns single-hour slot as-is', () => {
    expect(expandTimeSlot('08:00-09:00')).toEqual(['08:00-09:00']);
  });

  it('splits multi-hour range into hourly slots', () => {
    expect(expandTimeSlot('08:00-11:00')).toEqual([
      '08:00-09:00',
      '09:00-10:00',
      '10:00-11:00',
    ]);
  });

  it('handles evening hours correctly', () => {
    expect(expandTimeSlot('20:00-22:00')).toEqual([
      '20:00-21:00',
      '21:00-22:00',
    ]);
  });
});

describe('calculateCouponDiscount', () => {
  it('returns 0 when no coupon', () => {
    expect(calculateCouponDiscount(null, 1000)).toBe(0);
  });

  it('calculates PERCENT discount with rounding', () => {
    expect(calculateCouponDiscount({ discountType: 'PERCENT', discountValue: 10 }, 1000)).toBe(100);
    expect(calculateCouponDiscount({ discountType: 'PERCENT', discountValue: 15 }, 333)).toBe(50); // round(49.95)
  });

  it('calculates FIXED discount capped at base amount', () => {
    expect(calculateCouponDiscount({ discountType: 'FIXED', discountValue: 50 }, 1000)).toBe(50);
    expect(calculateCouponDiscount({ discountType: 'FIXED', discountValue: 2000 }, 500)).toBe(500);
  });
});

describe('calculatePointsEarned', () => {
  it('awards 1 point per 10 THB floored', () => {
    expect(calculatePointsEarned(300)).toBe(30);
    expect(calculatePointsEarned(305)).toBe(30);
    expect(calculatePointsEarned(310)).toBe(31);
  });

  it('returns 0 for zero or negative amounts', () => {
    expect(calculatePointsEarned(0)).toBe(0);
    expect(calculatePointsEarned(-100)).toBe(0);
    expect(calculatePointsEarned(5)).toBe(0);
  });
});

describe('pointsToDiscount', () => {
  it('converts 100 points to 10 THB', () => {
    expect(pointsToDiscount(100)).toBe(10);
    expect(pointsToDiscount(250)).toBe(20); // floor(250/100)*10
    expect(pointsToDiscount(999)).toBe(90);
  });

  it('returns 0 for under 100 points or negative', () => {
    expect(pointsToDiscount(50)).toBe(0);
    expect(pointsToDiscount(0)).toBe(0);
    expect(pointsToDiscount(-100)).toBe(0);
  });
});

describe('isCouponUsable', () => {
  const now = new Date('2026-04-24T12:00:00Z');

  it('returns true for an active coupon with no limits', () => {
    expect(
      isCouponUsable({ isActive: true, expiresAt: null, maxUses: null, usedCount: 0 }, now),
    ).toBe(true);
  });

  it('returns false when inactive', () => {
    expect(
      isCouponUsable({ isActive: false, expiresAt: null, maxUses: null, usedCount: 0 }, now),
    ).toBe(false);
  });

  it('returns false when expired', () => {
    const expired = new Date('2026-04-01');
    expect(
      isCouponUsable({ isActive: true, expiresAt: expired, maxUses: null, usedCount: 0 }, now),
    ).toBe(false);
  });

  it('returns true when not yet expired', () => {
    const future = new Date('2026-12-31');
    expect(
      isCouponUsable({ isActive: true, expiresAt: future, maxUses: null, usedCount: 0 }, now),
    ).toBe(true);
  });

  it('returns false when usage limit reached', () => {
    expect(
      isCouponUsable({ isActive: true, expiresAt: null, maxUses: 10, usedCount: 10 }, now),
    ).toBe(false);
  });

  it('returns true with maxUses null (unlimited)', () => {
    expect(
      isCouponUsable({ isActive: true, expiresAt: null, maxUses: null, usedCount: 999 }, now),
    ).toBe(true);
  });
});

describe('formatDateISO', () => {
  it('formats UTC date to YYYY-MM-DD', () => {
    expect(formatDateISO(new Date('2026-04-24T10:30:00Z'))).toBe('2026-04-24');
  });
});
