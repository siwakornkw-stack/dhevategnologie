import { NextRequest, NextResponse } from 'next/server';
import { createBackup } from '@/lib/backup';
import { verifyCronSecret } from '@/lib/cron-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Daily backup. Called by Vercel Cron (see vercel.json) — protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await createBackup();
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
