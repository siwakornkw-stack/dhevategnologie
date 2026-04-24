import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
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
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: record.identifier, token } } });
    return NextResponse.json({ error: 'Token หมดอายุแล้ว กรุณาขอใหม่อีกครั้ง' }, { status: 400 });
  }

  const email = record.identifier.replace('reset:', '');
  const hashed = await bcrypt.hash(password, 12);

  await Promise.all([
    prisma.user.update({ where: { email }, data: { password: hashed } }),
    prisma.verificationToken.delete({ where: { identifier_token: { identifier: record.identifier, token } } }),
  ]);

  return NextResponse.json({ ok: true });
}
