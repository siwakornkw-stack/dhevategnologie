import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, emailVerified: true, createdAt: true,
      _count: { select: { bookings: true } },
    },
  });

  const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const header = ['ID', 'ชื่อ', 'อีเมล', 'เบอร์โทร', 'Role', 'ยืนยันอีเมล', 'การจอง', 'สมัครเมื่อ'].map(escape).join(',');
  const rows = users.map((u) => [
    u.id,
    u.name ?? '',
    u.email,
    u.phone ?? '',
    u.role,
    u.emailVerified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน',
    u._count.bookings,
    new Date(u.createdAt).toLocaleDateString('th-TH'),
  ].map(escape).join(','));

  const csv = '﻿' + [header, ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
