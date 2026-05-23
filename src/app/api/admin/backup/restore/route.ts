import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dumpDatabase, parseBackup, restoreDatabase } from '@/lib/backup';
import { downloadBackup, uploadBackup, isBackupConfigured } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isBackupConfigured()) {
    return NextResponse.json({ error: 'Backup not configured' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { backupId, confirm } = body as { backupId?: string; confirm?: string };
  if (!backupId) return NextResponse.json({ error: 'backupId required' }, { status: 400 });
  if (confirm !== 'RESTORE') {
    return NextResponse.json({ error: 'Must confirm with "RESTORE"' }, { status: 400 });
  }

  // Step 1: download + parse FIRST (fail fast before touching DB)
  let parsed;
  try {
    const buf = await downloadBackup(backupId);
    parsed = parseBackup(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'parse failed';
    return NextResponse.json({ error: `Backup invalid: ${msg}` }, { status: 400 });
  }

  // Step 2: pre-restore safety snapshot (so user can rollback if regret)
  let preRestoreFileId: string | null = null;
  try {
    const dump = await dumpDatabase();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pre-restore-${ts}.json.gz`;
    const uploaded = await uploadBackup(dump.buffer, filename);
    preRestoreFileId = uploaded.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'pre-snapshot failed';
    return NextResponse.json(
      { error: `Pre-restore safety snapshot failed (DB untouched): ${msg}` },
      { status: 500 },
    );
  }

  // Step 3: restore in transaction (atomic — rollback on any error)
  try {
    const result = await restoreDatabase(parsed);
    await prisma.auditLog
      .create({
        data: {
          adminId: session.user.id,
          action: 'BACKUP_RESTORE',
          targetId: backupId,
          details: {
            backupId,
            preRestoreFileId,
            backupCreatedAt: parsed.createdAt,
            inserted: result.inserted,
          },
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      preRestoreFileId,
      inserted: result.inserted,
      backupCreatedAt: parsed.createdAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'restore failed';
    return NextResponse.json(
      {
        error: `Restore failed (data rolled back to pre-restore state automatically): ${msg}`,
        preRestoreFileId,
      },
      { status: 500 },
    );
  }
}
