import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createBackup } from '@/lib/backup';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const res = await createBackup();
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
