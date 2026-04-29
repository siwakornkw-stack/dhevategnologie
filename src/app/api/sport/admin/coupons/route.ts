import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bookings: true } } },
  });
  return NextResponse.json(coupons);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code, discountType, discountValue, maxUses, expiresAt } = await req.json();
  if (!code || !discountType || !discountValue) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const parsedValue = Number(discountValue);
  if (isNaN(parsedValue) || parsedValue <= 0) {
    return NextResponse.json({ error: 'ส่วนลดต้องมากกว่า 0' }, { status: 400 });
  }
  if (discountType === 'PERCENT' && parsedValue > 100) {
    return NextResponse.json({ error: 'ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100' }, { status: 400 });
  }
  if (maxUses !== undefined && maxUses !== null && Number(maxUses) < 1) {
    return NextResponse.json({ error: 'จำนวนครั้งที่ใช้ได้ต้องมากกว่า 0' }, { status: 400 });
  }
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return NextResponse.json({ error: 'วันหมดอายุต้องเป็นวันในอนาคต' }, { status: 400 });
  }

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: parsedValue,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'รหัสคูปองนี้มีอยู่แล้ว' }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, isActive } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const coupon = await prisma.coupon.update({ where: { id }, data: { isActive } });
  return NextResponse.json(coupon);
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
