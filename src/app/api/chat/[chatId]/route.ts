import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit';
import { auth } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`ai-chat-read:${session.user.id}`, AI_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { chatId } = await params;
  if (typeof chatId !== 'string' || chatId.length < 16 || chatId.length > 100) {
    return NextResponse.json({ messages: [] });
  }

  const chat = await prisma.aiChatSession.findUnique({
    where: { id: chatId },
    select: {
      userId: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
        take: 200,
      },
    },
  });

  if (!chat) return NextResponse.json({ messages: [] });
  if (chat.userId && chat.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ messages: chat.messages });
}
