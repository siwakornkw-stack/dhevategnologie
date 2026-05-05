'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
  entryId: string;
  userName: string;
}

export function WaitingListDeleteButton({ entryId, userName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`ลบ ${userName} ออกจาก waiting list?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sport/admin/waiting-list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'เกิดข้อผิดพลาด');
      }
      toast.success(`ลบ ${userName} ออกจาก waiting list แล้ว`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
    >
      {loading ? '...' : 'ลบ'}
    </button>
  );
}
