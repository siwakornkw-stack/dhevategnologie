import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { masterId, childIds } = await req.json();
  if (!masterId || !Array.isArray(childIds) || childIds.length === 0) {
    return NextResponse.json({ error: 'masterId + childIds[] required' }, { status: 400 });
  }
  if (childIds.includes(masterId)) {
    return NextResponse.json({ error: 'masterId ห้ามอยู่ใน childIds' }, { status: 400 });
  }

  const isAdmin = session.user.role === 'ADMIN';

  try {
    await prisma.$transaction(async (tx) => {
      const master = await tx.posTab.findUnique({
        where: { id: masterId },
        select: { status: true, openedBy: true },
      });
      if (!master) throw new Error('MASTER_NOT_FOUND');
      if (master.status !== 'OPEN') throw new Error('MASTER_NOT_OPEN');
      if (!isAdmin && master.openedBy !== session.user.id) throw new Error('MASTER_FORBIDDEN');

      const children = await tx.posTab.findMany({ where: { id: { in: childIds } } });
      if (children.length !== childIds.length) throw new Error('CHILD_NOT_FOUND');
      for (const c of children) {
        if (c.status !== 'OPEN') throw new Error('CHILD_NOT_OPEN');
        if (c.parentTabId) throw new Error('ALREADY_MERGED');
        if (!isAdmin && c.openedBy !== session.user.id) throw new Error('CHILD_FORBIDDEN');
      }
      // Reject merging a tab that is itself a master of other tabs: checkout only walks
      // one level (master.children), so its grandchildren would be dropped from the bill.
      const childIsParent = await tx.posTab.findFirst({
        where: { parentTabId: { in: childIds } },
        select: { id: true },
      });
      if (childIsParent) throw new Error('NESTED_MERGE');
      await tx.posTab.updateMany({
        where: { id: { in: childIds } },
        data: { status: 'MERGED', parentTabId: masterId },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'merge failed';
    if (msg === 'MASTER_FORBIDDEN' || msg === 'CHILD_FORBIDDEN') {
      return NextResponse.json({ error: 'ไม่ใช่ tab ของคุณ' }, { status: 403 });
    }
    if (msg === 'NESTED_MERGE') {
      return NextResponse.json({ error: 'ไม่สามารถรวม tab ที่ถูกใช้เป็น master อยู่แล้ว' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
