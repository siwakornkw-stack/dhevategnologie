'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-md px-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">กรุณาลองใหม่อีกครั้ง</p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
        >
          ลองใหม่
        </button>
      </div>
    </div>
  );
}
