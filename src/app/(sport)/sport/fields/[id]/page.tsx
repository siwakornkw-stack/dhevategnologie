import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { FieldBookingClient } from './field-booking-client';
import { FieldReviews } from '@/components/sport/field-reviews';
import { SPORT_TYPE_LABELS, SPORT_TYPE_EMOJI } from '@/lib/booking';
import { ShareButton } from '@/components/sport/share-button';
import { getTranslations } from 'next-intl/server';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const [field, t] = await Promise.all([
    prisma.field.findFirst({ where: { id: decodeURIComponent(id) } }),
    getTranslations('field'),
  ]);
  return { title: field?.name ?? t('fallbackTitle') };
}

export default async function FieldDetailPage({ params }: PageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const [field, session, t] = await Promise.all([
    prisma.field.findFirst({ where: { id: decodedId, isActive: true } }),
    auth(),
    getTranslations('field'),
  ]);

  if (!field) notFound();

  const emoji = SPORT_TYPE_EMOJI[field.sportType] ?? '🏟️';
  const sportLabel = SPORT_TYPE_LABELS[field.sportType] ?? field.sportType;

  return (
    <div className="wrapper py-8 max-w-5xl">
      {/* Back */}
      <div className="flex items-center justify-between mb-6">
        <a href="/sport" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          {t('backToHome')}
        </a>
        <ShareButton title={`${field.name} - 88ARENA`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Field Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Image */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700/50 aspect-video bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center">
            {field.imageUrl ? (
              <img src={field.imageUrl} alt={field.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-8xl">{emoji}</span>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 space-y-4">
            <div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">
                {emoji} {sportLabel}
              </span>
              <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{field.name}</h1>
              {field.location && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-sm text-gray-500 dark:text-gray-400">📍 {field.location}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                  >
                    {t('viewMap')}
                  </a>
                </div>
              )}
            </div>

            {field.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{field.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-400">{t('price')}</p>
                <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  ฿{field.pricePerHour.toLocaleString()}
                  <span className="text-sm font-normal text-gray-400">/ชม.</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('openHours')}</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {field.openTime} – {field.closeTime} น.
                </p>
              </div>
            </div>

            {field.facilities && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 mb-1">{t('facilities')}</p>
                <div className="flex flex-wrap gap-2">
                  {field.facilities.split(',').map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {f.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Booking Panel */}
        <div className="lg:col-span-3 space-y-8">
          <FieldBookingClient
            fieldId={field.id}
            fieldName={field.name}
            pricePerHour={field.pricePerHour}
            openTime={field.openTime}
            closeTime={field.closeTime}
            isLoggedIn={!!session}
          />
          <FieldReviews fieldId={field.id} />
        </div>
      </div>
    </div>
  );
}
