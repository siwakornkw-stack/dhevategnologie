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

  const unreadCounts = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderRole: 'USER',
      isRead: false,
    },
    _count: { id: true },
  });
  const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

  const withUnread = conversations.map((c) => ({
    ...c,
    lastMessage: c.messages[0] ?? null,
    unreadCount: unreadMap.get(c.id) ?? 0,
    messages: undefined,
  }));

  return NextResponse.json(withUnread);
}
