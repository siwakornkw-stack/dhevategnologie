'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

type Invoice = {
  id: string; invoiceNo: string; type: string; status: string;
  total: number; subtotalProduct: number; subtotalBooking: number; vatAmount: number;
  refundedAmount: number;
  paidAt: string; voidedAt: string | null;
};

export default function InvoicesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [list, setList] = useState<Invoice[]>([]);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  async function load() {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const r = await fetch(`/api/sport/pos/invoices?${p}`);
    setList(await r.json());
  }
  useEffect(() => { load(); }, [status, from, to]);

  async function confirmVoid() {
    if (!voidId) return;
    const reason = voidReason.trim();
    if (!reason) { toast.error('กรอกเหตุผล'); return; }
    setVoidBusy(true);
    const r = await fetch(`/api/sport/pos/invoices/${voidId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    setVoidBusy(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'void ไม่สำเร็จ'); return; }
    toast.success('void บิลแล้ว');
    setVoidId(null);
    setVoidReason('');
    load();
  }

  return (
    <div className="wrapper py-6 max-w-5xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-xl font-bold">บิลย้อนหลัง</h1>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700">
          <option value="">ทุกสถานะ</option>
          <option value="PAID">PAID</option>
          <option value="VOID">VOID</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">เลขบิล</th>
              <th className="px-4 py-2">เวลา</th>
              <th className="px-4 py-2">ประเภท</th>
              <th className="px-4 py-2 text-right">สินค้า</th>
              <th className="px-4 py-2 text-right">สนาม</th>
              <th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">รวม</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {list.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400">ไม่มีข้อมูล</td></tr> :
              list.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNo}</td>
                  <td className="px-4 py-2 text-xs">{new Date(inv.paidAt).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-2 text-xs">{inv.type}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{inv.subtotalProduct.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{inv.subtotalBooking.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{inv.vatAmount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {inv.total.toFixed(2)}
                    {inv.refundedAmount > 0 && (
                      <div className="text-[10px] text-red-600">-{inv.refundedAmount.toFixed(2)} คืน</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <a href={`/sport/pos/invoices/${inv.id}/print`} target="_blank" className="text-indigo-600 dark:text-indigo-400 text-xs hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">พิมพ์</a>
                    {inv.status === 'PAID' && isAdmin && (inv.total - (inv.refundedAmount || 0) > 0.01) && (
                      <Link href={`/sport/pos/invoices/${inv.id}/refund`} className="text-gray-600 dark:text-gray-300 text-xs hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">refund</Link>
                    )}
                    {inv.status === 'PAID' && isAdmin && (
                      <button onClick={() => { setVoidId(inv.id); setVoidReason(''); }} className="text-red-600 text-xs hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">void</button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {voidId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setVoidId(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold">Void บิล</div>
            <label className="block text-sm">
              เหตุผล
              <input
                autoFocus
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmVoid(); }}
                aria-label="เหตุผลที่ void"
                className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setVoidId(null)} className="px-3 py-2 text-sm border dark:border-gray-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิก</button>
              <button onClick={confirmVoid} disabled={voidBusy || !voidReason.trim()} className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{voidBusy ? '...' : 'Void'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
