import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';
import { ProductsClient } from './products-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'สินค้า - POS' };

export default async function PosProductsPage() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) redirect('/sport');

  const products = await prisma.posProduct.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true, sku: true, category: true,
      price: true, cost: true, stockQty: true, stockUnit: true,
      lowStockAlert: true, imageUrl: true, isActive: true,
      stockParentId: true, unitsPerStock: true,
      stockParent: { select: { stockQty: true } },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  // Stock-variant (pack): show available stock derived from the base product.
  const initialList = products.map((p) =>
    p.stockParentId && p.unitsPerStock > 0
      ? { ...p, stockQty: Math.floor((p.stockParent?.stockQty ?? 0) / p.unitsPerStock) }
      : p,
  );

  return <ProductsClient initialList={initialList} />;
}
