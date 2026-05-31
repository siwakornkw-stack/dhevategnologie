import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { hashToken } from '@/lib/token';
import { randomBytes } from 'crypto';
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.emailVerified) return NextResponse.json({ error: 'อีเมลยืนยันแล้ว' }, { status: 400 });

  const ip = getClientIp(req);
  const rl = await rateLimit(`resend-verify:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป' }, { status: 429 });

  const email = session.user.email!;

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.verificationToken.create({ data: { identifier: email, token: hashToken(token), expires } });

  sendVerificationEmail(email, token).catch(() => {});

  return NextResponse.json({ ok: true });
}
