'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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

  async function load() {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const r = await fetch(`/api/sport/pos/invoices?${p}`);
    setList(await r.json());
  }
  useEffect(() => { load(); }, [status, from, to]);

  async function voidInvoice(id: string) {
    const reason = prompt('เหตุผลที่ void:');
    if (!reason) return;
    const r = await fetch(`/api/sport/pos/invoices/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    if (!r.ok) { alert((await r.json()).error || 'void failed'); return; }
    load();
  }

  return (
    <div className="wrapper py-6 max-w-5xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-2xl font-bold">บิลย้อนหลัง</h1>
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
                  <td className="px-4 py-2 text-right">{inv.subtotalProduct.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{inv.subtotalBooking.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{inv.vatAmount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {inv.total.toFixed(2)}
                    {inv.refundedAmount > 0 && (
                      <div className="text-[10px] text-amber-600">-{inv.refundedAmount.toFixed(2)} คืน</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                    <a href={`/sport/pos/invoices/${inv.id}/print`} target="_blank" className="text-primary-600 text-xs hover:underline">พิมพ์</a>
                    {inv.status === 'PAID' && isAdmin && (inv.total - (inv.refundedAmount || 0) > 0.01) && (
                      <Link href={`/sport/pos/invoices/${inv.id}/refund`} className="text-amber-600 text-xs hover:underline">refund</Link>
                    )}
                    {inv.status === 'PAID' && isAdmin && (
                      <button onClick={() => voidInvoice(inv.id)} className="text-red-600 text-xs hover:underline">void</button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
