import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');

  if (all === 'true' && session.user.role === 'ADMIN') {
    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10);
    const page = Math.min(1000, Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1));
    const PAGE_SIZE = 100;
    const status = searchParams.get('status');
    const fieldId = searchParams.get('fieldId');
    const where: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; fieldId?: string } = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    }
    if (fieldId) where.fieldId = fieldId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          field: { select: { id: true, name: true, sportType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.booking.count({ where }),
    ]);
    return NextResponse.json({ bookings, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
  }

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      field: { select: { id: true, name: true, sportType: true, imageUrl: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(bookings);
}
