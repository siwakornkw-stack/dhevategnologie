import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
const FROM = process.env.EMAIL_FROM ?? 'noreply@88arena.com';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL}/sport/auth/verify-email?token=${token}`;
  await sendEmail({
    from: FROM,
    to,
    subject: 'Verify your email / ยืนยันอีเมลของคุณ - 88ARENA',
    html: emailTemplate({
      titleEn: 'Verify Your Email',
      titleTh: 'ยืนยันอีเมล',
      emoji: '📧',
      bodyEn: `
        <p>Thank you for registering with 88ARENA!</p>
        <p>Click the button below to verify your email address.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">Verify Email</a>
        </div>
        <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours. If you did not register, please ignore this email.</p>
      `,
      bodyTh: `
        <p>ขอบคุณที่สมัครสมาชิก 88ARENA!</p>
        <p>กรุณากดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ</p>
        <p style="color:#6b7280;font-size:13px;">ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง หากไม่ได้สมัคร กรุณาเพิกเฉย</p>
      `,
    }),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL}/sport/auth/reset-password?token=${token}`;
  await sendEmail({
    from: FROM,
    to,
    subject: 'Reset your password / รีเซ็ตรหัสผ่าน - 88ARENA',
    html: emailTemplate({
      titleEn: 'Reset Your Password',
      titleTh: 'รีเซ็ตรหัสผ่าน',
      emoji: '🔐',
      bodyEn: `
        <p>We received a request to reset your password.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
        </div>
        <p style="color:#6b7280;font-size:13px;">This link expires in 1 hour. If you did not request this, please ignore this email.</p>
      `,
      bodyTh: `
        <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ</p>
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
    subject: `Booking received / รับการจองแล้ว: ${data.fieldName}`,
    html: emailTemplate({
      titleEn: 'Booking Received',
      titleTh: 'รับการจองแล้ว',
      emoji: '📋',
      bodyEn: `
        <p>Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
        <p>We have received your booking request. Please wait for admin approval.</p>
        ${bookingDetails(data)}
        <p style="color:#6b7280;font-size:14px;">If you have any questions, please contact us.</p>
      `,
      bodyTh: `
        <p>สวัสดีคุณ <strong>${escapeHtml(data.userName)}</strong></p>
        <p>เราได้รับคำขอจองของคุณแล้ว กรุณารอการยืนยันจากแอดมิน</p>
      `,
    }),
  });
}

export async function sendBookingPaidEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  const receiptRows = [
    data.amountPaid !== undefined ? `<tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">Amount paid / ยอดชำระ</td><td style="padding:10px 16px;font-weight:700;color:#16a34a;">฿${data.amountPaid.toLocaleString()}</td></tr>` : '',
    data.discountAmount ? `<tr style="background:#fff;"><td style="padding:10px 16px;color:#6b7280;font-size:14px;">Discount / ส่วนลด</td><td style="padding:10px 16px;font-weight:600;color:#dc2626;">-฿${data.discountAmount.toLocaleString()}</td></tr>` : '',
  ].filter(Boolean).join('');
  await sendEmail({
    from: FROM,
    to,
    subject: `Payment successful / ชำระเงินสำเร็จ: ${data.fieldName}`,
    html: emailTemplate({
      titleEn: 'Payment Successful',
      titleTh: 'ชำระเงินสำเร็จ',
      emoji: '💳',
      bodyEn: `
        <p>Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
        <p>We have received your payment. Please wait for admin approval.</p>
        ${bookingDetails(data)}
        ${receiptRows ? `<table style="width:100%;border-collapse:collapse;margin:8px 0;background:#f0fdf4;border-radius:8px;overflow:hidden;">${receiptRows}</table>` : ''}
      `,
      bodyTh: `
        <p>สวัสดีคุณ <strong>${escapeHtml(data.userName)}</strong></p>
        <p>ระบบได้รับการชำระเงินของคุณแล้ว กรุณารอการยืนยันจากแอดมิน</p>
      `,
    }),
  });
}

export async function sendBookingApprovedEmail(to: string, data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) return;
  await sendEmail({
    from: FROM,
    to,
    subject: `Booking approved / อนุมัติการจอง: ${data.fieldName}`,
    html: emailTemplate({
      titleEn: 'Booking Approved!',
      titleTh: 'การจองได้รับการอนุมัติ!',
      emoji: '🎉',
      bodyEn: `
        <p>Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
        <p>Your booking has been <strong style="color:#16a34a;">approved</strong>.</p>
        ${bookingDetails(data)}
        <p>Please arrive at least 10 minutes before your slot.</p>
      `,
      bodyTh: `
        <p>สวัสดีคุณ <strong>${escapeHtml(data.userName)}</strong></p>
        <p>ยินดีด้วย! การจองของคุณได้รับการ <strong style="color:#16a34a;">อนุมัติแล้ว</strong></p>
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
    subject: `Booking cancelled / ยกเลิกการจอง: ${data.fieldName}`,
    html: emailTemplate({
      titleEn: 'Booking Cancelled',
      titleTh: 'ยกเลิกการจองแล้ว',
      emoji: '🚫',
      bodyEn: `
        <p>Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
        <p>Your booking has been <strong style="color:#dc2626;">cancelled</strong>.</p>
        ${bookingDetails(data)}
        <p style="color:#6b7280;font-size:14px;">To make a new booking, please visit our website.</p>
      `,
      bodyTh: `
        <p>สวัสดีคุณ <strong>${escapeHtml(data.userName)}</strong></p>
        <p>การจองของคุณถูก<strong style="color:#dc2626;">ยกเลิก</strong>แล้ว</p>
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
    subject: `Booking rejected / ปฏิเสธการจอง: ${data.fieldName}`,
    html: emailTemplate({
      titleEn: 'Booking Rejected',
      titleTh: 'การจองถูกปฏิเสธ',
      emoji: '❌',
      bodyEn: `
        <p>Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
        <p>Unfortunately your booking has been <strong style="color:#dc2626;">rejected</strong>.</p>
        ${bookingDetails(data)}
        <p>For more information, please contact us.</p>
      `,
      bodyTh: `
        <p>สวัสดีคุณ <strong>${escapeHtml(data.userName)}</strong></p>
        <p>ขออภัย การจองของคุณ<strong style="color:#dc2626;">ถูกปฏิเสธ</strong></p>
        <p>หากต้องการข้อมูลเพิ่มเติม กรุณาติดต่อเรา</p>
      `,
    }),
  });
}

function bookingDetails(data: BookingEmailData) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">Field / สนาม</td><td style="padding:10px 16px;font-weight:600;">${escapeHtml(data.fieldName)}</td></tr>
      <tr style="background:#fff;"><td style="padding:10px 16px;color:#6b7280;font-size:14px;">Date / วันที่</td><td style="padding:10px 16px;font-weight:600;">${escapeHtml(data.date)}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px;">Time / เวลา</td><td style="padding:10px 16px;font-weight:600;">${escapeHtml(data.timeSlot)}</td></tr>
    </table>
  `;
}

interface TemplateArgs {
  titleEn: string;
  titleTh: string;
  emoji: string;
  bodyEn: string;
  bodyTh: string;
}

function emailTemplate({ titleEn, titleTh, emoji, bodyEn, bodyTh }: TemplateArgs) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:sans-serif;background:#f3f4f6;margin:0;padding:24px;">
      <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
          <div style="font-size:48px;">${emoji}</div>
          <h1 style="color:#fff;margin:8px 0 0;font-size:22px;">${titleEn}</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">${titleTh}</p>
        </div>
        <div style="padding:24px 32px 16px;">
          ${bodyEn}
        </div>
        <div style="padding:0 32px 24px;border-top:1px solid #f3f4f6;margin-top:8px;">
          <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;">Thai / ภาษาไทย</p>
          ${bodyTh}
        </div>
        <div style="background:#f9fafb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:12px;">
          88ARENA
        </div>
      </div>
    </body>
    </html>
  `;
}
