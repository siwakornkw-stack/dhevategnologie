'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface TimeSlotGridProps {
  slots: string[];
  bookedSlots: Record<string, string>;
  selectedSlots: string[];
  onSelect: (slot: string) => void;
  onWaitingList?: (slot: string) => void;
  waitingSlots?: string[];
  disabled?: boolean;
  duration?: 1 | 1.5;
}

export function TimeSlotGrid({ slots, bookedSlots, selectedSlots, onSelect, onWaitingList, waitingSlots = [], disabled, duration = 1 }: TimeSlotGridProps) {
  const t = useTranslations('booking');
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {slots.map((slot, idx) => {
        const status = bookedSlots[slot];
        const isBooked = !!status;
        const isApproved = status === 'APPROVED';
        const isSelected = selectedSlots.includes(slot);
        const isWaiting = waitingSlots.includes(slot);

        const nextSlot = slots[idx + 1];
        const isBlockedFor15 = duration === 1.5 && (!nextSlot || !!bookedSlots[nextSlot]);
        const isDisabled = isBooked || isBlockedFor15;

        return (
          <div key={slot} className="flex flex-col gap-1">
            <button
              onClick={() => !isDisabled && !disabled && onSelect(slot)}
              disabled={isDisabled || disabled}
              className={cn(
                'relative rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 border-2 text-center w-full',
                isSelected && !isDisabled
                  ? 'bg-primary-600 border-primary-600 text-white shadow-lg scale-105'
                  : isBooked
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                  : isBlockedFor15
                  ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer'
              )}
            >
              <div className="font-semibold">{slot.split('-')[0]}</div>
              {isBooked ? (
                <div className={cn('text-xs mt-0.5 font-normal', isApproved ? 'text-red-400' : 'text-yellow-400')}>
                  {isApproved ? t('slotBooked') : t('slotPending')}
                </div>
              ) : isBlockedFor15 ? (
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
