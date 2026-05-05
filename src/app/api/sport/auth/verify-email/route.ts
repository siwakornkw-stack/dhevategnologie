import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const record = await prisma.verificationToken.findFirst({
    where: { token, identifier: { not: { startsWith: 'reset:' } } },
  });
  if (!record) return NextResponse.json({ error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 });
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: record.identifier, token } } });
    return NextResponse.json({ error: 'Token หมดอายุแล้ว' }, { status: 400 });
  }

  await Promise.all([
    prisma.user.update({ where: { email: record.identifier }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { identifier_token: { identifier: record.identifier, token } } }),
  ]);

  return NextResponse.redirect(new URL('/sport/auth/email-verified', req.nextUrl.origin));
}
