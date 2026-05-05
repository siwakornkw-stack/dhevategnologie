import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BookingStatusBadge } from '@/components/sport/booking-status-badge';
import { SPORT_TYPE_EMOJI, SPORT_TYPE_LABELS } from '@/lib/booking';
import { AddFieldForm } from './fields/add-field-form';
import { AdminFieldActions } from './fields/admin-field-actions';
import { EditFieldForm } from './fields/edit-field-form';
import { AdminAutoRefresh } from '@/components/sport/admin-auto-refresh';

export async function generateMetadata() {
  const { getTranslations } = await import('next-intl/server');
  const t = await getTranslations('admin');
  return { title: t('title') };
}

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const t = await getTranslations('admin');

  const [totalFields, totalUsers, totalBookings, pendingBookings, recentBookings, fields] =
    await Promise.all([
      prisma.field.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          field: { select: { name: true, sportType: true } },
        },
      }),
      prisma.field.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

  const stats = [
    { label: t('stats.activeFields'), value: totalFields, icon: '🏟️', color: 'from-blue-500/20 to-cyan-500/20', textColor: 'text-blue-600 dark:text-blue-400' },
    { label: t('stats.users'), value: totalUsers, icon: '👤', color: 'from-green-500/20 to-emerald-500/20', textColor: 'text-green-600 dark:text-green-400' },
    { label: t('stats.totalBookings'), value: totalBookings, icon: '📋', color: 'from-primary-500/20 to-violet-500/20', textColor: 'text-primary-600 dark:text-primary-400' },
    { label: t('stats.pending'), value: pendingBookings, icon: '⏳', color: 'from-yellow-500/20 to-orange-500/20', textColor: 'text-yellow-600 dark:text-yellow-400' },
  ];

  return (
    <div className="wrapper py-8 space-y-8 max-w-6xl">
      <AdminAutoRefresh />
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Link
            href="/sport/admin/calendar"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.calendar')}
          </Link>
          <Link
            href="/sport/admin/users"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.users')}
          </Link>
          <Link
            href="/sport/admin/waiting-list"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.waitingList')}
          </Link>
          <Link
            href="/sport/admin/coupons"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.coupons')}
          </Link>
          <Link
            href="/sport/admin/reports"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.reports')}
          </Link>
          <Link
            href="/sport/admin/chat"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.chat')}
          </Link>
          <Link
            href="/sport/admin/availability"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('tabs.availability')}
          </Link>
          <Link
            href="/sport/admin/bookings"
            className="flex-shrink-0 px-3 py-2 rounded-full bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition whitespace-nowrap"
          >
            {t('tabs.allBookings')}
          </Link>
          <Link
            href="/sport/admin/audit-logs"
            className="flex-shrink-0 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Audit Logs
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-2xl bg-gradient-to-br ${stat.color} border border-white/50 dark:border-gray-700/50 p-5`}>
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className={`text-3xl font-bold ${stat.textColor}`}>{stat.value}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Field Management */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-lg">{t('fields.title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('fields.count', { count: fields.length })}</p>
          </div>
          <AddFieldForm />
        </div>

        {fields.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">🏟️</div>
            <p className="text-gray-400">{t('fields.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {fields.map((field) => (
              <div key={field.id} className="px-4 sm:px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                {/* Sport Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-600/20 flex items-center justify-center text-2xl flex-shrink-0">
                  {SPORT_TYPE_EMOJI[field.sportType]}
                </div>

                {/* Field Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 dark:text-white">{field.name}</p>
                    {!field.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-400">{t('fields.inactive')}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {SPORT_TYPE_LABELS[field.sportType]}
                    </span>
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                      ฿{field.pricePerHour.toLocaleString()}/ชม.
                    </span>
                    <span className="text-xs text-gray-400">
                      🕐 {field.openTime}–{field.closeTime}
                    </span>
                    {field.location && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        📍 {field.location}
                      </span>
                    )}
                  </div>
                  {field.facilities && (
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 truncate max-w-sm">
                      ✨ {field.facilities}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <EditFieldForm field={field} />
                  <AdminFieldActions fieldId={field.id} fieldName={field.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white text-lg">{t('recentBookings.title')}</h2>
          <Link href="/sport/admin/bookings" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            {t('recentBookings.viewAll')}
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="p-12 text-center text-gray-400">{t('recentBookings.empty')}</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="px-4 sm:px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">
                  {SPORT_TYPE_EMOJI[booking.field.sportType]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{booking.field.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {booking.user.name} · {booking.timeSlot} น.
                  </p>
                  {booking.user.phone && (
                    <a href={`tel:${booking.user.phone}`} className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline">
                      📱 {booking.user.phone}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {new Date(booking.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                  </span>
                  <BookingStatusBadge status={booking.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
