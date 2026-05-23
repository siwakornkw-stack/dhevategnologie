import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';
import { StockClient } from './stock-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stock - POS' };

export default async function PosStockPage() {
  const session = await requirePosRole(['ADMIN']);
  if (!session) redirect('/sport');

  const [products, movements] = await Promise.all([
    prisma.posProduct.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, stockQty: true, stockUnit: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.posStockMovement.findMany({
      include: { product: { select: { name: true, stockUnit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const initialMovements = movements.map((m) => ({
    id: m.id,
    productId: m.productId,
    type: m.type as 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'VOID',
    qty: m.qty,
    note: m.note,
    createdAt: m.createdAt.toISOString(),
    product: m.product,
  }));

  return <StockClient initialProducts={products} initialMovements={initialMovements} />;
}
