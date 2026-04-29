import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`coupon:${session.user.id}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.success) return NextResponse.json({ error: 'ลองใหม่ภายหลัง' }, { status: 429 });

  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: 'กรุณาใส่รหัสคูปอง' }, { status: 400 });

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.isActive) {
    return NextResponse.json({ error: 'รหัสคูปองไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 404 });
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return NextResponse.json({ error: 'รหัสคูปองหมดอายุแล้ว' }, { status: 400 });
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return NextResponse.json({ error: 'คูปองนี้ถูกใช้ครบแล้ว' }, { status: 400 });
  }

  return NextResponse.json({
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
  });
}
