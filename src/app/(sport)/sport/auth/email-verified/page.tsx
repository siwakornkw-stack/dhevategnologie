'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function EmailVerifiedPage() {
  const { status, update } = useSession();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (status === 'authenticated') {
      done.current = true;
      update(); // refresh JWT to pick up emailVerified from DB
      const t = setTimeout(() => router.push('/sport'), 2500);
      return () => clearTimeout(t);
    }
    if (status === 'unauthenticated') {
      done.current = true;
      router.push('/sport/auth/signin?verified=1');
    }
  }, [status, update, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <a href="/sport" className="text-4xl">🏟️</a>
        <div className="mt-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700/50 shadow-theme-sm p-8 space-y-4">
          <div className="text-5xl">✅</div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">ยืนยันอีเมลสำเร็จ!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">กำลังพาคุณไปหน้าหลัก...</p>
          <a href="/sport" className="block text-sm text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition mt-2">
            กลับหน้าหลักทันที
          </a>
        </div>
      </div>
    </div>
  );
}
