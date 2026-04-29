import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all');

  if (all === 'true' && session.user.role === 'ADMIN') {
    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { select: { id: true, name: true, sportType: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return NextResponse.json(bookings);
  }

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      field: { select: { id: true, name: true, sportType: true, imageUrl: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(bookings);
}
