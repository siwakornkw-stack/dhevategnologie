import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const conversation = await prisma.conversation.findUnique({ where: { userId }, select: { id: true } });
  if (conversation) {
    await Promise.all([
      prisma.message.updateMany({
        where: { conversationId: conversation.id, senderRole: 'USER', isRead: false },
        data: { isRead: true },
      }),
      prisma.notification.updateMany({
        where: { userId: session.user.id, type: 'CHAT_MESSAGE', isRead: false },
        data: { isRead: true },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}

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
