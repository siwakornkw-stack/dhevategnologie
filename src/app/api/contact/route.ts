import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');

const schema = z.object({
  firstName: z.string({ required_error: 'First name is required' }).min(1, 'First name is required'),
  lastName: z.string({ required_error: 'Last name is required' }).min(1, 'Last name is required'),
  email: z.string({ required_error: 'Email is required' }).email('Invalid email address'),
  message: z.string({ required_error: 'Message is required' }).min(10, 'Message must be at least 10 characters'),
});

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your')) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { firstName, lastName, email, message } = parsed.data;
  const adminEmail = process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? process.env.EMAIL_FROM ?? 'admin@88arena.com';

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'noreply@88arena.com',
    to: adminEmail,
    replyTo: email,
    subject: `Contact form: ${firstName} ${lastName}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#6366f1;">New contact message</h2>
        <p><strong>From:</strong> ${esc(firstName)} ${esc(lastName)} &lt;${esc(email)}&gt;</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p style="white-space:pre-wrap;">${esc(message)}</p>
      </div>
    `,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
