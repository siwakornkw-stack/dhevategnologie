import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    stockQty: number;
    stockUnit: string;
    lowStockAlert: number;
  }>>`
    SELECT id, name, sku, category, "stockQty", "stockUnit", "lowStockAlert"
    FROM "PosProduct"
    WHERE "deletedAt" IS NULL
      AND "isActive" = true
      AND "stockParentId" IS NULL
      AND "lowStockAlert" > 0
      AND "stockQty" <= "lowStockAlert"
    ORDER BY ("stockQty"::float / NULLIF("lowStockAlert", 0)) ASC
    LIMIT 100
  `;
  return NextResponse.json(rows);
}
