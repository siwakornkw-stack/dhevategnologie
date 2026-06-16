import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, applyStock } from '@/lib/pos';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const tab = await prisma.posTab.findUnique({
    where: { id },
    include: {
      items: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } },
      children: {
        include: { items: { where: { status: 'ACTIVE' } } },
      },
    },
  });
  if (!tab) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let booking = null;
  let bookingSubtotal = 0;
  if (tab.bookingId) {
    const b = await prisma.booking.findUnique({
      where: { id: tab.bookingId },
      include: { field: { select: { name: true, pricePerHour: true, priceRules: true } }, user: { select: { name: true, phone: true } } },
    });
    if (b) {
      const { calculatePriceWithRules } = await import('@/lib/booking');
      const [start, end] = b.timeSlot.split('-');
      bookingSubtotal = calculatePriceWithRules(start, end, b.field.pricePerHour, b.field.priceRules);
      if (b.discountAmount) bookingSubtotal = Math.max(bookingSubtotal - b.discountAmount, 0);
      booking = b;
    }
  }
  return NextResponse.json({ ...tab, booking, bookingSubtotal });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.teamLabel !== undefined) data.teamLabel = body.teamLabel?.trim() || null;
  if (body.note !== undefined) data.note = body.note?.toString().slice(0, 500) || null;
  if (body.bookingId !== undefined) {
    if (body.bookingId) {
      const b = await prisma.booking.findUnique({ where: { id: body.bookingId }, select: { id: true, paidAt: true } });
      if (!b) return NextResponse.json({ error: 'booking not found' }, { status: 404 });
      if (b.paidAt) return NextResponse.json({ error: 'booking จ่ายแล้ว' }, { status: 409 });
      data.bookingId = body.bookingId;
    } else {
      // Unlinking booking — also clear teamLabel (set during booking link) unless caller
      // explicitly sent a new teamLabel in the same PATCH.
      data.bookingId = null;
      if (body.teamLabel === undefined) data.teamLabel = null;
    }
  }

  const tab = await prisma.posTab.findUnique({ where: { id }, select: { status: true, openedBy: true } });
  if (!tab) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (tab.status !== 'OPEN') return NextResponse.json({ error: 'tab not open' }, { status: 409 });
  // Only ADMIN or the cashier who opened it can edit. Pre-migration tabs with null openedBy stay editable by any cashier.
  if (session.user.role !== 'ADMIN' && tab.openedBy && tab.openedBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.posTab.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const tab = await prisma.posTab.findUnique({
    where: { id },
    include: {
      items: { where: { status: 'ACTIVE' } },
      children: { include: { items: { where: { status: 'ACTIVE' } } } },
    },
  });
  if (!tab) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (tab.status !== 'OPEN') return NextResponse.json({ error: 'tab not open' }, { status: 409 });
  // Only ADMIN or the cashier who opened it can void. Pre-migration tabs with null openedBy stay deletable by any cashier.
  if (session.user.role !== 'ADMIN' && tab.openedBy && tab.openedBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allTabs = [tab, ...tab.children];
  await prisma.$transaction(async (tx) => {
    for (const t of allTabs) {
      for (const it of t.items) {
        await applyStock(tx, it.productId, it.qty, { type: 'VOID', refType: 'TAB_VOID', refId: t.id, note: 'tab voided', userId: session.user.id, allowNegative: true });
        await tx.posOrderItem.update({ where: { id: it.id }, data: { status: 'VOID' } });
      }
    }
    await tx.posTab.updateMany({
      where: { id: { in: allTabs.map((t) => t.id) } },
      data: { status: 'VOID', closedAt: new Date() },
    });
  });
  return NextResponse.json({ ok: true });
}
