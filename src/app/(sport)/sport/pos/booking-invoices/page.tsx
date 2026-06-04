'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Snap = { fieldName?: string; date?: string; timeSlot?: string; amount?: number };
type Invoice = {
  id: string; invoiceNo: string; status: string; total: number; refundedAmount: number; paidAt: string;
  relatedInvoiceId: string | null;
  relatedInvoice: { id: string; invoiceNo: string } | null;
  itemsSnapshot: Snap[] | null;
};
type Report = {
  totals: { invoiceCount: number; voidCount: number; totalBooking: number; totalRefunds: number; netBooking: number };
  byMethod: Record<string, number>;
  byField: { fieldId: string; fieldName: string; count: number; amount: number }[];
  byDay: { date: string; count: number; amount: number }[];
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookingInvoicesPage() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [report, setReport] = useState<Report | null>(null);
  const [list, setList] = useState<Invoice[]>([]);

  function range() {
    const f = new Date(from); f.setHours(0, 0, 0, 0);
    const t = new Date(to); t.setHours(23, 59, 59, 999);
    return { f: f.toISOString(), t: t.toISOString() };
  }

  async function load() {
    const { f, t } = range();
    const [rep, inv] = await Promise.all([
      fetch(`/api/sport/pos/report/bookings?from=${f}&to=${t}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/sport/pos/invoices?type=BOOKING&from=${f}&to=${t}&limit=500`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setReport(rep && rep.totals ? rep : null);
    setList(Array.isArray(inv) ? inv : []);
  }
  useEffect(() => { load(); }, [from, to]);

  const csvHref = (() => { const { f, t } = range(); return `/api/sport/pos/report/bookings/csv?from=${f}&to=${t}`; })();

  return (
    <div className="wrapper py-6 max-w-5xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-xl font-bold">บิลค่าสนาม</h1>
        <p className="text-xs text-gray-500 mt-1">ค่าสนามที่จ่ายผ่าน POS ถูกแยกเป็นบิลของตัวเอง ลิงก์กลับไปยังบิลสินค้าต้นทางได้</p>
      </div>

      <div className="flex gap-2 text-sm flex-wrap items-center">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
        <a href={csvHref} className="px-3 py-2 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ดาวน์โหลด CSV</a>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="ยอดค่าสนาม" value={`฿${report.totals.totalBooking.toFixed(2)}`} />
            <Stat label="คืนเงิน" value={`-฿${report.totals.totalRefunds.toFixed(2)}`} tone={report.totals.totalRefunds > 0 ? 'negative' : undefined} />
            <Stat label="ยอดสุทธิ" value={`฿${report.totals.netBooking.toFixed(2)}`} tone="positive" />
            <Stat label="จำนวนบิล" value={report.totals.invoiceCount.toString()} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4">
              <div className="font-semibold mb-2">แยกตามสนาม</div>
              {report.byField.length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> :
                <div className="space-y-1 text-sm">
                  {report.byField.map((f) => (
                    <div key={f.fieldId} className="flex justify-between"><span>{f.fieldName} <span className="text-xs text-gray-400">({f.count})</span></span><span className="tabular-nums">฿{f.amount.toFixed(2)}</span></div>
                  ))}
                </div>
              }
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4">
              <div className="font-semibold mb-2">ตามวิธีจ่าย</div>
              {Object.keys(report.byMethod).length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> :
                <div className="space-y-1 text-sm">
                  {Object.entries(report.byMethod).map(([m, v]) => (
                    <div key={m} className="flex justify-between"><span>{m}</span><span className="tabular-nums">฿{v.toFixed(2)}</span></div>
                  ))}
                </div>
              }
            </div>
          </div>
        </>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">เลขบิล</th>
              <th className="px-4 py-2">เวลา</th>
              <th className="px-4 py-2">สนาม</th>
              <th className="px-4 py-2 text-right">ยอด</th>
              <th className="px-4 py-2">บิลต้นทาง</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {list.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-gray-400">ไม่มีข้อมูล</td></tr> :
              list.map((inv) => {
                const s = (inv.itemsSnapshot || [])[0] || {};
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNo}</td>
                    <td className="px-4 py-2 text-xs">{new Date(inv.paidAt).toLocaleString('th-TH')}</td>
                    <td className="px-4 py-2 text-xs">{s.fieldName || '-'}{s.timeSlot && <span className="text-gray-400"> {s.timeSlot}</span>}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {inv.total.toFixed(2)}
                      {inv.refundedAmount > 0 && <div className="text-[10px] text-red-600">-{inv.refundedAmount.toFixed(2)} คืน</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {inv.relatedInvoice ? (
                        <a href={`/sport/pos/invoices/${inv.relatedInvoice.id}/print`} target="_blank" className="text-indigo-600 dark:text-indigo-400 font-mono hover:underline">{inv.relatedInvoice.invoiceNo}</a>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <a href={`/sport/pos/invoices/${inv.id}/print`} target="_blank" className="text-indigo-600 dark:text-indigo-400 text-xs hover:underline">พิมพ์</a>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const toneClass = tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'negative' ? 'text-red-600' : '';
  return (
    <div className="p-4 rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-700/50">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold mt-1 tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
