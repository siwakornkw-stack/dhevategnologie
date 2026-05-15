'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { DatePicker } from '@/components/sport/date-picker';
import { TimeSlotGrid } from '@/components/sport/time-slot-grid';
import { TimeSlotSkeleton } from '@/components/sport/skeleton';
import { generateTimeSlots, formatDateISO, calculatePriceWithRules, type PriceRule } from '@/lib/booking';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal/modal';

interface FieldBookingClientProps {
  fieldId: string;
  fieldName: string;
  pricePerHour: number;
  priceRules?: PriceRule[];
  openTime: string;
  closeTime: string;
  isLoggedIn: boolean;
  emailVerified?: boolean;
  userPhone?: string | null;
  couponSystemEnabled?: boolean;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(time: string, minutes: number): string {
  const total = toMin(time) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatDuration(hours: number): string {
  const whole = Math.floor(hours);
  if (hours % 1 === 0) return `${whole} ชม.`;
  return `${whole > 0 ? `${whole}.` : ''}30 ชม.`;
}

export function FieldBookingClient({ fieldId, fieldName, pricePerHour, priceRules = [], openTime, closeTime, isLoggedIn, emailVerified = true, userPhone, couponSystemEnabled = true }: FieldBookingClientProps) {
  const router = useRouter();
  const t = useTranslations('booking');
  const today = formatDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [duration, setDuration] = useState<1 | 1.5>(1);
  const [quantity, setQuantity] = useState(1);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string>>({});
  const [blockedDate, setBlockedDate] = useState<{ isBlocked: boolean; reason?: string | null }>({ isBlocked: false });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [currentPhone, setCurrentPhone] = useState(userPhone ?? '');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [note, setNote] = useState('');
  const [waitingSlots, setWaitingSlots] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discountType: string; discountValue: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [userPoints, setUserPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);

  const slots = generateTimeSlots(openTime, closeTime);
  const totalHours = duration * quantity;

  // Full booking range: start to start + totalHours
  const fullSlot = selectedSlot
    ? `${selectedSlot.split('-')[0]}-${addMinutesToTime(selectedSlot.split('-')[0], totalHours * 60)}`
    : null;

  // Hourly grid slots that fall within the booking range (for highlighting)
  const highlightedSlots = fullSlot
    ? slots.filter(s => {
        const sStart = toMin(s.split('-')[0]);
        const bookStart = toMin(fullSlot.split('-')[0]);
        const bookEnd = toMin(fullSlot.split('-')[1]);
        return sStart >= bookStart && sStart < bookEnd;
      })
    : [];

  // Max bookable quantity from the selected start slot
  let maxQuantity = 1;
  if (selectedSlot) {
    const startIdx = slots.indexOf(selectedSlot);
    for (let q = 2; q <= 12; q++) {
      const needed = Math.ceil((duration * q * 60) / 60);
      let valid = true;
      for (let i = 0; i < needed; i++) {
        const s = slots[startIdx + i];
        if (!s || bookedSlots[s]) { valid = false; break; }
      }
      if (valid) maxQuantity = q;
      else break;
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await fetch(`/api/sport/coupons/validate?code=${encodeURIComponent(couponCode.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoupon(data);
      toast.success(t('summary.couponApplied', { code: data.code }));
    } catch (err) {
      toast.error((err as Error).message);
      setCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      fetch('/api/sport/points').then((r) => r.json()).then((d) => setUserPoints(d.points ?? 0)).catch(() => {});
    }
  }, [isLoggedIn]);

  useEffect(() => {
    setSelectedSlot(null);
    setQuantity(1);
    setCoupon(null);
    setCouponCode('');
    setRedeemPoints(false);
    setBlockedDate({ isBlocked: false });
    setLoadingSlots(true);
    fetch(`/api/sport/fields/${fieldId}/availability?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        setBookedSlots(data.bookedSlots ?? {});
        if (data.isBlocked) setBlockedDate({ isBlocked: true, reason: data.blockedReason });
      })
      .catch(() => setBookedSlots({}))
      .finally(() => setLoadingSlots(false));
  }, [fieldId, selectedDate]);

  function handleSlotSelect(slot: string) {
    if (highlightedSlots.includes(slot)) {
      setSelectedSlot(null);
      setQuantity(1);
    } else {
      setSelectedSlot(slot);
      setQuantity(1);
    }
  }

  async function handleWaitingList(slot: string) {
    if (!isLoggedIn) { router.push('/sport/auth/signin'); return; }
    const isWaiting = waitingSlots.includes(slot);
    try {
      const res = await fetch('/api/sport/waiting-list', {
        method: isWaiting ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId, date: selectedDate, timeSlot: slot }),
      });
      if (!res.ok) throw new Error(t('cancel.apiError'));
      setWaitingSlots((prev) =>
        isWaiting ? prev.filter((s) => s !== slot) : [...prev, slot],
      );
      toast.success(isWaiting ? t('waitingLeft') : t('waitingJoined'));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function startBooking() {
    if (!fullSlot) return;
    setBooking(true);
    try {
      if (isRecurring) {
        const res = await fetch('/api/sport/bookings/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldId, startDate: selectedDate, timeSlot: fullSlot, weeks: recurringWeeks, note }),
        });
        const data = await res.json();
        if (!res.ok && data.bookings?.length === 0) throw new Error(data.errors?.join(', ') ?? t('summary.errorGeneric'));
        const msg = data.errors?.length
          ? t('summary.recurringPartial', { booked: data.bookings.length, skipped: data.errors.length })
          : t('summary.recurringSuccess', { count: data.bookings.length });
        toast.success(msg);
        setSelectedSlot(null);
        setQuantity(1);
        router.push('/sport/bookings');
      } else {
        const res = await fetch('/api/sport/bookings/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldId, date: selectedDate, timeSlots: [fullSlot], note, couponCode: coupon?.code, redeemPoints }),
        });

        let data: { url?: string; error?: string; skipPayment?: boolean } = {};
        try {
          data = await res.json();
        } catch {
          throw new Error(t('summary.errorServer'));
        }

        if (!res.ok) throw new Error(data.error ?? t('summary.errorGeneric'));

        if (data.skipPayment) {
          toast.success(t('summary.successApproval'));
          setSelectedSlot(null);
          setQuantity(1);
          router.push('/sport/bookings');
        } else if (data.url) {
          window.location.href = data.url;
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
      setBooking(false);
    }
  }

  async function handleBook() {
    if (!isLoggedIn) {
      router.push('/sport/auth/signin');
      return;
    }
    if (!currentPhone) {
      setPhoneInput('');
      setShowPhoneModal(true);
      return;
    }
    await startBooking();
  }

  async function handleSavePhone() {
    if (savingPhone) return;
    const trimmed = phoneInput.trim();
    if (!/^0[0-9]{8,9}$/.test(trimmed)) {
      toast.error('เบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)');
      return;
    }
    setSavingPhone(true);
    try {
      const res = await fetch('/api/sport/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      });
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ กรุณาลองใหม่');
      setCurrentPhone(trimmed);
      setShowPhoneModal(false);
      await startBooking();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPhone(false);
    }
  }

  const [startTime, endTime] = fullSlot ? fullSlot.split('-') : [null, null];
  const timeRange = fullSlot ? `${startTime}–${endTime}` : null;
  const basePrice = startTime && endTime
    ? calculatePriceWithRules(startTime, endTime, pricePerHour, priceRules)
    : 0;
  const couponDiscount = coupon
    ? coupon.discountType === 'PERCENT'
      ? Math.round(basePrice * coupon.discountValue / 100)
      : Math.min(coupon.discountValue, basePrice)
    : 0;
  const afterCoupon = basePrice - couponDiscount;
  const pointsDiscount = redeemPoints && userPoints >= 100
    ? Math.min(Math.floor(userPoints / 100) * 10, Math.floor(afterCoupon / 10) * 10)
    : 0;
  const discountAmount = couponDiscount + pointsDiscount;
  const totalPrice = basePrice - discountAmount;
  const hasSelection = !!selectedSlot;

  return (
    <>
    <div className="space-y-5">
      {/* Date Picker */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {t('selectDate')}
        </h2>
        <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {/* Time Slots */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('selectTime')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('selectTimeHint')}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {t('legendAvailable')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> {t('legendPending')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {t('legendBooked')}</span>
          </div>
        </div>

        {/* Duration selector */}
        <div className="flex gap-2 mb-4">
          {([1, 1.5] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setDuration(d); setSelectedSlot(null); setQuantity(1); }}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all',
                duration === d
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'
              )}
            >
              {d === 1 ? t('duration1hr') : t('duration15hr')}
            </button>
          ))}
        </div>

        {loadingSlots ? (
          <TimeSlotSkeleton />
        ) : blockedDate.isBlocked ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-center">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">สนามปิดให้บริการในวันที่เลือก</p>
            {blockedDate.reason && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{blockedDate.reason}</p>}
          </div>
        ) : (
          <TimeSlotGrid
            slots={slots}
            bookedSlots={bookedSlots}
            selectedSlots={highlightedSlots}
            onSelect={handleSlotSelect}
            onWaitingList={handleWaitingList}
            waitingSlots={waitingSlots}
            duration={duration}
            quantity={quantity}
          />
        )}

        {/* Quantity +/- control */}
        {hasSelection && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('quantityLabel')}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold text-lg flex items-center justify-center hover:border-primary-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >−</button>
              <span className="text-sm font-semibold min-w-[70px] text-center text-gray-800 dark:text-gray-200">
                {formatDuration(totalHours)}
              </span>
              <button
                onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                className="w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold text-lg flex items-center justify-center hover:border-primary-400 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >+</button>
            </div>
          </div>
        )}
      </div>

      {/* Summary & Book */}
      <div className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border p-5 transition-all duration-300',
        hasSelection
          ? 'border-primary-300 dark:border-primary-700 shadow-ring'
          : 'border-gray-200 dark:border-gray-700/50'
      )}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('summary.title')}</h2>

        {hasSelection ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('summary.fieldLabel')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{fieldName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('summary.dateLabel')}</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('summary.timeLabel')}</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {timeRange} น. ({formatDuration(totalHours)})
              </span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {t('summary.serviceFee')} <span className="text-xs">
                    ({formatDuration(totalHours)}{priceRules.length > 0 ? ' · ราคาตามช่วงเวลา' : ` × ฿${pricePerHour.toLocaleString()}`})
                  </span>
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">฿{basePrice.toLocaleString()}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    🎟️ {coupon.code}
                    <button onClick={() => { setCoupon(null); setCouponCode(''); }} className="text-xs text-gray-400 hover:text-red-400 ml-1">✕</button>
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">-฿{couponDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 font-medium">{t('summary.total')}</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">฿{totalPrice.toLocaleString()}</span>
              </div>
            </div>

            {/* Recurring option */}
            <div className="flex items-center gap-3 py-2 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{t('summary.recurring')}</span>
              </label>
              {isRecurring && (
                <select
                  value={recurringWeeks}
                  onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                  className="ml-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
                >
                  {[2,4,8,12,16,24,36,52].map((w) => <option key={w} value={w}>{t('summary.weeks', { w })}</option>)}
                </select>
              )}
            </div>

            {/* Loyalty points */}
            {isLoggedIn && userPoints >= 100 && (
              <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redeemPoints}
                    onChange={(e) => setRedeemPoints(e.target.checked)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('summary.points', { points: userPoints, discount: Math.floor(userPoints / 100) * 10 })}
                  </span>
                </label>
                {redeemPoints && (
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">-฿{pointsDiscount}</span>
                )}
              </div>
            )}

            {/* Coupon input */}
            {couponSystemEnabled && !coupon && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  placeholder={t('summary.couponPlaceholder')}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm font-mono uppercase text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {couponLoading ? '...' : t('summary.apply')}
                </button>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-1 block">{t('summary.note')}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('summary.notePlaceholder')}
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </div>

            <button
              onClick={handleBook}
              disabled={booking}
              className="w-full gradient-btn text-white font-semibold py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {booking
                ? t('summary.loading')
                : isLoggedIn
                  ? (isRecurring ? t('summary.bookRecurring') : t('summary.bookAndPay'))
                  : t('summary.loginToBook')}
            </button>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <div className="text-3xl mb-2">👆</div>
            <p className="text-sm">{t('summary.selectFirst')}</p>
            <p className="text-xs mt-1">{t('summary.selectFirstHint')}</p>
          </div>
        )}
      </div>
    </div>

    <Modal
      isOpen={showPhoneModal}
      onClose={() => { if (!savingPhone) setShowPhoneModal(false); }}
      className={{ modal: 'max-w-sm sm:w-auto p-6 sm:p-6' }}
    >
      <div className="text-center">
        <div className="text-4xl mb-2">📱</div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">กรุณาเพิ่มเบอร์โทร</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ต้องมีเบอร์โทรเพื่อยืนยันการจอง</p>
      </div>
      <div className="mt-4 space-y-3">
        <input
          type="tel"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
          placeholder="0812345678"
          maxLength={10}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 text-center text-lg tracking-widest"
          autoFocus
        />
        <button
          onClick={handleSavePhone}
          disabled={savingPhone}
          className="w-full gradient-btn text-white font-semibold py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {savingPhone ? 'กำลังบันทึก...' : 'บันทึกและจองเลย'}
        </button>
      </div>
    </Modal>
    </>
  );
}
