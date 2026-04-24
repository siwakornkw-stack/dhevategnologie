import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    take: 100,
  });

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const unread = await prisma.message.count({
        where: { conversationId: c.id, senderRole: 'USER', isRead: false },
      });
      return {
        ...c,
        lastMessage: c.messages[0] ?? null,
        unreadCount: unread,
        messages: undefined,
      };
    }),
  );

  return NextResponse.json(withUnread);
}
