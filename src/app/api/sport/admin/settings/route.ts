import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const couponSystemEnabled = (await getSetting('couponSystemEnabled', 'true')) === 'true';
  return NextResponse.json({ couponSystemEnabled });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { couponSystemEnabled } = await req.json();
  if (typeof couponSystemEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
  }

  await setSetting('couponSystemEnabled', String(couponSystemEnabled));
  return NextResponse.json({ couponSystemEnabled });
}
