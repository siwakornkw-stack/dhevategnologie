'use client';

import GeneratorInput from '@/components/generator/generator-input';
import { RenderMessage } from '@/components/generator/render-message';
import { GradientBlob } from '@/components/gradient-blob';
import { useChat } from '@ai-sdk/react';
import { createIdGenerator, type Message } from 'ai';
import { useState } from 'react';

type Props = {
  chatId: string;
  initialMessages: Message[];
};

export default function ChatView({ chatId, initialMessages }: Props) {
  const [isThinking, setIsThinking] = useState(false);

  const chatHandler = useChat({
    body: { chatId },
    initialMessages,
    generateId: createIdGenerator({ prefix: 'msgc' }),
    sendExtraMessageFields: true,
    onResponse: () => setIsThinking(false),
  });

  return (
    <div className="contents">
      <RenderMessage useChat={chatHandler} isThinking={isThinking} />

      <div className="px-5 md:px-12">
        <form
          onSubmit={(e) => {
            setIsThinking(true);
            chatHandler.handleSubmit(e);
          }}
        >
          <GeneratorInput
            value={chatHandler.input}
            onChange={chatHandler.handleInputChange}
          />
        </form>

        <GradientBlob />
      </div>
    </div>
  );
}
