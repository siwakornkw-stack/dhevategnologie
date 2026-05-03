import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
const FROM = process.env.EMAIL_FROM ?? 'noreply@88arena.com';

async function sendEmail(args: Parameters<typeof resend.emails.send>[0]) {
  const { error } = await resend.emails.send(args);
  if (error) console.error('[email] send failed:', error);
}

interface BookingEmailData {
  userName: string;
  fieldName: string;
  date: string;
  timeSlot: string;
  amountPaid?: number;
  discountAmount?: number;
}

export async function sendVerificationEmail(to: string, token: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  const url = `${process.env.NEXTAUTH_URL}/sport/auth/verify-email?token=${token}`;
  await sendEmail({
    from: FROM,
    to,
    subject: '📧 ยืนยันอีเมลของคุณ - 88ARENA',
    html: emailTemplate({
      title: 'ยืนยันอีเมล',
      emoji: '📧',
      body: `
        <p>ขอบคุณที่สมัครสมาชิก 88ARENA!</p>
        <p>กรุณากดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">ยืนยันอีเมล</a>
        </div>
        <p style="color:#6b7280;font-size:13px;">ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง หากไม่ได้สมัคร กรุณาเพิกเฉย</p>
      `,
    }),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  const url = `${process.env.NEXTAUTH_URL}/sport/auth/reset-password?token=${token}`;
  await sendEmail({
    from: FROM,
    to,
    subject: '🔐 รีเซ็ตรหัสผ่าน - 88ARENA',
    html: emailTemplate({
      title: 'รีเซ็ตรหัสผ่าน',
      emoji: '🔐',
      body: `
        <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">รีเซ็ตรหัสผ่าน</a>
        </div>
        <p style="color:#6b7280;font-size:13px;">ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากไม่ได้ขอ กรุณาเพิกเฉย</p>
      `,
    }),
  });
}

export async function sendBookingCreatedEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  await sendEmail({
    from: FROM,
    to,
    subject: `✅ ยืนยันการจอง: ${data.fieldName}`,
    html: emailTemplate({
      title: 'รับการจองแล้ว',
      emoji: '📋',
      body: `
        <p>สวัสดีคุณ <strong>${data.userName}</strong></p>
        <p>เราได้รับคำขอจองของคุณแล้ว กรุณารอการยืนยันจากแอดมิน</p>
        ${bookingDetails(data)}
        <p style="color:#6b7280;font-size:14px;">หากมีข้อสงสัยกรุณาติดต่อเรา</p>
      `,
    }),
  });
}

export async function sendBookingPaidEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  const receiptRows = [
    data.amountPaid !== undefined ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">ยอดชำระ</td><td style="padding:10px 16px;font-weight:700;color:#16a34a;">฿${data.amountPaid.toLocaleString()}</td></tr>` : '',
    data.discountAmount ? `<tr style="background:#fff;"><td style="padding:10px 16px;color:#6b7280;font-size:14px;">ส่วนลด</td><td style="padding:10px 16px;font-weight:600;color:#dc2626;">-฿${data.discountAmount.toLocaleString()}</td></tr>` : '',
  ].filter(Boolean).join('');
  await sendEmail({
    from: FROM,
    to,
    subject: `💳 ชำระเงินสำเร็จ: ${data.fieldName}`,
    html: emailTemplate({
      title: 'ชำระเงินสำเร็จ',
      emoji: '💳',
      body: `
        <p>สวัสดีคุณ <strong>${data.userName}</strong></p>
        <p>ระบบได้รับการชำระเงินของคุณแล้ว กรุณารอการยืนยันจากแอดมิน</p>
        ${bookingDetails(data)}
        ${receiptRows ? `<table style="width:100%;border-collapse:collapse;margin:8px 0;background:#f0fdf4;border-radius:8px;overflow:hidden;">${receiptRows}</table>` : ''}
      `,
    }),
  });
}

export async function sendBookingApprovedEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  await sendEmail({
    from: FROM,
    to,
    subject: `🎉 อนุมัติการจอง: ${data.fieldName}`,
    html: emailTemplate({
      title: 'การจองได้รับการอนุมัติ!',
      emoji: '🎉',
      body: `
        <p>สวัสดีคุณ <strong>${data.userName}</strong></p>
        <p>ยินดีด้วย! การจองของคุณได้รับการ <strong style="color:#16a34a;">อนุมัติแล้ว</strong></p>
        ${bookingDetails(data)}
        <p>กรุณามาถึงสนามก่อนเวลาอย่างน้อย 10 นาที</p>
      `,
    }),
  });
}

export async function sendBookingCancelledEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  await sendEmail({
    from: FROM,
    to,
    subject: `🚫 ยกเลิกการจอง: ${data.fieldName}`,
    html: emailTemplate({
      title: 'ยกเลิกการจองแล้ว',
      emoji: '🚫',
      body: `
        <p>สวัสดีคุณ <strong>${data.userName}</strong></p>
        <p>การจองของคุณถูก<strong style="color:#dc2626;">ยกเลิก</strong>แล้ว</p>
        ${bookingDetails(data)}
        <p style="color:#6b7280;font-size:14px;">หากต้องการจองใหม่ กรุณาเข้าสู่ระบบที่เว็บไซต์ของเรา</p>
      `,
    }),
  });
}

export async function sendBookingRejectedEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  await sendEmail({
    from: FROM,
    to,
    subject: `❌ ปฏิเสธการจอง: ${data.fieldName}`,
    html: emailTemplate({
      title: 'การจองถูกปฏิเสธ',
      emoji: '❌',
      body: `
        <p>สวัสดีคุณ <strong>${data.userName}</strong></p>
        <p>ขออภัย การจองของคุณ<strong style="color:#dc2626;">ถูกปฏิเสธ</strong></p>
        ${bookingDetails(data)}
        <p>หากต้องการข้อมูลเพิ่มเติม กรุณาติดต่อเรา</p>
      `,
    }),
  });
}

function bookingDetails(data: BookingEmailData) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">สนาม</td><td style="padding:10px 16px;font-weight:600;">${data.fieldName}</td></tr>
      <tr style="background:#fff;"><td style="padding:10px 16px;color:#6b7280;font-size:14px;">วันที่</td><td style="padding:10px 16px;font-weight:600;">${data.date}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">เวลา</td><td style="padding:10px 16px;font-weight:600;">${data.timeSlot} น.</td></tr>
    </table>
  `;
}

function emailTemplate({ title, emoji, body }: { title: string; emoji: string; body: string }) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;background:#f3f4f6;margin:0;padding:24px;">
      <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
          <div style="font-size:48px;">${emoji}</div>
          <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">${title}</h1>
        </div>
        <div style="padding:24px 32px 32px;">
          ${body}
        </div>
        <div style="background:#f9fafb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:12px;">
          88ARENA
        </div>
      </div>
    </body>
    </html>
  `;
}
