import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listBackups, deleteBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const pathname = req.nextUrl.searchParams.get('pathname');
  if (!pathname || !pathname.startsWith('db-backups/')) {
    return NextResponse.json({ error: 'invalid pathname' }, { status: 400 });
  }
  try {
    await deleteBackup(pathname);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
