'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Notif {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      es = new EventSource('/api/sport/notifications/stream');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.unreadCount !== undefined) setUnread(data.unreadCount);
          if (data.notifications) setNotifications(data.notifications);
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        es = null;
        // Fallback: poll every 60s
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchFallback, 60000);
          fetchFallback();
        }
      };
    }

    async function fetchFallback() {
      try {
        const res = await fetch('/api/sport/notifications');
        if (!res.ok) return;
        const data = await res.json();
        setUnread(data.unreadCount ?? 0);
        setNotifications(data.notifications ?? []);
      } catch {}
    }

    connectSSE();

    return () => {
      es?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      await fetch('/api/sport/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  }

  function handleClick(notif: Notif) {
    setOpen(false);
    if (notif.link) router.push(notif.link);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        aria-label={t('notifications')}
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-theme-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{t('notifications')}</span>
          </div>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t('noNotifications')}</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${!n.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                >
                  <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
