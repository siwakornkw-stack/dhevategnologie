'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'PENDING', label: 'รอดำเนินการ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ปฏิเสธ' },
  { value: 'CANCELLED', label: 'ยกเลิก' },
];

export function BookingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get('status') ?? 'ALL';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const view = searchParams.get('view') ?? 'list';

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  function clearFilters() {
    const params = new URLSearchParams();
    if (view !== 'list') params.set('view', view);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = status !== 'ALL' || from || to;

  const inputCls = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* View toggle */}
      <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium">
        <button
          onClick={() => update('view', 'list')}
          className={`px-3 py-2 transition ${view !== 'calendar' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          รายการ
        </button>
        <button
          onClick={() => update('view', 'calendar')}
          className={`px-3 py-2 transition ${view === 'calendar' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          ปฏิทิน
        </button>
      </div>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => update('status', e.target.value)}
        className={inputCls}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        value={from}
        onChange={(e) => update('from', e.target.value)}
        className={inputCls}
        placeholder="จาก"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => update('to', e.target.value)}
        className={inputCls}
        placeholder="ถึง"
      />

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
        >
          ล้างตัวกรอง
        </button>
      )}
    </div>
  );
}
