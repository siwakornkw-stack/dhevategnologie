import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const schema = z.object({
  token: z.string().min(1, 'Token ไม่ถูกต้อง'),
  password: z.string()
    .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษร')
    .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข'),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`reset:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const { token, password } = parsed.data;

  const record = await prisma.verificationToken.findFirst({
    where: { token, identifier: { startsWith: 'reset:' } },
  });

  if (!record) return NextResponse.json({ error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { identifier: record.identifier, token } });
    return NextResponse.json({ error: 'Token หมดอายุแล้ว กรุณาขอใหม่อีกครั้ง' }, { status: 400 });
  }

  const email = record.identifier.replace('reset:', '');
  const hashed = await bcrypt.hash(password, 12);

  // Single-use guard: atomic deleteMany claims the token. If count !== 1 a concurrent
  // request already consumed it; abort so we don't reset to two different passwords.
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.verificationToken.deleteMany({ where: { identifier: record.identifier, token } });
      if (claim.count !== 1) throw new Error('TOKEN_CONSUMED');
      await tx.user.update({ where: { email }, data: { password: hashed, passwordChangedAt: new Date() } });
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'TOKEN_CONSUMED') {
      return NextResponse.json({ error: 'Token ถูกใช้ไปแล้ว' }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
