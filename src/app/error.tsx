'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html>
      <body className="bg-gray-50 dark:bg-gray-950 flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">กรุณาลองใหม่อีกครั้ง</p>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
