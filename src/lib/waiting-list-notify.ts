import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { sendPushToUser } from '@/lib/web-push';

const resend = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
const FROM = process.env.EMAIL_FROM ?? 'noreply@88arena.com';

export async function notifyWaitingList(fieldId: string, date: Date, timeSlot: string) {
  const entries = await prisma.waitingList.findMany({
    where: { fieldId, date, timeSlot },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true, notifEmail: true, notifInApp: true } },
      field: { select: { name: true } },
    },
  });

  if (entries.length === 0) return;

  const resendEnabled =
    process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_your');

  const bookingUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/sport/fields/${fieldId}`;
  const dateStr = date.toLocaleDateString('th-TH');
  const fieldName = entries[0].field.name;

  // Delete notified entries so users aren't spammed on future cancellations
  await prisma.waitingList.deleteMany({
    where: { id: { in: entries.map((e) => e.id) } },
  });

  await Promise.allSettled(
    entries.map(async (entry) => {
      const { user } = entry;

      if (user.notifEmail && resendEnabled) {
        await resend.emails.send({
          from: FROM,
          to: user.email,
          subject: `🔔 มีช่วงเวลาว่าง: ${fieldName}`,
          html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family:sans-serif;background:#f3f4f6;margin:0;padding:24px;">
            <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
                <div style="font-size:48px;">🔔</div>
                <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">มีช่วงเวลาว่าง!</h1>
              </div>
              <div style="padding:24px 32px 32px;">
                <p>สวัสดีคุณ <strong>${user.name ?? 'ลูกค้า'}</strong></p>
                <p>ช่วงเวลาที่คุณรออยู่มีการยกเลิกแล้ว จองได้ทันทีก่อนคนอื่น!</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;overflow:hidden;">
                  <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">สนาม</td><td style="padding:10px 16px;font-weight:600;">${fieldName}</td></tr>
                  <tr style="background:#fff;"><td style="padding:10px 16px;color:#6b7280;font-size:14px;">วันที่</td><td style="padding:10px 16px;font-weight:600;">${dateStr}</td></tr>
                  <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">เวลา</td><td style="padding:10px 16px;font-weight:600;">${timeSlot} น.</td></tr>
                </table>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${bookingUrl}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">จองเลย</a>
                </div>
              </div>
              <div style="background:#f9fafb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:12px;">88ARENA</div>
            </div>
          </body>
          </html>
        `,
        }).catch(() => {});
      }

      if (user.notifInApp) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: '🔔 มีช่วงเวลาว่าง!',
            message: `${fieldName} · ${dateStr} เวลา ${timeSlot} น. — จองด่วนก่อนคนอื่น!`,
            type: 'WAITING_LIST',
            link: `/sport/fields/${fieldId}`,
          },
        }).catch(() => {});
      }

      await sendPushToUser(user.id, {
        title: '🔔 มีช่วงเวลาว่าง!',
        message: `${fieldName} · ${dateStr} เวลา ${timeSlot} น.`,
        link: `/sport/fields/${fieldId}`,
      }).catch(() => {});
    })
  );
}
