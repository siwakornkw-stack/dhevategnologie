import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const PROFILE_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^0[0-9]{8,9}$/, 'เบอร์โทรไม่ถูกต้อง').optional(),
  image: z.string().url().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string()
    .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษร')
    .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข')
    .optional(),
  notifEmail: z.boolean().optional(),
  notifInApp: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, phone: true, image: true, role: true,
      createdAt: true, emailVerified: true, points: true,
      notifEmail: true, notifInApp: true,
      twoFactorEnabled: true, referralCode: true,
    },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit(`profile:${session.user.id}:${ip}`, PROFILE_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป' }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { name, phone, image, currentPassword, newPassword, notifEmail, notifInApp } = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (image !== undefined) updateData.image = image;
  if (notifEmail !== undefined) updateData.notifEmail = notifEmail;
  if (notifInApp !== undefined) updateData.notifInApp = notifInApp;

  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านปัจจุบัน' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.password) return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนรหัสผ่านสำหรับบัญชี OAuth' }, { status: 400 });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 });
    updateData.password = await bcrypt.hash(newPassword, 12);
    updateData.passwordChangedAt = new Date();
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, email: true, phone: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit(`delete-account:${session.user.id}:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป' }, { status: 429 });

  const { password } = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user.password) {
    if (!password) return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านเพื่อยืนยัน' }, { status: 400 });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 400 });
  }

  const paidActiveCount = await prisma.booking.count({
    where: { userId: session.user.id, status: { in: ['PENDING', 'APPROVED'] }, paidAt: { not: null } },
  });
  if (paidActiveCount > 0) {
    return NextResponse.json(
      { error: `กรุณายกเลิกการจองที่ชำระเงินแล้วก่อนลบบัญชี (${paidActiveCount} รายการ)` },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ ok: true });
}
