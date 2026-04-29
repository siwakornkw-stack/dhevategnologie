import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const rl = await rateLimit(`sse-notif:${session.user.id}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.success) return new Response('Too Many Requests', { status: 429 });

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Send initial state
      const [unreadCount, notifications] = await Promise.all([
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      ]);
      send({ unreadCount, notifications });

      let lastCount = unreadCount;

      const interval = setInterval(async () => {
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
            controller.enqueue(encoder.encode(': ping\n\n'));
          }
        } catch {
          clearInterval(interval);
          try { controller.close(); } catch {}
        }
      }, 10000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
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
