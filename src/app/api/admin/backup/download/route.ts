import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchBlobResponse } from '@/lib/backup';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Streams a private blob to the admin browser using Bearer-auth server-side fetch.
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
    const upstream = await fetchBlobResponse(pathname);
    const filename = pathname.split('/').pop() ?? 'backup.json';
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
