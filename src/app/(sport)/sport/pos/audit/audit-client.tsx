'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Log = {
  id: string;
  action: string;
  targetId: string | null;
  details: unknown;
  createdAt: string;
  admin: { id: string; name: string | null; email: string | null } | null;
};

const ACTIONS = [
  'POS_CHECKOUT', 'POS_QUICK_SALE', 'POS_INVOICE_VOID', 'POS_REFUND',
  'POS_SHIFT_OPEN', 'POS_SHIFT_CLOSE',
  'POS_PRODUCT_UPDATE', 'POS_PRODUCT_DELETE',
  'POS_STOCK_IN', 'POS_STOCK_OUT', 'POS_STOCK_ADJUST',
  'POS_SETTINGS_UPDATE',
];

export function AuditClient() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load() {
    const p = new URLSearchParams();
    if (action) p.set('action', action);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const r = await fetch(`/api/sport/pos/audit?${p}`);
    if (r.ok) setLogs(await r.json());
  }
  useEffect(() => { load(); }, [action, from, to]);

  return (
    <div className="wrapper py-6 max-w-6xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-2xl font-bold">Audit Log</h1>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
        <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700">
          <option value="">ทุก action</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">เวลา</th>
              <th className="px-4 py-2">ผู้ใช้</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">ไม่มีข้อมูล</td></tr>
            ) : logs.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString('th-TH')}</td>
                <td className="px-4 py-2 text-xs">{l.admin?.name || l.admin?.email || l.admin?.id || '-'}</td>
                <td className="px-4 py-2 text-xs font-mono">{l.action}</td>
                <td className="px-4 py-2 text-xs font-mono text-gray-500">{l.targetId || '-'}</td>
                <td className="px-4 py-2 text-xs font-mono text-gray-500 max-w-md truncate">
                  {l.details ? JSON.stringify(l.details) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
