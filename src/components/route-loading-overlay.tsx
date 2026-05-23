'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (document.readyState === 'complete') {
      const id = requestAnimationFrame(() => setLoading(false));
      return () => cancelAnimationFrame(id);
    }
    const onLoad = () => setLoading(false);
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      setLoading(true);
    }

    function onSubmit(e: SubmitEvent) {
      if (e.defaultPrevented) return;
      setLoading(true);
    }

    function onPageHide() {
      setLoading(true);
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  if (!loading) return null;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      role="status"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 dark:bg-black/70 backdrop-blur-sm cursor-wait"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">กำลังโหลด...</span>
      </div>
    </div>
  );
}
