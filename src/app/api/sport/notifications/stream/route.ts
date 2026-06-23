import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Cap stream lifetime below maxDuration; the client's EventSource auto-reconnects.
const MAX_LIFETIME_MS = 4 * 60 * 1000;

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const rl = await rateLimit(`sse-notif:${session.user.id}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.success) return new Response('Too Many Requests', { status: 429 });

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let interval: ReturnType<typeof setInterval> | undefined;
      let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        if (lifetimeTimer) clearTimeout(lifetimeTimer);
        try { controller.close(); } catch {}
      };
      // enqueue throws once the client socket is gone; tear down so the DB poll stops
      // instead of running until MAX_LIFETIME_MS on a dead connection.
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (data: object) => enqueue(`data: ${JSON.stringify(data)}\n\n`);

      // Send initial state
      const [unreadCount, notifications] = await Promise.all([
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      ]);
      send({ unreadCount, notifications });

      let lastCount = unreadCount;

      interval = setInterval(async () => {
        if (closed) return;
        try {
          const count = await prisma.notification.count({ where: { userId, isRead: false } });
          if (count !== lastCount) {
            const notifs = await prisma.notification.findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take: 20,
            });
            send({ unreadCount: count, notifications: notifs });
            lastCount = count;
          } else {
            // Heartbeat to keep connection alive
            enqueue(': ping\n\n');
          }
        } catch {
          cleanup();
        }
        // 30s poll: the bell badge is background info, so a slightly slower refresh
        // cuts the per-connection DB count queries ~3x (active CPU + DB load) vs 10s.
      }, 30000);

      lifetimeTimer = setTimeout(cleanup, MAX_LIFETIME_MS);

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
