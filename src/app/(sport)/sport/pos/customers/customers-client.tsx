'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Customer = { id: string; name: string | null; email: string | null; phone: string | null; points: number };
type Invoice = {
  id: string; invoiceNo: string; status: string; total: number; refundedAmount: number;
  paidAt: string; pointsEarned: number; pointsRedeemed: number; type: string;
};

export function CustomersClient() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invBusy, setInvBusy] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (q.trim().length < 2) { setList([]); return; }
      setBusy(true);
      const r = await fetch(`/api/sport/pos/customers?q=${encodeURIComponent(q.trim())}`);
      setBusy(false);
      if (r.ok) setList(await r.json());
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  async function pick(c: Customer) {
    setSelected(c);
    setInvoices(null);
    setInvBusy(true);
    const r = await fetch(`/api/sport/pos/invoices?customerId=${c.id}&limit=50`);
    setInvBusy(false);
    if (r.ok) setInvoices(await r.json());
  }

  const totalSpent = invoices?.filter((i) => i.status === 'PAID').reduce((s, i) => s + (i.total - (i.refundedAmount || 0)), 0) || 0;
  const paidCount = invoices?.filter((i) => i.status === 'PAID').length || 0;

  return (
    <div className="wrapper py-6 max-w-6xl space-y-5">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS Hub</Link>
        <h1 className="text-2xl font-bold">ลูกค้า</h1>
        <p className="text-sm text-gray-500 mt-1">ค้นชื่อ/อีเมล/เบอร์ ดูแต้ม + ประวัติซื้อ</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-lg p-4">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="พิมพ์ชื่อ / เบอร์ / อีเมล (>=2 ตัว)"
          className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
        />
        {busy && <div className="text-xs text-gray-400 mt-2">กำลังค้น...</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-800 text-sm font-semibold">ผลการค้นหา ({list.length})</div>
          <div className="max-h-[60vh] overflow-auto">
            {list.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">{q.trim().length < 2 ? 'พิมพ์เพื่อค้น' : 'ไม่พบ'}</div>
            ) : list.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c)}
                className={`w-full text-left px-4 py-3 border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  selected?.id === c.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                }`}
              >
                <div className="text-sm font-medium">{c.name || '(ไม่มีชื่อ)'}</div>
                <div className="text-xs text-gray-500">{c.phone || '-'} · {c.email || '-'}</div>
                <div className="text-xs text-primary-600 mt-1">แต้ม: {c.points}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-lg overflow-hidden">
          {!selected ? (
            <div className="p-8 text-center text-xs text-gray-400">เลือกลูกค้าเพื่อดูประวัติ</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b dark:border-gray-800">
                <div className="text-sm font-semibold">{selected.name || '(ไม่มีชื่อ)'}</div>
                <div className="text-xs text-gray-500 mt-1">{selected.phone || '-'} · {selected.email || '-'}</div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span>แต้มคงเหลือ: <b className="text-primary-600">{selected.points}</b></span>
                  <span>บิลที่จ่าย: <b>{paidCount}</b></span>
                  <span>ยอดสุทธิ: <b>{totalSpent.toFixed(2)}</b></span>
                </div>
              </div>
              <div className="max-h-[55vh] overflow-auto">
                {invBusy ? (
                  <div className="p-6 text-center text-xs text-gray-400">กำลังโหลด...</div>
                ) : !invoices || invoices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">ไม่มีบิล</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-left text-gray-500">
                      <tr>
                        <th className="px-3 py-2">เลขบิล</th>
                        <th className="px-3 py-2">วันที่</th>
                        <th className="px-3 py-2">ประเภท</th>
                        <th className="px-3 py-2">สถานะ</th>
                        <th className="px-3 py-2 text-right">ยอด</th>
                        <th className="px-3 py-2 text-right">คืน</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {invoices.map((i) => (
                        <tr key={i.id}>
                          <td className="px-3 py-2 font-mono">{i.invoiceNo}</td>
                          <td className="px-3 py-2">{new Date(i.paidAt).toLocaleString('th-TH')}</td>
                          <td className="px-3 py-2">{i.type}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              i.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                              'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>{i.status}</span>
                          </td>
                          <td className="px-3 py-2 text-right">{i.total.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-red-600">{i.refundedAmount > 0 ? '-' + i.refundedAmount.toFixed(2) : '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <Link href={`/sport/pos/invoices/${i.id}/print`} target="_blank" className="text-primary-600 hover:underline">พิมพ์</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
