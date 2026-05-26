import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, audit } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true, points: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
  const emailIn = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 100) : '';

  if (!phone && !emailIn) {
    return NextResponse.json({ error: 'ต้องมี phone หรือ email อย่างน้อย 1 อย่าง' }, { status: 400 });
  }
  if (emailIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailIn)) {
    return NextResponse.json({ error: 'email format ไม่ถูกต้อง' }, { status: 400 });
  }

  if (phone) {
    const existing = await prisma.user.findFirst({
      where: { phone },
      select: { id: true, name: true, email: true, phone: true, points: true },
    });
    if (existing) return NextResponse.json({ ...existing, _existing: true });
  }
  if (emailIn) {
    const existing = await prisma.user.findUnique({
      where: { email: emailIn },
      select: { id: true, name: true, email: true, phone: true, points: true },
    });
    if (existing) return NextResponse.json({ ...existing, _existing: true });
  }

  const email = emailIn || `walkin+${phone}-${Date.now()}@88arena.local`;
  try {
    const created = await prisma.user.create({
      data: { name: name || null, phone: phone || null, email, role: 'USER' },
      select: { id: true, name: true, email: true, phone: true, points: true },
    });
    audit(session.user.id, 'POS_CUSTOMER_CREATE', created.id, { name, phone, viaEmail: !!emailIn });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'create failed';
    if (msg.includes('Unique')) return NextResponse.json({ error: 'มีลูกค้านี้แล้ว' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
