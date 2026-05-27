import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchBackupByPathname, restoreFromBackup, type BackupFile } from '@/lib/backup';
import { z } from 'zod';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const schema = z.object({
  pathname: z.string().optional(),
  confirm: z.literal('RESTORE'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let dump: BackupFile;
  const contentType = req.headers.get('content-type') ?? '';

  try {
    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData();
      if (form.get('confirm') !== 'RESTORE') {
        return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
      }
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      // Cap upload at 100 MB to prevent memory exhaustion via huge JSON
      const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
      if (file.size > MAX_BACKUP_BYTES) {
        return NextResponse.json({ error: 'Backup file too large (max 100 MB)' }, { status: 413 });
      }
      const text = await file.text();
      dump = JSON.parse(text) as BackupFile;
      if (dump.version !== 1 || !dump.data) {
        return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      const parsed = schema.parse(body);
      // Reject path-segment escapes even though Blob keys are not filesystem paths,
      // to keep the allowlist tight against future provider changes.
      if (!parsed.pathname || !parsed.pathname.startsWith('db-backups/') || parsed.pathname.includes('..')) {
        return NextResponse.json({ error: 'invalid pathname' }, { status: 400 });
      }
      dump = await fetchBackupByPathname(parsed.pathname);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Parse error';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const res = await restoreFromBackup(dump);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Restore failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
