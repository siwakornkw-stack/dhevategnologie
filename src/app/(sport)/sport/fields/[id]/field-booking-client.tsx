'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { DatePicker } from '@/components/sport/date-picker';
import { TimeSlotGrid } from '@/components/sport/time-slot-grid';
import { TimeSlotSkeleton } from '@/components/sport/skeleton';
import { generateTimeSlots, formatDateISO } from '@/lib/booking';
import { cn } from '@/lib/utils';

interface FieldBookingClientProps {
  fieldId: string;
  fieldName: string;
  pricePerHour: number;
  openTime: string;
  closeTime: string;
  isLoggedIn: boolean;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function FieldBookingClient({ fieldId, fieldName, pricePerHour, openTime, closeTime, isLoggedIn }: FieldBookingClientProps) {
  const router = useRouter();
  const t = useTranslations('booking');
  const today = formatDateISO(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [duration, setDuration] = useState<1 | 1.5>(1);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
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

  // Full booked slot range derived from selected start + chosen duration
  const fullSlot = selectedSlot
    ? `${selectedSlot.split('-')[0]}-${addMinutesToTime(selectedSlot.split('-')[0], duration * 60)}`
    : null;

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
    setCoupon(null);
    setCouponCode('');
    setRedeemPoints(false);
    setLoadingSlots(true);
    fetch(`/api/sport/fields/${fieldId}/availability?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setBookedSlots(data.bookedSlots ?? {}))
      .catch(() => setBookedSlots({}))
      .finally(() => setLoadingSlots(false));
  }, [fieldId, selectedDate]);

  function handleSlotSelect(slot: string) {
    setSelectedSlot((prev) => (prev === slot ? null : slot));
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

  async function handleBook() {
    if (!isLoggedIn) {
      router.push('/sport/auth/signin');
      return;
    }
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

  const [startTime, endTime] = fullSlot ? fullSlot.split('-') : [null, null];
  const timeRange = fullSlot ? `${startTime}–${endTime}` : null;
  const basePrice = pricePerHour * duration;
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
              onClick={() => { setDuration(d); setSelectedSlot(null); }}
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
        ) : (
          <TimeSlotGrid
            slots={slots}
            bookedSlots={bookedSlots}
            selectedSlots={selectedSlot ? [selectedSlot] : []}
            onSelect={handleSlotSelect}
            onWaitingList={handleWaitingList}
            waitingSlots={waitingSlots}
            duration={duration}
          />
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
                {timeRange} น. ({duration === 1 ? t('duration1hr') : t('duration15hr')})
              </span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  {t('summary.serviceFee')} <span className="text-xs">({duration === 1 ? '1' : '1.5'} × ฿{pricePerHour.toLocaleString()})</span>
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">฿{basePrice.toLocaleString()}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    🎟️ {coupon.code}
                    <button onClick={() => { setCoupon(null); setCouponCode(''); }} className="text-xs text-gray-400 hover:text-red-400 ml-1">✕</button>
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">-฿{discountAmount.toLocaleString()}</span>
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
            {!coupon && (
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
  );
}
