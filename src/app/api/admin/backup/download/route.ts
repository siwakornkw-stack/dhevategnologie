import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/backup';

export const dynamic = 'force-dynamic';

// Returns a signed downloadUrl for a private blob, so admin can download via browser.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const pathname = req.nextUrl.searchParams.get('pathname');
  if (!pathname || !pathname.startsWith('db-backups/')) {
    return NextResponse.json({ error: 'invalid pathname' }, { status: 400 });
  }
  try {
    const url = await getDownloadUrl(pathname);
    return NextResponse.redirect(url, 302);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
