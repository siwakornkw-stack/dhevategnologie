import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

type RowIn = { productName?: unknown; unitPrice?: unknown; qty?: unknown };

export async function GET() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const slips = await prisma.posRemovalSlip.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, tabName: true, items: true, total: true, cashierName: true, createdAt: true },
  });
  return NextResponse.json(slips);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tabId, tabName, items } = await req.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items required' }, { status: 400 });
  }

  const clean: { productName: string; unitPrice: number; qty: number }[] = [];
  for (const it of items as RowIn[]) {
    const name = String(it.productName ?? '').slice(0, 200);
    const price = Number(it.unitPrice);
    const qty = Math.floor(Number(it.qty));
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(qty) || qty < 1 || qty > 100_000) {
      return NextResponse.json({ error: 'item ไม่ถูกต้อง' }, { status: 400 });
    }
    clean.push({ productName: name, unitPrice: price, qty });
  }
  // Recompute total server-side; never trust the client figure.
  const total = +clean.reduce((a, r) => a + r.unitPrice * r.qty, 0).toFixed(2);

  const slip = await prisma.posRemovalSlip.create({
    data: {
      tabId: tabId ? String(tabId).slice(0, 50) : null,
      tabName: String(tabName ?? '').slice(0, 200),
      items: clean,
      total,
      cashierId: session.user.id,
      cashierName: session.user.name?.slice(0, 200) ?? null,
    },
  });
  return NextResponse.json({ id: slip.id }, { status: 201 });
}
