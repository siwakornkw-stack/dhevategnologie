import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, twoFactorSecret: true, email: true },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user.twoFactorEnabled) {
    return NextResponse.json({ enabled: true });
  }

  // Generate new secret
  const secret = generateSecret();
  // generateURI expects 'label' not 'accountName' in this version
  const otpauth = generateURI({ label: user.email!, issuer: '88ARENA', secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: secret },
  });

  return NextResponse.json({ enabled: false, secret, qrDataUrl });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code, action } = await req.json();

  if (!code || typeof code !== 'string' || code.length < 4 || code.length > 10) {
    return NextResponse.json({ error: 'รหัส 2FA ไม่ถูกต้อง' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorSecret) return NextResponse.json({ error: 'ไม่พบ secret' }, { status: 400 });

  const valid = verifySync({ token: code, secret: user.twoFactorSecret });
  if (!valid) return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 400 });

  if (action === 'disable') {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return NextResponse.json({ ok: true, enabled: false });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: true },
  });

  return NextResponse.json({ ok: true, enabled: true });
}
