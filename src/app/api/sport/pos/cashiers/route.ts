import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET() {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cashiers = await prisma.user.findMany({
    where: { role: 'CASHIER' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(cashiers);
}

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, email, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, password required' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'password ต้อง >= 8 ตัว' }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return NextResponse.json({ error: 'email ซ้ำ' }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashed,
      role: 'CASHIER',
      emailVerified: new Date(),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  prisma.auditLog
    .create({ data: { adminId: session.user.id, action: 'POS_CASHIER_CREATE', targetId: user.id, details: { email: user.email } } })
    .catch(() => {});
  return NextResponse.json(user, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role !== 'CASHIER') {
    return NextResponse.json({ error: 'ลบได้เฉพาะ CASHIER' }, { status: 400 });
  }
  await prisma.user.update({ where: { id }, data: { role: 'USER' } });
  prisma.auditLog
    .create({ data: { adminId: session.user.id, action: 'POS_CASHIER_DELETE', targetId: id } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
