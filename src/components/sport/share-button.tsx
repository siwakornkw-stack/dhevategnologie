'use client';

import { useState } from 'react';

export function ShareButton({ url, title }: { url?: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareUrl = url ?? window.location.href;
    const shareTitle = title ?? document.title;

    // 1. Web Share API (mobile / HTTPS)
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // user cancelled
      }
    }

    // 2. Clipboard API (HTTPS / localhost)
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {}

    // 3. execCommand fallback (HTTP, older browsers)
    try {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    } catch {}

    // 4. Last resort: prompt so user can copy manually
    window.prompt('คัดลอก URL:', shareUrl);
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
    >
      {copied ? '✓ คัดลอกแล้ว' : '🔗 แชร์'}
    </button>
  );
}
