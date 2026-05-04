import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBookingReminderEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authHeader = req.headers.get('authorization');
  const secret = authHeader?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find APPROVED bookings for tomorrow (UTC date)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'APPROVED',
      date: { gte: tomorrow, lt: dayAfter },
    },
    include: {
      user: { select: { id: true, name: true, email: true, notifInApp: true, notifEmail: true } },
      field: { select: { name: true, location: true } },
    },
  });

  if (bookings.length === 0) return NextResponse.json({ sent: 0 });

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
