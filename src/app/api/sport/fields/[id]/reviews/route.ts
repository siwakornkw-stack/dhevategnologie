import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { rateLimit, REVIEW_RATE_LIMIT } from '@/lib/rate-limit';

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: fieldId } = await params;
  const reviews = await prisma.review.findMany({
    where: { fieldId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, image: true } } },
  });
  return NextResponse.json(reviews);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = rateLimit(`review:${session.user.id}`, REVIEW_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งรีวิวบ่อยเกินไป กรุณารอสักครู่' }, { status: 429 });

  const { id: fieldId } = await params;

  const hasApprovedBooking = await prisma.booking.findFirst({
    where: { fieldId, userId: session.user.id, status: 'APPROVED' },
  });
  if (!hasApprovedBooking) {
    return NextResponse.json({ error: 'ต้องเคยจองสนามนี้ก่อนถึงจะรีวิวได้' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const review = await prisma.review.upsert({
    where: { userId_fieldId: { userId: session.user.id, fieldId } },
    create: { userId: session.user.id, fieldId, ...parsed.data },
    update: parsed.data,
    include: { user: { select: { name: true, image: true } } },
  });

  return NextResponse.json(review);
}
