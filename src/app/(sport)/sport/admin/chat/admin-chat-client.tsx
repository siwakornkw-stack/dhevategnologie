'use client';

import { useEffect, useState } from 'react';
import { ChatWindow } from '@/components/sport/chat-window';

interface ConversationItem {
  id: string;
  userId: string;
  lastMessageAt: string;
  user: { id: string; name: string | null; email: string; image: string | null };
  lastMessage: { content: string; senderRole: string; createdAt: string } | null;
  unreadCount: number;
}

export function AdminChatClient({ currentUserId }: { currentUserId: string }) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showListMobile, setShowListMobile] = useState(true);

  async function loadList() {
    try {
      const res = await fetch('/api/sport/admin/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    const interval = setInterval(loadList, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedUserId && conversations.length > 0) {
      setSelectedUserId(conversations[0].userId);
    }
  }, [conversations, selectedUserId]);

  const selected = conversations.find((c) => c.userId === selectedUserId);

  return (
    <div className="flex h-full gap-4">
      {/* Conversation list */}
      <aside
        className={`${showListMobile || !selectedUserId ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden`}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">ห้องสนทนา ({conversations.length})</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">ยังไม่มีข้อความจากลูกค้า</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {conversations.map((c) => {
                const isSel = c.userId === selectedUserId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => { setSelectedUserId(c.userId); setShowListMobile(false); }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                        isSel ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm flex-shrink-0">
                        {(c.user.name ?? c.user.email)[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {c.user.name ?? c.user.email}
                          </p>
                          {c.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        {c.lastMessage && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {c.lastMessage.senderRole === 'ADMIN' ? 'คุณ: ' : ''}
                            {c.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Chat window */}
      <div className={`${!showListMobile && selectedUserId ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
        {selectedUserId && selected ? (
          <>
            <button
              onClick={() => setShowListMobile(true)}
              className="md:hidden mb-2 text-sm text-primary-600 font-medium"
            >
              ← กลับ
            </button>
            <div className="flex-1 min-h-0">
              <ChatWindow
                key={selectedUserId}
                userId={selectedUserId}
                asAdmin
                currentUserId={currentUserId}
                title={selected.user.name ?? selected.user.email}
                subtitle={selected.user.email}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">เลือกห้องสนทนาจากด้านซ้าย</div>
        )}
      </div>
    </div>
  );
}
