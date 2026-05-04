import { AI_MODEL } from '@/lib/ai/model';
import { PROMPT } from '@/lib/ai/prompts';
import { prisma } from '@/lib/prisma';
import { rateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit';
import { errorHandler, getMostRecentUserMessage } from '@/lib/utils';
import { createIdGenerator, streamText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 50;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = await rateLimit(`ai-chat:${ip}`, AI_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    const chatId = body?.chatId;

    if (!messages) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    if (chatId && typeof chatId === 'string') {
      const content = typeof userMessage.content === 'string' ? userMessage.content : '';
      prisma.aiChatSession.upsert({
        where: { id: chatId },
        update: { updatedAt: new Date() },
        create: { id: chatId },
      }).then(() =>
        prisma.aiChatMessage.create({ data: { sessionId: chatId, role: 'user', content } })
      ).catch(() => {});
    }

    const result = streamText({
      model: AI_MODEL,
      system: PROMPT,
      messages,
      experimental_generateMessageId: createIdGenerator({ prefix: 'msgs' }),
      onFinish: async ({ text }) => {
        if (!chatId || typeof chatId !== 'string') return;
        await prisma.aiChatMessage.create({
          data: { sessionId: chatId, role: 'assistant', content: text },
        }).catch(() => {});
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: process.env.NODE_ENV === 'development' ? errorHandler : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
