import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit(`ai-chat-read:${ip}`, AI_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { chatId } = await params;
  if (typeof chatId !== 'string' || chatId.length < 16 || chatId.length > 100) {
    return NextResponse.json({ messages: [] });
  }

  const session = await prisma.aiChatSession.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
        take: 200,
      },
    },
  });

  if (!session) {
    return NextResponse.json({ messages: [] });
  }

  return NextResponse.json({ messages: session.messages });
}
