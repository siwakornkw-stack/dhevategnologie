import { NextResponse } from 'next/server';
import { requirePosRole, getActiveShift } from '@/lib/pos';

export async function GET() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const shift = await getActiveShift(session.user.id);
  if (!shift) return NextResponse.json(null);
  return NextResponse.json(shift);
}
