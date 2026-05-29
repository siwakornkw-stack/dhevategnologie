import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBookingReminderEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Bearer header only — query-string secret leaks into proxy/CDN access logs.
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '');
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find APPROVED bookings for tomorrow (Bangkok-day, since booking.date is stored
  // as Bangkok midnight UTC). Using UTC-day would skip/double-count near midnight ICT.
  const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const bangkokNow = Date.now() + BANGKOK_OFFSET_MS;
  const bangkokTodayMidnightUtc = Math.floor(bangkokNow / 86_400_000) * 86_400_000 - BANGKOK_OFFSET_MS;
  const tomorrow = new Date(bangkokTodayMidnightUtc + 86_400_000);
  const dayAfter = new Date(bangkokTodayMidnightUtc + 2 * 86_400_000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'APPROVED',
      date: { gte: tomorrow, lt: dayAfter },
      reminderSentAt: null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, notifInApp: true, notifEmail: true } },
      field: { select: { name: true, location: true } },
    },
  });

  if (bookings.length === 0) return NextResponse.json({ sent: 0 });

  // Mark as reminded up-front to prevent duplicate sends if cron retries
  await prisma.booking.updateMany({
    where: { id: { in: bookings.map((b) => b.id) }, reminderSentAt: null },
    data: { reminderSentAt: new Date() },
  });

  let sent = 0;
  await Promise.allSettled(
    bookings.map(async (b) => {
      const tasks: Promise<unknown>[] = [];
      const dateStr = new Date(b.date).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

      if (b.user.notifInApp) {
        tasks.push(
          prisma.notification.create({
            data: {
              userId: b.user.id,
              type: 'BOOKING_REMINDER',
              title: 'แจ้งเตือนการจองพรุ่งนี้',
              message: `คุณมีการจอง ${b.field.name} พรุ่งนี้ ${dateStr} เวลา ${b.timeSlot} น.`,
              link: '/sport/bookings',
            },
          }).catch(() => {}),
          sendPushToUser(b.user.id, {
            title: 'แจ้งเตือนการจองพรุ่งนี้',
            message: `${b.field.name} · ${b.timeSlot} น.`,
            link: '/sport/bookings',
          }).catch(() => {}),
        );
      }

      if (b.user.notifEmail && b.user.email) {
        tasks.push(
          sendBookingReminderEmail(b.user.email, {
            userName: b.user.name ?? 'ลูกค้า',
            fieldName: b.field.name,
            date: dateStr,
            timeSlot: b.timeSlot,
          }).catch(() => {}),
        );
      }

      await Promise.allSettled(tasks);
      sent++;
    }),
  );

  return NextResponse.json({ sent });
}
