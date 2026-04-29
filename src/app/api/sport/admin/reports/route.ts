import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

function parseTimeSlot(timeSlot: string): { startHour: number; hours: number } {
  const parts = timeSlot.split('-');
  if (parts.length !== 2) return { startHour: 0, hours: 1 };
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const startMin = toMin(parts[0]);
  const endMin = toMin(parts[1]);
  const hours = Math.max(0.5, (endMin - startMin) / 60);
  return { startHour: Math.floor(startMin / 60), hours: isNaN(hours) ? 1 : hours };
}

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

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

  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (from || to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) { fromDate = new Date(from); dateFilter.gte = fromDate; }
    if (to) {
      toDate = new Date(to);
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
    include: {
      user: { select: { name: true, email: true, phone: true } },
      field: { select: { name: true, sportType: true, pricePerHour: true } },
    },
  });

  const byStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
  let totalRevenue = 0;
  let cancelledRevenue = 0;

  const bySportTypeMap: Record<string, { count: number; revenue: number }> = {};
  const byFieldMap: Record<string, { name: string; sportType: string; count: number; revenue: number; approved: number }> = {};
  const byHourMap: Record<number, number> = {};
  const byDayMap: Record<number, { count: number; revenue: number }> = {};
  const heatmapMap: Record<string, number> = {}; // "dow-hour" → count

  for (const b of bookings) {
    byStatus[b.status as keyof typeof byStatus]++;

    const { startHour, hours } = parseTimeSlot(b.timeSlot);
    const revenue = Math.max(0, b.field.pricePerHour * hours - (b.discountAmount ?? 0));

    if (b.status === 'APPROVED') totalRevenue += revenue;
    if (b.status === 'CANCELLED') cancelledRevenue += revenue;

    const st = b.field.sportType;
    if (!bySportTypeMap[st]) bySportTypeMap[st] = { count: 0, revenue: 0 };
    bySportTypeMap[st].count++;
    if (b.status === 'APPROVED') bySportTypeMap[st].revenue += revenue;

    const fKey = b.fieldId;
    if (!byFieldMap[fKey]) byFieldMap[fKey] = { name: b.field.name, sportType: b.field.sportType, count: 0, revenue: 0, approved: 0 };
    byFieldMap[fKey].count++;
    if (b.status === 'APPROVED') { byFieldMap[fKey].revenue += revenue; byFieldMap[fKey].approved++; }

    for (let h = startHour; h < startHour + hours; h++) {
      byHourMap[h] = (byHourMap[h] ?? 0) + 1;
    }

    const dow = new Date(b.date).getDay();
    if (!byDayMap[dow]) byDayMap[dow] = { count: 0, revenue: 0 };
    byDayMap[dow].count++;
    if (b.status === 'APPROVED') byDayMap[dow].revenue += revenue;

    // Day × Hour heatmap (count each hour of the slot)
    for (let h = startHour; h < startHour + hours; h++) {
      const key = `${dow}-${h}`;
      heatmapMap[key] = (heatmapMap[key] ?? 0) + 1;
    }
  }

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: byHourMap[h] ?? 0 }));

  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
    day: DAY_NAMES[i],
    count: byDayMap[i]?.count ?? 0,
    revenue: byDayMap[i]?.revenue ?? 0,
  }));

  // Day × Hour heatmap: flat array of {day, hour, count}
  const heatmap = Object.entries(heatmapMap).map(([key, count]) => {
    const [day, hour] = key.split('-').map(Number);
    return { day, hour, count };
  });

  // Revenue trend per field (top 5 by revenue)
  const topFieldIds = Object.entries(byFieldMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([id]) => id);

  const fieldDailyMap: Record<string, Record<string, number>> = {};
  for (const b of bookings) {
    if (b.status !== 'APPROVED' || !topFieldIds.includes(b.fieldId)) continue;
    const day = b.date.toISOString().split('T')[0];
    const { hours } = parseTimeSlot(b.timeSlot);
    const rev = Math.max(0, b.field.pricePerHour * hours - (b.discountAmount ?? 0));
    if (!fieldDailyMap[b.fieldId]) fieldDailyMap[b.fieldId] = {};
    fieldDailyMap[b.fieldId][day] = (fieldDailyMap[b.fieldId][day] ?? 0) + rev;
  }

  const byFieldTrend = topFieldIds.map((fid) => ({
    fieldId: fid,
    fieldName: byFieldMap[fid]?.name ?? fid,
    data: Object.entries(fieldDailyMap[fid] ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue })),
  }));

  // Occupancy rate per field
  const daysInPeriod = fromDate && toDate
    ? Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 30;

  const allFields = await prisma.field.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, sportType: true, openTime: true, closeTime: true,
      bookings: {
        where: {
          status: 'APPROVED',
          ...(fromDate || toDate ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
        },
        select: { timeSlot: true },
      },
    },
  });

  const occupancyByField = allFields.map((field) => {
    const [openH] = field.openTime.split(':').map(Number);
    const [closeH] = field.closeTime.split(':').map(Number);
    const dailySlots = Math.max(1, closeH - openH);
    const totalSlots = dailySlots * daysInPeriod;

    let hoursBooked = 0;
    for (const b of field.bookings) {
      const { hours } = parseTimeSlot(b.timeSlot);
      hoursBooked += hours;
    }

    return {
      fieldId: field.id,
      fieldName: field.name,
      sportType: field.sportType,
      occupancyRate: Math.min(100, (hoursBooked / totalSlots) * 100),
      hoursBooked,
      totalSlots,
    };
  }).sort((a, b) => b.occupancyRate - a.occupancyRate);

  return NextResponse.json({
    bookings,
    summary: { total: bookings.length, byStatus, totalRevenue, cancelledRevenue, netRevenue: totalRevenue - cancelledRevenue },
    bySportType: Object.entries(bySportTypeMap).map(([type, v]) => ({ sportType: type, ...v })),
    byField: Object.values(byFieldMap).sort((a, b) => b.count - a.count),
    byHour,
    byDayOfWeek,
    byFieldTrend,
    heatmap,
    occupancyByField,
  });
}
