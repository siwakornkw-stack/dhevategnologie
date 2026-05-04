import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;

  const session = await prisma.aiChatSession.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ messages: [] });
  }

  return NextResponse.json({ messages: session.messages });
}
