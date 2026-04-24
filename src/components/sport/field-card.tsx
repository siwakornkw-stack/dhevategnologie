'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { SPORT_TYPE_LABELS, SPORT_TYPE_EMOJI } from '@/lib/booking';

interface Field {
  id: string;
  name: string;
  sportType: string;
  pricePerHour: number;
  location?: string | null;
  imageUrl?: string | null;
  facilities?: string | null;
  openTime: string;
  closeTime: string;
}

interface FieldCardProps {
  field: Field;
  className?: string;
  rating?: { avg: number; count: number };
}

export function FieldCard({ field, className, rating }: FieldCardProps) {
  const t = useTranslations('fieldCard');
  const emoji = SPORT_TYPE_EMOJI[field.sportType] ?? '🏟️';
  const label = SPORT_TYPE_LABELS[field.sportType] ?? field.sportType;

  const gradients: Record<string, string> = {
    FOOTBALL: 'from-green-500/20 to-emerald-600/20',
    BASKETBALL: 'from-orange-500/20 to-amber-600/20',
    BADMINTON: 'from-blue-500/20 to-cyan-600/20',
    TENNIS: 'from-yellow-500/20 to-lime-600/20',
    VOLLEYBALL: 'from-purple-500/20 to-violet-600/20',
    SWIMMING: 'from-cyan-500/20 to-blue-600/20',
    OTHER: 'from-primary-500/20 to-primary-600/20',
  };

  const gradient = gradients[field.sportType] ?? gradients.OTHER;

  return (
    <Link href={`/sport/fields/${encodeURIComponent(field.id)}`} className={cn('group block', className)}>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900 overflow-hidden shadow-theme-xs hover:shadow-theme-sm transition-all duration-300 hover:-translate-y-1">
        {/* Image / Gradient Header */}
        <div className={cn('relative h-44 bg-gradient-to-br', gradient, 'flex items-center justify-center overflow-hidden')}>
          {field.imageUrl ? (
            <img src={field.imageUrl} alt={field.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl select-none">{emoji}</span>
          )}
          <div className="absolute top-3 left-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 backdrop-blur-sm border border-white/30">
              {emoji} {label}
            </span>
          </div>
          {rating && rating.count > 0 && (
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-400/90 text-yellow-900 backdrop-blur-sm flex items-center gap-1">
                ★ {rating.avg.toFixed(1)}
                <span className="text-yellow-800 font-normal">({rating.count})</span>
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {field.name}
          </h3>

          {field.location && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span>📍</span> {field.location}
            </p>
          )}

          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            🕐 {field.openTime} – {field.closeTime} น.
          </p>

          {field.facilities && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
              ✨ {field.facilities}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                ฿{field.pricePerHour.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500 ml-1">{t('perHour')}</span>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
              {t('bookNow')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
