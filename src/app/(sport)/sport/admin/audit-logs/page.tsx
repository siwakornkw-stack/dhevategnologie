import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const metadata = { title: 'Audit Logs - Admin' };

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  FIELD_CREATED: 'สร้างสนาม',
  FIELD_UPDATED: 'แก้ไขสนาม',
  FIELD_DELETED: 'ลบสนาม',
  COUPON_CREATED: 'สร้างคูปอง',
  COUPON_UPDATED: 'แก้ไขคูปอง',
  COUPON_DELETED: 'ลบคูปอง',
  BOOKINGS_APPROVED: 'อนุมัติการจอง (bulk)',
  BOOKINGS_REJECTED: 'ปฏิเสธการจอง (bulk)',
  REFERRAL_BONUS_AWARDED: 'มอบโบนัสแนะนำเพื่อน',
  BOOKINGS_EXPORTED: 'ส่งออกข้อมูลการจอง',
  USERS_EXPORTED: 'ส่งออกข้อมูลผู้ใช้',
  USER_ROLE_CHANGED: 'เปลี่ยน Role ผู้ใช้',
};

const ACTION_COLORS: Record<string, string> = {
  FIELD_CREATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FIELD_UPDATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FIELD_DELETED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  COUPON_CREATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  COUPON_UPDATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COUPON_DELETED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  BOOKINGS_APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  BOOKINGS_REJECTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  REFERRAL_BONUS_AWARDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BOOKINGS_EXPORTED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  USERS_EXPORTED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  USER_ROLE_CHANGED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

interface PageProps {
  searchParams: Promise<{ page?: string; action?: string }>;
}

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const { page: pageStr, action: actionFilter } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where = actionFilter && actionFilter !== 'ALL' ? { action: actionFilter } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: {
        admin: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const actionTypes = Object.keys(ACTION_LABELS);

  return (
    <div className="wrapper py-8 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        </div>
        <span className="text-sm text-gray-400">{total} รายการ</span>
      </div>

      {/* Action filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/sport/admin/audit-logs?action=ALL&page=1"
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            !actionFilter || actionFilter === 'ALL'
              ? 'bg-primary-600 text-white'
              : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          ทั้งหมด
        </Link>
        {actionTypes.map((action) => (
          <Link
            key={action}
            href={`/sport/admin/audit-logs?action=${action}&page=1`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              actionFilter === action
                ? 'bg-primary-600 text-white'
                : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {ACTION_LABELS[action]}
          </Link>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">ไม่พบข้อมูล</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-shrink-0 pt-0.5">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.admin.name ?? log.admin.email}
                  </p>
                  {log.targetId && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Target ID: <code className="font-mono text-xs">{log.targetId}</code>
                    </p>
                  )}
                  {log.details && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono truncate max-w-lg">
                      {JSON.stringify(log.details)}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(log.createdAt).toLocaleString('th-TH', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/sport/admin/audit-logs?action=${actionFilter ?? 'ALL'}&page=${page - 1}`}
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              ก่อนหน้า
            </Link>
          )}
          <span className="text-sm text-gray-500 px-3">หน้า {page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/sport/admin/audit-logs?action=${actionFilter ?? 'ALL'}&page=${page + 1}`}
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              ถัดไป
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
