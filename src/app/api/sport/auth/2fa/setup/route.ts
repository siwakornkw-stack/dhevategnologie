import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';

function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: 8 }, () =>
    randomBytes(5).toString('hex').toUpperCase()
  );
  const hashed = plain.map((c) => createHash('sha256').update(c).digest('hex'));
  return { plain, hashed };
}

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

  // Reuse existing pending secret so re-visiting the page doesn't invalidate the QR code
  let secret = user.twoFactorSecret;
  if (!secret) {
    secret = generateSecret();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret },
    });
  }

  const otpauth = generateURI({ label: user.email!, issuer: '88ARENA', secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

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
    select: { twoFactorSecret: true, twoFactorEnabled: true, twoFactorBackupCodes: true },
  });
  if (!user?.twoFactorSecret) return NextResponse.json({ error: 'ไม่พบ secret' }, { status: 400 });

  if (action === 'useBackup') {
    const codeHash = createHash('sha256').update(code.toUpperCase()).digest('hex');
    const idx = user.twoFactorBackupCodes.indexOf(codeHash);
    if (idx === -1) return NextResponse.json({ error: 'รหัสสำรองไม่ถูกต้อง' }, { status: 400 });

    const remaining = [...user.twoFactorBackupCodes];
    remaining.splice(idx, 1);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: remaining },
    });
    return NextResponse.json({ ok: true, enabled: false });
  }

  const valid = verifySync({ token: code, secret: user.twoFactorSecret });
  if (!valid) return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 400 });

  if (action === 'disable') {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
    return NextResponse.json({ ok: true, enabled: false });
  }

  // Enable 2FA and generate fresh backup codes
  const { plain, hashed } = generateBackupCodes();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
  });

  return NextResponse.json({ ok: true, enabled: true, backupCodes: plain });
}
