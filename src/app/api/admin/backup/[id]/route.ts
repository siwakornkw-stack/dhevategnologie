import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { downloadBackup, deleteBackup } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const buf = await downloadBackup(id);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="backup-${id}.json.gz"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'download failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  try {
    await deleteBackup(id);
    prisma.auditLog
      .create({ data: { adminId: session.user.id, action: 'BACKUP_DELETE', targetId: id } })
      .catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
