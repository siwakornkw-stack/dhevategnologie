import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entryId } = await req.json().catch(() => ({}));
  if (!entryId || typeof entryId !== 'string') {
    return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });
  }

  const entry = await prisma.waitingList.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.waitingList.delete({ where: { id: entryId } });

  return NextResponse.json({ ok: true });
}
