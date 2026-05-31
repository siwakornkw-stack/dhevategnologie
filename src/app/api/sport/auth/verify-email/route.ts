import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from '@/lib/rate-limit';
import { hashToken } from '@/lib/token';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`verify-email:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป' }, { status: 429 });

  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const hashed = hashToken(token);
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashed, identifier: { not: { startsWith: 'reset:' } } },
  });
  if (!record) return NextResponse.json({ error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: record.identifier, token: hashed } } });
    return NextResponse.json({ error: 'Token หมดอายุแล้ว' }, { status: 400 });
  }

  await Promise.all([
    prisma.user.update({ where: { email: record.identifier }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { identifier_token: { identifier: record.identifier, token: hashed } } }),
  ]);

  return NextResponse.redirect(new URL('/sport/auth/email-verified', req.nextUrl.origin));
}
