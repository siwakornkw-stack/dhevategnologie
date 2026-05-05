import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') ?? '';
  const page = Math.min(1000, Math.max(1, parseInt(searchParams.get('page') ?? '1', 10)));
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

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, role: true },
  });

  prisma.auditLog.create({
    data: { adminId: session.user.id, action: 'USER_ROLE_CHANGED', targetId: userId, details: { role } },
  }).catch(() => {});

  return NextResponse.json(user);
}
