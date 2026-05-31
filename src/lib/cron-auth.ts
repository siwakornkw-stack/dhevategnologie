import { timingSafeEqual } from 'crypto';

// Constant-time Bearer-token check for Vercel Cron endpoints. Returns false when
// CRON_SECRET is unset or the supplied secret does not match, comparing in a way
// that does not leak length/match position via timing.
export function verifyCronSecret(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const supplied = req.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
