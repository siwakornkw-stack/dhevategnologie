import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Suspense } from 'react';
import { AdminUserActions } from './admin-user-actions';
import { UserSearch } from './user-search';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('users.title') };
}

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');
  const t = await getTranslations('admin');

  const { page: pageStr, q } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));

  const where = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, emailVerified: true, createdAt: true,
        _count: { select: { bookings: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="wrapper py-8 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👥 {t('users.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <UserSearch />
          </Suspense>
          <a
            href="/api/sport/admin/users/export"
            className="px-4 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
          >
            ⬇️ Export CSV
          </a>
          <span className="text-sm text-gray-400">{t('users.total', { count: total })}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-4 py-3 text-left font-semibold">{t('users.colUser')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('users.colPhone')}</th>
                <th className="px-4 py-3 text-center font-semibold">{t('users.colBookings')}</th>
                <th className="px-4 py-3 text-center font-semibold">{t('users.colEmail')}</th>
                <th className="px-4 py-3 text-center font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">{t('users.colJoined')}</th>
                <th className="px-4 py-3 text-center font-semibold">{t('users.colManage')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">{t('users.noUsers')}</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-xs flex-shrink-0">
                        {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.name ?? '-'}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {user.phone ? (
                      <a href={`tel:${user.phone}`} className="text-green-600 dark:text-green-400 hover:underline">{user.phone}</a>
                    ) : <span className="text-gray-300 dark:text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{user._count.bookings}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.emailVerified
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t('users.emailVerified')}</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{t('users.emailUnverified')}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${user.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                      {user.role === 'ADMIN' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AdminUserActions userId={user.id} currentRole={user.role} currentUserId={session.user.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={`/sport/admin/users?page=${page - 1}${q ? `&q=${q}` : ''}`} className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              {t('users.previous')}
            </Link>
          )}
          <span className="text-sm text-gray-500 px-3">{t('users.page', { page, total: totalPages })}</span>
          {page < totalPages && (
            <Link href={`/sport/admin/users?page=${page + 1}${q ? `&q=${q}` : ''}`} className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              {t('users.next')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
