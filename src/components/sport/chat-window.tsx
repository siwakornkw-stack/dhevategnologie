'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'USER' | 'ADMIN';
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Props {
  userId?: string;
  asAdmin?: boolean;
  currentUserId: string;
  title?: string;
  subtitle?: string;
}

export function ChatWindow({ userId, asAdmin, currentUserId, title, subtitle }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const qs = userId ? `?userId=${userId}` : '';

  useEffect(() => {
    seenIds.current = new Set();
    setMessages([]);

    const es = new EventSource(`/api/sport/chat/stream${qs}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data.messages)) {
          data.messages.forEach((m: Message) => seenIds.current.add(m.id));
          setMessages(data.messages);
        } else if (Array.isArray(data.newMessages)) {
          const fresh = (data.newMessages as Message[]).filter((m) => !seenIds.current.has(m.id));
          fresh.forEach((m) => seenIds.current.add(m.id));
          if (fresh.length > 0) {
            setMessages((prev) => [...prev, ...fresh]);
          }
        }
      } catch {}
    };

    es.onerror = () => {};

    return () => es.close();
  }, [qs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId: '',
      senderId: currentUserId,
      senderRole: asAdmin ? 'ADMIN' : 'USER',
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const res = await fetch('/api/sport/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, ...(userId ? { userId } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'ส่งข้อความไม่สำเร็จ');
      }
      const saved: Message = await res.json();
      seenIds.current.add(saved.id);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ส่งข้อความไม่สำเร็จ');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          {title && <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>}
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
            <div className="text-5xl mb-2">💬</div>
            <p className="text-sm">{asAdmin ? 'ยังไม่มีข้อความ' : 'สวัสดีครับ มีอะไรให้แอดมินช่วยเหลือไหม?'}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                    isMine
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : m.senderRole === 'ADMIN'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 rounded-bl-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {!isMine && (
                    <div className="text-[10px] font-semibold opacity-70 mb-0.5">
                      {m.senderRole === 'ADMIN' ? '🛡️ แอดมิน' : 'ลูกค้า'}
                    </div>
                  )}
                  <div>{m.content}</div>
                  <div className={`text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-100 dark:border-gray-800 p-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
          disabled={sending}
          className="flex-1 h-11 rounded-full border border-gray-200 dark:border-gray-700 px-4 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="h-11 px-5 rounded-full gradient-btn text-white font-medium text-sm disabled:opacity-50"
        >
          ส่ง
        </button>
      </form>
    </div>
  );
}
