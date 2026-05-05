import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BookingStatusBadge } from '@/components/sport/booking-status-badge';
import { SPORT_TYPE_EMOJI } from '@/lib/booking';
import { AdminBookingActions, AdminCancelAction } from './admin-booking-actions';
import { BookingSearch } from './booking-search';
import { PendingBookingsSection } from './bulk-approve';
import Link from 'next/link';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('bookings.metaTitle') };
}

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const t = await getTranslations('admin');

  const { page: pageStr, status: statusFilter, q } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));
  const skip = (page - 1) * PAGE_SIZE;

  const statusWhere = statusFilter && statusFilter !== 'ALL'
    ? { status: statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' }
    : {};

  const searchWhere = q
    ? {
        OR: [
          { user: { name: { contains: q, mode: 'insensitive' as const } } },
          { user: { email: { contains: q, mode: 'insensitive' as const } } },
          { field: { name: { contains: q, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const where = { ...statusWhere, ...searchWhere };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { select: { id: true, name: true, sportType: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pending = bookings.filter((b) => b.status === 'PENDING');
  const others = bookings.filter((b) => b.status !== 'PENDING');

  const statusOptions = [
    { value: 'ALL', label: t('bookings.statusAll') },
    { value: 'PENDING', label: t('bookings.statusPending') },
    { value: 'APPROVED', label: t('bookings.statusApproved') },
    { value: 'REJECTED', label: t('bookings.statusRejected') },
    { value: 'CANCELLED', label: t('bookings.statusCancelled') },
  ];

  const paidLabel = t('bookings.paid');
  const noPhoneLabel = t('bookings.noPhone');
  const bookedOnLabel = t('bookings.bookedOn');

  return (
    <div className="wrapper py-8 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <a href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">{t('bookings.backDashboard')}</a>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('bookings.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <BookingSearch />
          </Suspense>
          <span className="text-sm text-gray-400">{t('bookings.total', { count: total })}</span>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((opt) => (
          <Link
            key={opt.value}
            href={`/sport/admin/bookings?status=${opt.value}&page=1`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              (statusFilter ?? 'ALL') === opt.value
                ? 'bg-primary-600 text-white'
                : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <PendingBookingsSection bookings={pending} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">{t('bookings.history', { count: others.length })}</span>
        </div>
        {others.length === 0 ? (
          <div className="p-10 text-center text-gray-400">{t('bookings.empty')}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {others.map((booking) => (
              <BookingRow key={booking.id} booking={booking} showActions={booking.status === 'APPROVED'} paidLabel={paidLabel} noPhoneLabel={noPhoneLabel} bookedOnLabel={bookedOnLabel} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/sport/admin/bookings?status=${statusFilter ?? 'ALL'}&page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              {t('bookings.previous')}
            </Link>
          )}
          <span className="text-sm text-gray-500 px-3">{t('bookings.page', { page, total: totalPages })}</span>
          {page < totalPages && (
            <Link href={`/sport/admin/bookings?status=${statusFilter ?? 'ALL'}&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              {t('bookings.next')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking, showActions, paidLabel, noPhoneLabel, bookedOnLabel }: {
  booking: {
    id: string;
    date: Date;
    timeSlot: string;
    status: string;
    note: string | null;
    paidAt?: Date | null;
    createdAt: Date;
    user: { name: string | null; email: string; phone: string | null };
    field: { name: string; sportType: string };
  };
  showActions: boolean;
  paidLabel: string;
  noPhoneLabel: string;
  bookedOnLabel: string;
}) {
  return (
    <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl flex-shrink-0 mt-0.5">
        {SPORT_TYPE_EMOJI[booking.field.sportType]}
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{booking.field.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            📅 {new Date(booking.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400">⏰ {booking.timeSlot} น.</p>
          {booking.paidAt && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">{paidLabel}</span>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{booking.user.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{booking.user.email}</p>
          {booking.user.phone ? (
            <a href={`tel:${booking.user.phone}`} className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition">
              📱 {booking.user.phone}
            </a>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600 mt-1 block">{noPhoneLabel}</span>
          )}
        </div>

        <div>
          {booking.note && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1">
              💬 {booking.note}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">{bookedOnLabel} {new Date(booking.createdAt).toLocaleDateString('th-TH')}</p>
        </div>
      </div>

      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-shrink-0">
        <BookingStatusBadge status={booking.status} />
        {showActions && <AdminCancelAction bookingId={booking.id} />}
      </div>
    </div>
  );
}
