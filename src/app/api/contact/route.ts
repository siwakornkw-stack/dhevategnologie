import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, AUTH_RATE_LIMIT, getClientIp } from '@/lib/rate-limit';

const schema = z.object({
  firstName: z.string({ required_error: 'First name is required' }).min(1, 'First name is required'),
  lastName: z.string({ required_error: 'Last name is required' }).min(1, 'Last name is required'),
  email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
  message: z.string({ required_error: 'Message is required' }).min(10, 'Message must be at least 10 characters'),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`contact:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { firstName, lastName, email, message } = parsed.data;

  // Always persist the lead so the sales-site admin can see it even if email is unconfigured.
  await prisma.lead.create({ data: { firstName, lastName, email, message } });

  // Best-effort notification email; never block the lead on email delivery.
  const key = process.env.RESEND_API_KEY;
  if (key && !key.startsWith('re_your') && !key.startsWith('re_placeholder')) {
    const adminEmail = process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? process.env.EMAIL_FROM ?? 'admin@dhevategnologie.com';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    try {
      await new Resend(key).emails.send({
        from: process.env.EMAIL_FROM ?? 'noreply@dhevategnologie.com',
        to: adminEmail,
        replyTo: email,
        subject: `Contact form: ${firstName} ${lastName}`,
        html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#1E5BD6;">New contact / demo request</h2>
        <p><strong>From:</strong> ${esc(firstName)} ${esc(lastName)} &lt;${esc(email)}&gt;</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p style="white-space:pre-wrap;">${esc(message)}</p>
      </div>
    `,
      });
    } catch {
      // lead already stored; ignore email failure
    }
  }

  return NextResponse.json({ ok: true });
}
