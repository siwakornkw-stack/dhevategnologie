'use client';

import { useEffect, useState } from 'react';

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        // Subscribe to push notifications if VAPID key is available
        try {
          const keyRes = await fetch('/api/sport/push/vapid-key');
          const { publicKey } = await keyRes.json();
          if (!publicKey) return;

          const existing = await reg.pushManager.getSubscription();
          if (existing) return; // already subscribed

          const perm = await Notification.requestPermission();
          if (perm !== 'granted') return;

          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });

          await fetch('/api/sport/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub),
          });
        } catch {}
      }).catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt();
    setShowBanner(false);
    setInstallPrompt(null);
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3 print:hidden">
      <span className="text-3xl flex-shrink-0">🏟️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">ติดตั้ง 88ARENA</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">เพิ่มลงหน้าจอหลักเพื่อใช้งานง่ายขึ้น</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => setShowBanner(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">ไว้ก่อน</button>
        <button onClick={handleInstall} className="text-xs px-3 py-1.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-semibold transition">ติดตั้ง</button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
