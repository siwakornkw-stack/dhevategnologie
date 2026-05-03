'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function addMin(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Find the status of the first booking that overlaps with a slot (interval overlap, not exact key match)
function getSlotStatus(slot: string, bookedSlots: Record<string, string>): string | undefined {
  const [s, e] = slot.split('-');
  const slotStart = toMin(s);
  const slotEnd = toMin(e);
  const matchKey = Object.keys(bookedSlots).find((key) => {
    const [ks, ke] = key.split('-');
    return slotStart < toMin(ke) && slotEnd > toMin(ks);
  });
  return matchKey ? bookedSlots[matchKey] : undefined;
}

interface TimeSlotGridProps {
  slots: string[];
  bookedSlots: Record<string, string>;
  selectedSlots: string[];
  onSelect: (slot: string) => void;
  onWaitingList?: (slot: string) => void;
  waitingSlots?: string[];
  disabled?: boolean;
  duration?: 1 | 1.5;
  quantity?: number;
}

export function TimeSlotGrid({ slots, bookedSlots, selectedSlots, onSelect, onWaitingList, waitingSlots = [], disabled, duration = 1, quantity = 1 }: TimeSlotGridProps) {
  const t = useTranslations('booking');

  const slotsNeeded = Math.ceil(duration * quantity * 60 / 60);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {slots.map((slot, idx) => {
        const slotStatus = getSlotStatus(slot, bookedSlots);
        const isThisBooked = !!slotStatus;
        const isApproved = slotStatus === 'APPROVED';
        const isSelected = selectedSlots.includes(slot);
        const isWaiting = waitingSlots.includes(slot);

        const slotStart = slot.split('-')[0];
        const slotEnd = addMin(slotStart, duration * 60);

        let isInvalidStart = false;
        for (let i = 0; i < slotsNeeded; i++) {
          const s = slots[idx + i];
          if (!s || getSlotStatus(s, bookedSlots)) { isInvalidStart = true; break; }
        }

        const isDisabled = !isSelected && isInvalidStart;

        return (
          <div key={slot} className="flex flex-col gap-1">
            <button
              onClick={() => !isDisabled && !disabled && onSelect(slot)}
              disabled={isDisabled || disabled}
              className={cn(
                'relative rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 border-2 text-center w-full',
                isSelected
                  ? 'bg-primary-600 border-primary-600 text-white shadow-lg scale-105'
                  : isThisBooked
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                  : isInvalidStart
                  ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer'
              )}
            >
              <div className="font-semibold">{slotStart}</div>
              <div className="text-xs font-normal opacity-60">–{slotEnd}</div>
              {isThisBooked ? (
                <div className={cn('text-xs mt-0.5 font-normal', isApproved ? 'text-red-400' : 'text-yellow-400')}>
                  {isApproved ? t('slotBooked') : t('slotPending')}
                </div>
              ) : isInvalidStart && !isSelected ? (
                <div className="text-xs mt-0.5 font-normal text-gray-400">{t('slotUnavailable')}</div>
              ) : (
                <div className="text-xs mt-0.5 font-normal text-green-500">{t('slotAvailable')}</div>
              )}
            </button>

            {isApproved && onWaitingList && (
              <button
                onClick={() => onWaitingList(slot)}
                className={cn(
                  'text-xs py-1 px-2 rounded-lg transition font-medium w-full',
                  isWaiting
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {isWaiting ? t('inWaiting') : t('joinWaiting')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
