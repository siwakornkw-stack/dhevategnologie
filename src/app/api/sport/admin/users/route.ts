import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
  const page = Math.min(1000, Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1));
  const PAGE_SIZE = 20;

  const where = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, emailVerified: true, createdAt: true,
        _count: { select: { bookings: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, role } = await req.json();
  if (!userId || !['USER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }
  if (userId === session.user.id) {
    return NextResponse.json({ error: 'ไม่สามารถแก้ไข role ตัวเองได้' }, { status: 400 });
  }

  let user;
  try {
    user = await prisma.$transaction(
      async (tx) => {
        if (role === 'USER') {
          const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
          if (!target) throw new Error('NOT_FOUND');
          if (target.role === 'ADMIN') {
            const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
            if (adminCount <= 1) throw new Error('LAST_ADMIN');
          }
        }
        return tx.user.update({
          where: { id: userId },
          data: { role },
          select: { id: true, role: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'failed';
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    if (msg === 'LAST_ADMIN') return NextResponse.json({ error: 'ไม่สามารถลด role แอดมินคนสุดท้ายได้' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  prisma.auditLog.create({
    data: { adminId: session.user.id, action: 'USER_ROLE_CHANGED', targetId: userId, details: { role } },
  }).catch(() => {});

  return NextResponse.json(user);
}
