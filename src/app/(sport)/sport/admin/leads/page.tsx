import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const metadata = { title: 'ลีด / คำขอเดโม' };

const PAGE_SIZE = 20;

async function toggleHandled(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') return;
  const id = String(formData.get('id'));
  const handled = formData.get('handled') === 'true';
  await prisma.lead.update({ where: { id }, data: { handled: !handled } });
  revalidatePath('/sport/admin/leads');
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));

  const [leads, total, pending] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count(),
    prisma.lead.count({ where: { handled: false } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="wrapper py-8 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">📨 ลีด / คำขอเดโม</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>ใหม่ <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{pending}</span></span>
          <span>ทั้งหมด <span className="tabular-nums">{total}</span></span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-4 py-3 text-left font-semibold">วันที่</th>
                <th className="px-4 py-3 text-left font-semibold">ชื่อ</th>
                <th className="px-4 py-3 text-left font-semibold">อีเมล</th>
                <th className="px-4 py-3 text-left font-semibold">รายละเอียด</th>
                <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leads.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">ยังไม่มีคำขอเข้ามา</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition ${lead.handled ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(lead.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    <span className="block">{new Date(lead.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{lead.firstName} {lead.lastName}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${lead.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{lead.email}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-md">
                    <span className="line-clamp-2" title={lead.message}>{lead.message}</span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <form action={toggleHandled}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="handled" value={String(lead.handled)} />
                      <button
                        type="submit"
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${lead.handled
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200'}`}
                      >
                        {lead.handled ? 'ติดต่อแล้ว ✓' : 'ทำเครื่องหมายว่าติดต่อแล้ว'}
                      </button>
                    </form>
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
            <Link href={`/sport/admin/leads?page=${page - 1}`} className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">ก่อนหน้า</Link>
          )}
          <span className="text-sm text-gray-500 px-3">หน้า {page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/sport/admin/leads?page=${page + 1}`} className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">ถัดไป</Link>
          )}
        </div>
      )}
    </div>
  );
}
