import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

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
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

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

      const interval = setInterval(async () => {
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
            controller.enqueue(encoder.encode(': ping\n\n'));
          }
        } catch {
          clearInterval(interval);
          try { controller.close(); } catch {}
        }
      }, 3000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
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
