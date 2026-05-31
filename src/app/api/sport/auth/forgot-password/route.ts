import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { hashToken } from '@/lib/token';
import { randomBytes } from 'crypto';
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`forgot:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป' }, { status: 429 });

  const { email: rawEmail } = await req.json();
  if (!rawEmail || typeof rawEmail !== 'string') return NextResponse.json({ error: 'กรุณากรอกอีเมล' }, { status: 400 });
  // Normalize to match how register/auth store + look up users; otherwise mixed-case
  // requests find no user and silently never receive a reset email.
  const email = rawEmail.trim().toLowerCase();

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
    data: { identifier: `reset:${email}`, token: hashToken(token), expires },
  });

  sendPasswordResetEmail(email, token).catch(() => {});
  return NextResponse.json({ ok: true });
}
