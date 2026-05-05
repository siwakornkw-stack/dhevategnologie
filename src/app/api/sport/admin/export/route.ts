import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { SPORT_TYPE_LABELS, STATUS_LABELS } from '@/lib/booking';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');
  const sportType = searchParams.get('sportType');

  const where: Prisma.BookingWhereInput = {};

  if (from || to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
      dateFilter.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    where.date = dateFilter;
  }
  if (status && status !== 'ALL') {
    where.status = status as Prisma.EnumBookingStatusFilter;
  }
  if (sportType && sportType !== 'ALL') {
    where.field = { sportType: sportType as Prisma.EnumSportTypeFilter };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 10000,
    include: {
      user: { select: { name: true, email: true, phone: true } },
      field: { select: { name: true, sportType: true, pricePerHour: true } },
    },
  });

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

  const csvHeaders = [
    'ID',
    'ชื่อสนาม',
    'ประเภทกีฬา',
    'วันที่จอง',
    'ช่วงเวลา',
    'จำนวนชม.',
    'ชื่อลูกค้า',
    'อีเมล',
    'เบอร์โทร',
    'สถานะ',
    'ราคาเต็ม (บาท)',
    'ส่วนลด (บาท)',
    'แต้มที่ใช้',
    'ยอดสุทธิ (บาท)',
    'หมายเหตุ',
    'วันที่สร้างรายการ',
  ];

  const csvRows = bookings.map((b) => {
    const [s, e] = b.timeSlot.split('-');
    const hours = s && e ? Math.max(0, (toMin(e) - toMin(s)) / 60) : 0;
    const fullPrice = b.field.pricePerHour * hours;
    const discount = b.discountAmount ?? 0;
    const netAmount = Math.max(0, fullPrice - discount);

    return [
      b.id,
      b.field.name,
      SPORT_TYPE_LABELS[b.field.sportType] ?? b.field.sportType,
      new Date(b.date).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      b.timeSlot,
      hours.toFixed(1),
      b.user.name ?? '',
      b.user.email,
      b.user.phone ?? '',
      STATUS_LABELS[b.status] ?? b.status,
      fullPrice.toFixed(2),
      discount.toFixed(2),
      b.pointsRedeemed ?? 0,
      netAmount.toFixed(2),
      b.note ?? '',
      new Date(b.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    ];
  });

  // Prevent Excel formula injection by prefixing dangerous leading characters with a tab
  const escape = (val: string) => {
    const s = /^[=+\-@\t\r]/.test(val) ? '\t' + val : val;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csvContent = [csvHeaders, ...csvRows]
    .map((row) => row.map((cell) => escape(String(cell))).join(','))
    .join('\r\n');

  // UTF-8 BOM so Excel reads Thai characters correctly
  const csv = '﻿' + csvContent;
  const filename = `bookings-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
