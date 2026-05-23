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

  try {
    await prisma.$transaction(async (tx) => {
      const master = await tx.posTab.findUnique({ where: { id: masterId }, select: { status: true } });
      if (!master) throw new Error('MASTER_NOT_FOUND');
      if (master.status !== 'OPEN') throw new Error('MASTER_NOT_OPEN');

      const children = await tx.posTab.findMany({ where: { id: { in: childIds } } });
      if (children.length !== childIds.length) throw new Error('CHILD_NOT_FOUND');
      for (const c of children) {
        if (c.status !== 'OPEN') throw new Error('CHILD_NOT_OPEN');
        if (c.parentTabId) throw new Error('ALREADY_MERGED');
      }
      await tx.posTab.updateMany({
        where: { id: { in: childIds } },
        data: { status: 'MERGED', parentTabId: masterId },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'merge failed';
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
