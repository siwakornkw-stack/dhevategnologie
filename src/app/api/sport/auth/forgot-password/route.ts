import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import { rateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`forgot:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป' }, { status: 429 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'กรุณากรอกอีเมล' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond OK to prevent email enumeration
  if (!user || !user.password) {
    return NextResponse.json({ ok: true });
  }

  // Delete any existing reset tokens for this email
  await prisma.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } });

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await prisma.verificationToken.create({
    data: { identifier: `reset:${email}`, token, expires },
  });

  sendPasswordResetEmail(email, token).catch(() => {});
  return NextResponse.json({ ok: true });
}
