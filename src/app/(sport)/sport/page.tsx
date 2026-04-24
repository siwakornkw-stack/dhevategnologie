import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { SearchFilter } from '@/components/sport/search-filter';
import { FieldCardSkeleton } from '@/components/sport/skeleton';
import { SPORT_TYPE_LABELS, SPORT_TYPE_EMOJI } from '@/lib/booking';
import { SportType } from '@prisma/client';
import { ViewToggle } from '@/components/sport/view-toggle';
import { getTranslations } from 'next-intl/server';

interface PageProps {
  searchParams: Promise<{ sport?: string; search?: string; minPrice?: string; maxPrice?: string }>;
}

async function FieldsList({ searchParams }: { searchParams: Awaited<PageProps['searchParams']> }) {
  const { sport, search, minPrice, maxPrice } = searchParams;

  const [fields, reviewAggs] = await Promise.all([
    prisma.field.findMany({
      where: {
        isActive: true,
        ...(sport && Object.values(SportType).includes(sport as SportType) ? { sportType: sport as SportType } : {}),
        ...(search ? { OR: [{ name: { contains: search } }, { location: { contains: search } }] } : {}),
        ...(minPrice || maxPrice
          ? { pricePerHour: { ...(minPrice ? { gte: Number(minPrice) } : {}), ...(maxPrice ? { lte: Number(maxPrice) } : {}) } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.groupBy({
      by: ['fieldId'],
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const ratingMap = new Map(reviewAggs.map((r) => [r.fieldId, { avg: r._avg.rating ?? 0, count: r._count.rating }]));

  return (
    <ViewToggle fields={fields} ratingMap={ratingMap} />
  );
}

export default async function SportHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations('sport');
  const totalFields = await prisma.field.count({ where: { isActive: true } });
  const sportCounts = await prisma.field.groupBy({
    by: ['sportType'],
    where: { isActive: true },
    _count: true,
  });

  return (
    <div className="wrapper py-8 space-y-8">
      {/* Hero */}
      <div className="text-center py-10 relative">
        <div className="absolute inset-0 hero-glow-bg opacity-30 pointer-events-none" />
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
          {t('heroHeading')}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">{t('heroHighlight')}</span>
        </h1>
        <p className="mt-3 text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
          {t('heroSubtitle')}
        </p>

        {/* Stats */}
        <div className="mt-6 flex justify-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{totalFields}</div>
            <div className="text-xs text-gray-400">{t('totalFields')}</div>
          </div>
          {sportCounts.slice(0, 3).map((s) => (
            <div key={s.sportType} className="text-center">
              <div className="text-2xl">{SPORT_TYPE_EMOJI[s.sportType]}</div>
              <div className="text-xs text-gray-400">{SPORT_TYPE_LABELS[s.sportType]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-4 shadow-theme-xs">
        <Suspense fallback={<div className="h-11 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />}>
          <SearchFilter />
        </Suspense>
      </div>

      {/* Field List */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <FieldCardSkeleton key={i} />)}
          </div>
        }
      >
        <FieldsList searchParams={params} />
      </Suspense>
    </div>
  );
}
