import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';
import { SaleClient } from './sale-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ขายหน้าร้าน - POS' };

export default async function SalePage() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) redirect('/sport');

  const [products, tabs] = await Promise.all([
    prisma.posProduct.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true, name: true, sku: true, category: true,
        price: true, stockQty: true, stockUnit: true, imageUrl: true, isActive: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.posTab.findMany({
      where: { OR: [{ status: 'OPEN' }, { status: 'HELD' }, { status: 'MERGED' }] },
      select: {
        id: true, name: true, teamLabel: true, bookingId: true, status: true, parentTabId: true,
        items: {
          where: { status: 'ACTIVE' },
          select: { id: true, productName: true, qty: true, unitPrice: true, discount: true },
        },
        children: {
          select: {
            id: true, name: true, teamLabel: true,
            items: { where: { status: 'ACTIVE' }, select: { id: true, productName: true, qty: true, unitPrice: true, discount: true } },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    }),
  ]);

  const initialTabs = tabs.filter((t) => t.status === 'OPEN' || t.status === 'HELD');

  return <SaleClient initialProducts={products} initialTabs={initialTabs} />;
}
