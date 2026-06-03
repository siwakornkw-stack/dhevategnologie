'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function AdminFieldActions({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sport/fields/${fieldId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'ลบสนามไม่สำเร็จ');
      }
      toast.success(`ลบสนาม "${fieldName}" แล้ว`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-500">ลบ &quot;{fieldName}&quot;?</span>
        <button onClick={handleDelete} disabled={loading} className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {loading ? '...' : 'ยืนยัน'}
        </button>
        <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิก</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={() => setConfirmDelete(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        ลบ
      </button>
    </div>
  );
}
