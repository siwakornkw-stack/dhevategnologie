import { prisma } from '@/lib/prisma';
import ChatView from './_chat';

export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
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

  const initialMessages = (session?.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return <ChatView chatId={chatId} initialMessages={initialMessages} />;
}
