import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchBackup, restoreFromBackup, type BackupFile } from '@/lib/backup';
import { z } from 'zod';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const schema = z.object({
  url: z.string().url().optional(),
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
      const text = await file.text();
      dump = JSON.parse(text) as BackupFile;
      if (dump.version !== 1 || !dump.data) {
        return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 });
      }
    } else {
      const body = await req.json();
      const parsed = schema.parse(body);
      if (!parsed.url) {
        return NextResponse.json({ error: 'url required' }, { status: 400 });
      }
      dump = await fetchBackup(parsed.url);
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
