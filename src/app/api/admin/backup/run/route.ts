import { NextRequest, NextResponse } from 'next/server';
import { dumpDatabase } from '@/lib/backup';
import { uploadBackup, cleanupOldBackups, isBackupConfigured } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isBackupConfigured()) {
    return NextResponse.json({ error: 'Backup not configured' }, { status: 400 });
  }

  try {
    const { buffer, counts, sizeBytes } = await dumpDatabase();
    const ts = new Date().toISOString().slice(0, 10);
    const filename = `backup-${ts}-auto.json.gz`;
    const uploaded = await uploadBackup(buffer, filename);

    const retention = Number(process.env.BACKUP_RETENTION_DAYS) || 30;
    const cleaned = await cleanupOldBackups(retention);
    return NextResponse.json({ ok: true, file: uploaded, counts, sizeBytes, cleaned: cleaned.deleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'backup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
