import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const CHAT_RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 };

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
  userId: z.string().optional(),
});

async function getOrCreateConversation(userId: string) {
  return prisma.conversation.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const targetUserId = req.nextUrl.searchParams.get('userId');
  const isAdmin = session.user.role === 'ADMIN';

  const userId = isAdmin && targetUserId ? targetUserId : session.user.id;
  if (!isAdmin && targetUserId && targetUserId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const conversation = await getOrCreateConversation(userId);
  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  // Mark incoming messages as read
  const incomingRole = isAdmin ? 'USER' : 'ADMIN';
  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderRole: incomingRole, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ conversation, messages });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`chat:${session.user.id}`, CHAT_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'ส่งข้อความเร็วเกินไป' }, { status: 429 });

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const isAdmin = session.user.role === 'ADMIN';
  const targetUserId = parsed.data.userId;

  const conversationUserId = isAdmin && targetUserId ? targetUserId : session.user.id;
  if (isAdmin && !targetUserId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const conversation = await getOrCreateConversation(conversationUserId);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: session.user.id,
      senderRole: isAdmin ? 'ADMIN' : 'USER',
      content: parsed.data.content,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json(message);
}
