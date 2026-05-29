import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBookingReminderEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/web-push';
import { verifyCronSecret } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find APPROVED bookings for tomorrow in Thailand time (UTC+7). Booking dates are
  // stored as UTC-midnight of the Thai calendar day, so derive "tomorrow" from the
  // current Thai date and match against UTC midnight.
  const TH_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowTh = new Date(Date.now() + TH_OFFSET_MS);
  const tomorrow = new Date(Date.UTC(nowTh.getUTCFullYear(), nowTh.getUTCMonth(), nowTh.getUTCDate() + 1));
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

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
      const dateStr = new Date(b.date).toLocaleDateString('th-TH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' });

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
