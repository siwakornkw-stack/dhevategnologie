import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'OPEN';
  const bookingId = searchParams.get('bookingId') || undefined;

  const tabs = await prisma.posTab.findMany({
    where: {
      ...(status === 'ALL'
        ? {}
        : status === 'OPEN'
          ? { OR: [{ status: 'OPEN' }, { status: 'MERGED' }] }
          : { status: status as 'OPEN' | 'MERGED' | 'CLOSED' | 'PAID' | 'VOID' }),
      ...(bookingId ? { bookingId } : {}),
    },
    include: {
      items: { where: { status: 'ACTIVE' } },
      children: {
        select: {
          id: true, name: true, teamLabel: true,
          items: { where: { status: 'ACTIVE' }, select: { id: true, productName: true, qty: true, unitPrice: true, discount: true } },
        },
      },
    },
    orderBy: { openedAt: 'desc' },
  });
  return NextResponse.json(tabs);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, code, bookingId, teamLabel, note } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  if (bookingId) {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, paidAt: true } });
    if (!b) return NextResponse.json({ error: 'booking not found' }, { status: 404 });
    if (b.paidAt) return NextResponse.json({ error: 'booking จ่ายแล้ว' }, { status: 409 });
  }
  const tab = await prisma.posTab.create({
    data: {
      name: name.trim(),
      code: code?.trim() || null,
      bookingId: bookingId || null,
      teamLabel: teamLabel?.trim() || null,
      note: note?.toString().slice(0, 500) || null,
      openedBy: session.user.id,
    },
  });
  return NextResponse.json(tab, { status: 201 });
}
