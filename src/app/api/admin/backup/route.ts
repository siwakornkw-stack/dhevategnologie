import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dumpDatabase } from '@/lib/backup';
import { uploadBackup, listBackups, isBackupConfigured } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isBackupConfigured()) {
    return NextResponse.json({ error: 'Backup not configured', configured: false }, { status: 200 });
  }
  try {
    const files = await listBackups();
    return NextResponse.json({ configured: true, files });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'list failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isBackupConfigured()) {
    return NextResponse.json({ error: 'Backup not configured' }, { status: 400 });
  }
  try {
    const { buffer, counts, sizeBytes } = await dumpDatabase();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${ts}.json.gz`;
    const uploaded = await uploadBackup(buffer, filename);
    prisma.auditLog
      .create({
        data: {
          adminId: session.user.id,
          action: 'BACKUP_CREATE',
          targetId: uploaded.id,
          details: { filename, sizeBytes, counts, manual: true },
        },
      })
      .catch(() => {});
    return NextResponse.json({ file: uploaded, counts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'backup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
