import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, audit } from '@/lib/pos';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const r = await prisma.posTab.updateMany({
    where: { id, status: 'OPEN' },
    data: { status: 'HELD' },
  });
  if (r.count !== 1) return NextResponse.json({ error: 'tab not open' }, { status: 409 });
  audit(session.user.id, 'POS_TAB_HOLD', id);
  return NextResponse.json({ ok: true });
}
