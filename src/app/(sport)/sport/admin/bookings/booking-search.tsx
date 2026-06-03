'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function BookingSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    const status = params.get('status') ?? 'ALL';
    startTransition(() => {
      router.replace(`/sport/admin/bookings?status=${status}&page=1${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    });
  }

  return (
    <input
      type="search"
      defaultValue={params.get('q') ?? ''}
      onChange={handleSearch}
      placeholder="ค้นหาชื่อ / อีเมล..."
      className="h-9 rounded-full border border-gray-200 dark:border-gray-700 px-4 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition w-56"
    />
  );
}
