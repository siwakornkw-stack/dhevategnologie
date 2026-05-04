import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { referralCode: true, _count: { select: { referrals: true } } },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Generate code if not exists
  if (!user.referralCode) {
    let code = makeCode();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await prisma.user.findFirst({ where: { referralCode: code } });
      if (!exists) break;
      code = makeCode();
      attempts++;
    }
    user = await prisma.user.update({
      where: { id: session.user.id },
      data: { referralCode: code },
      select: { referralCode: true, _count: { select: { referrals: true } } },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({
    referralCode: user.referralCode,
    referralLink: `${baseUrl}/sport/auth/signup?ref=${user.referralCode}`,
    referralCount: user._count.referrals,
  });
}
