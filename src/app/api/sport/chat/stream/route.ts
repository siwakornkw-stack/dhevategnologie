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

  const rl = await rateLimit(`sse-chat:${session.user.id}`, { limit: 10, windowMs: 60 * 1000 });
  if (!rl.success) return new Response('Too Many Requests', { status: 429 });

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');
  const isAdmin = session.user.role === 'ADMIN';

  const userId = isAdmin && targetUserId ? targetUserId : session.user.id;
  if (!isAdmin && targetUserId && targetUserId !== session.user.id) {
    return new Response('Forbidden', { status: 403 });
  }

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

      const conversation = await prisma.conversation.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      const initial = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      send({ messages: initial });

      let lastCreatedAt = initial.length > 0 ? initial[initial.length - 1].createdAt : new Date(0);

      interval = setInterval(async () => {
        if (closed) return;
        try {
          const newer = await prisma.message.findMany({
            where: { conversationId: conversation.id, createdAt: { gt: lastCreatedAt } },
            orderBy: { createdAt: 'asc' },
            take: 50,
          });
          if (newer.length > 0) {
            send({ newMessages: newer });
            lastCreatedAt = newer[newer.length - 1].createdAt;
          } else {
            enqueue(': ping\n\n');
          }
        } catch {
          cleanup();
        }
      }, 3000);

      lifetimeTimer = setTimeout(cleanup, MAX_LIFETIME_MS);

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
