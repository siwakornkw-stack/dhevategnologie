import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

// Verifies the CRON_SECRET via the Authorization: Bearer header only.
// Vercel Cron sends the secret in this header; query-string secrets are rejected
// because they leak into access logs and proxies.
export function verifyCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const provided = authHeader.slice('Bearer '.length);

  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
