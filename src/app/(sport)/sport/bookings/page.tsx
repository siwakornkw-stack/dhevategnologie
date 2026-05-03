import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BookingStatusBadge } from '@/components/sport/booking-status-badge';
import { SPORT_TYPE_EMOJI, SPORT_TYPE_LABELS } from '@/lib/booking';
import { CancelBookingButton } from './cancel-booking-button';
import { DownloadReceiptButton } from '@/components/sport/download-receipt-button';
import { ReviewBookingButton } from '@/components/sport/review-booking-button';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('booking');
  return { title: t('title') };
}

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin');
  const t = await getTranslations('booking');

  const [bookings, waitingList, reviews] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: session.user.id },
      include: {
        field: { select: { id: true, name: true, sportType: true, imageUrl: true, location: true, pricePerHour: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.waitingList.findMany({
      where: { userId: session.user.id },
      include: { field: { select: { id: true, name: true, sportType: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.review.findMany({
      where: { userId: session.user.id },
      select: { fieldId: true, rating: true, comment: true },
    }),
  ]);

  const waitingListWithPosition = await Promise.all(
    waitingList.map(async (entry) => {
      const position = await prisma.waitingList.count({
        where: { fieldId: entry.fieldId, date: entry.date, timeSlot: entry.timeSlot, createdAt: { lte: entry.createdAt } },
      });
      return { ...entry, position };
    })
  );

  const reviewMap = new Map(reviews.map((r) => [r.fieldId, r]));
  const now = new Date();

  const active = bookings.filter((b) => ['PENDING', 'APPROVED'].includes(b.status));
  const past = bookings.filter((b) => ['REJECTED', 'CANCELLED'].includes(b.status));

  return (
    <div className="wrapper py-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📋 {t('title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50">
          <div className="text-6xl mb-4">🏟️</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('empty')}</h3>
          <p className="mt-2 text-gray-400 text-sm">{t('emptyHint')}</p>
          <a href="/sport" className="mt-4 inline-block gradient-btn text-white text-sm font-medium px-6 py-2.5 rounded-full">
            {t('viewAllFields')}
          </a>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                {t('activeSection', { count: active.length })}
              </h2>
              {active.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  canCancel
                  canReview={booking.status === 'APPROVED' && new Date(booking.date) < now}
                  existingReview={reviewMap.get(booking.field.id)}
                  userName={session.user.name ?? ''}
                  userEmail={session.user.email ?? ''}
                  bookedOnLabel={t('bookedOn')}
                  discountLabel={t('discount')}
                />
              ))}
            </section>
          )}

          {waitingListWithPosition.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                {t('waitingSection', { count: waitingListWithPosition.length })}
              </h2>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 divide-y divide-gray-100 dark:divide-gray-800">
                {waitingListWithPosition.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-center gap-4">
                    <span className="text-2xl">{SPORT_TYPE_EMOJI[entry.field.sportType] ?? '🏟️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{entry.field.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        📅 {entry.date.toLocaleDateString('th-TH')} · ⏰ {entry.timeSlot} น.
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium flex-shrink-0">
                      {t('inQueue')} #{entry.position}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-500 dark:text-gray-500">
                {t('historySection', { count: past.length })}
              </h2>
              {past.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  canCancel={false}
                  canReview={false}
                  existingReview={undefined}
                  userName={session.user.name ?? ''}
                  userEmail={session.user.email ?? ''}
                  bookedOnLabel={t('bookedOn')}
                  discountLabel={t('discount')}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BookingCard({ booking, canCancel, canReview, existingReview, userName, userEmail, bookedOnLabel, discountLabel }: {
  booking: {
    id: string;
    date: Date;
    timeSlot: string;
    status: string;
    note: string | null;
    couponCode: string | null;
    discountAmount: number | null;
    createdAt: Date;
    field: { id: string; name: string; sportType: string; imageUrl: string | null; location: string | null; pricePerHour: number };
  };
  canCancel: boolean;
  canReview: boolean;
  existingReview?: { rating: number; comment: string | null } | null;
  userName: string;
  userEmail: string;
  bookedOnLabel: string;
  discountLabel: string;
}) {
  const emoji = SPORT_TYPE_EMOJI[booking.field.sportType] ?? '🏟️';

  const [start, end] = booking.timeSlot.split('-');
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hours = Math.max(1, (toMin(end) - toMin(start)) / 60);
  const baseAmount = booking.field.pricePerHour * hours;
  const totalAmount = baseAmount - (booking.discountAmount ?? 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 flex gap-4">
      <div className="w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-2xl flex-shrink-0">
        {emoji}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{booking.field.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{SPORT_TYPE_LABELS[booking.field.sportType]}</p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            📅 {new Date(booking.date).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-primary-600 dark:text-primary-400 font-medium">
            ⏰ {booking.timeSlot} น.
          </span>
        </div>

        {booking.note && (
          <p className="mt-1.5 text-xs text-gray-400 italic">💬 {booking.note}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-gray-400">
            {bookedOnLabel} {new Date(booking.createdAt).toLocaleDateString('th-TH')}
            {booking.discountAmount ? ` · ${discountLabel} ฿${booking.discountAmount}` : ''}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {booking.status === 'APPROVED' && (
              <DownloadReceiptButton booking={{
                bookingId: booking.id,
                fieldName: booking.field.name,
                sportType: booking.field.sportType,
                date: booking.date.toISOString(),
                timeSlot: booking.timeSlot,
                userName,
                userEmail,
                pricePerHour: booking.field.pricePerHour,
                totalAmount,
                discountAmount: booking.discountAmount ?? 0,
                couponCode: booking.couponCode ?? undefined,
                status: booking.status,
                createdAt: booking.createdAt.toISOString(),
              }} />
            )}
            {canReview && (
              <ReviewBookingButton
                fieldId={booking.field.id}
                fieldName={booking.field.name}
                existingRating={existingReview?.rating}
                existingComment={existingReview?.comment}
              />
            )}
            {canCancel && <CancelBookingButton bookingId={booking.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
