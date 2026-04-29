import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { rateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

const schema = z.object({
  name: z.string().min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร'),
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  phone: z.string().regex(/^0[0-9]{8,9}$/, 'เบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  referralCode: z.string().optional(),
});

function makeReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    const rl = await rateLimit(`register:${ip}`, AUTH_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json({ error: 'คุณส่งคำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, email, phone, password, referralCode } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้แล้ว' }, { status: 409 });
    }

    // Resolve referrer
    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
      if (!referrer) {
        return NextResponse.json({ error: 'รหัสแนะนำเพื่อนไม่ถูกต้อง' }, { status: 400 });
      }
      referredById = referrer.id;
    }

    // Generate unique referral code for new user
    let newCode = makeReferralCode();
    let codeExists = await prisma.user.findFirst({ where: { referralCode: newCode } });
    while (codeExists) {
      newCode = makeReferralCode();
      codeExists = await prisma.user.findFirst({ where: { referralCode: newCode } });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, phone, password: hashed, referralCode: newCode, referredById },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    // Send verification email (non-blocking)
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await prisma.verificationToken.create({ data: { identifier: email, token, expires } });
    sendVerificationEmail(email, token).catch(() => {});

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('[register]', err);
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดภายในระบบ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
