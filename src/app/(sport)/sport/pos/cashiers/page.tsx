import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';
import { CashiersClient } from './cashiers-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cashiers - POS' };

export default async function PosCashiersPage() {
  const session = await requirePosRole(['ADMIN']);
  if (!session) redirect('/sport');

  const cashiers = await prisma.user.findMany({
    where: { role: 'CASHIER' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const initialList = cashiers.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
  return <CashiersClient initialList={initialList} />;
}
