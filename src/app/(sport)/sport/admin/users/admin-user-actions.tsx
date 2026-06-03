'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function AdminUserActions({ userId, currentRole, currentUserId }: {
  userId: string;
  currentRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isSelf = userId === currentUserId;

  async function toggleRole() {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    setLoading(true);
    try {
      const res = await fetch('/api/sport/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`เปลี่ยน role เป็น ${newRole} แล้ว`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (isSelf) return <span className="text-xs text-gray-300 dark:text-gray-600">-</span>;

  return (
    <button
      onClick={toggleRole}
      disabled={loading}
      className={`text-xs px-3 py-1 rounded-full font-medium transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        currentRole === 'ADMIN'
          ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200'
      }`}
    >
      {loading ? '...' : currentRole === 'ADMIN' ? 'ถอด Admin' : 'ตั้งเป็น Admin'}
    </button>
  );
}
