'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { printRemovedSlip, type RemovedRow } from '@/lib/removal-slip';

type Slip = {
  id: string;
  tabName: string;
  items: RemovedRow[];
  total: number;
  cashierName: string | null;
  createdAt: string;
};

export default function RemovalSlipsPage() {
  const [list, setList] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/sport/pos/removal-slips');
      setLoading(false);
      if (!r.ok) { toast.error('โหลดไม่สำเร็จ'); return; }
      setList(await r.json());
    })();
  }, []);

  async function reprint(s: Slip) {
    const settings = await fetch('/api/sport/pos/settings').then((x) => x.ok ? x.json() : null).catch(() => null);
    const ok = printRemovedSlip(s.items, {
      shopName: settings?.shopName || '',
      width: settings?.paperSize === '58mm' ? '58mm' : '80mm',
      tabName: s.tabName,
      when: new Date(s.createdAt).toLocaleString('th-TH'),
    });
    if (!ok) toast.error('เปิดหน้าพิมพ์ไม่ได้ — ตรวจ popup blocker');
  }

  return (
    <div className="wrapper py-6 max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sport/pos" className="text-sm text-gray-400 hover:text-gray-600">← POS</Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">รายการที่ลบ (ย้อนหลัง)</h1>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-10 text-sm">กำลังโหลด...</div>
      ) : list.length === 0 ? (
        <div className="text-center text-gray-400 py-10 text-sm">ยังไม่มีรายการที่ลบ</div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const totalQty = s.items.reduce((a, r) => a + r.qty, 0);
            return (
              <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">Tab: {s.tabName || '-'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {new Date(s.createdAt).toLocaleString('th-TH')}{s.cashierName ? ` · ${s.cashierName}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">-{s.total.toFixed(2)}</div>
                    <button onClick={() => reprint(s)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 mt-0.5">พิมพ์ซ้ำ</button>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t dark:border-gray-800 space-y-0.5">
                  {s.items.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span className="truncate">{r.productName}</span>
                      <span className="tabular-nums ml-2 shrink-0">x{r.qty} · {(r.unitPrice * r.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">รวมที่ลบ {totalQty} ชิ้น</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
