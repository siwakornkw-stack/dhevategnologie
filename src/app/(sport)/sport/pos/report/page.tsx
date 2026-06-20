'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { businessDayRange, todayIso } from '@/lib/business-day';
import { methodLabel } from '@/lib/payment-methods';

type Report = {
  totals: {
    invoiceCount: number; voidCount: number;
    totalSales: number; totalRefunds: number; netSales: number; totalProduct: number; totalBooking: number;
    totalDiscount: number; totalVat: number;
    totalServiceCharge: number; totalCost: number; grossProfit: number; marginPct: number;
    bookingCount: number;
  };
  byMethod: Record<string, number>;
  byCategory: { category: string; count: number; revenue: number }[];
  topProducts: { productId: string; name: string; qty: number; revenue: number }[];
};

export default function PosReportPage() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<Report | null>(null);

  async function load() {
    const { from: fromDt, to: toDt } = businessDayRange(from, to);
    const r = await fetch(`/api/sport/pos/report?from=${fromDt.toISOString()}&to=${toDt.toISOString()}`);
    setData(await r.json());
  }
  useEffect(() => { load(); }, [from, to]);

  if (!data) return <div className="wrapper py-8 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="wrapper py-6 max-w-5xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-xl font-bold">รายงานยอดขาย</h1>
      </div>

      <div className="flex gap-2 text-sm flex-wrap items-center">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
        <a
          href={(() => {
            const { from: f, to: t } = businessDayRange(from, to);
            return `/api/sport/pos/report/csv?from=${f.toISOString()}&to=${t.toISOString()}`;
          })()}
          className="px-3 py-2 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >ดาวน์โหลด CSV (ภพ.30)</a>
        <button
          onClick={() => window.open(`/sport/pos/report/print?from=${from}&to=${to}`, '_blank')}
          className="px-3 py-2 rounded border border-indigo-500 text-indigo-600 dark:text-indigo-400 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >พิมพ์สรุปการขาย (80mm)</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="ยอดขาย" value={`฿${data.totals.totalSales.toFixed(2)}`} />
        <Stat label="คืนเงิน (refund)" value={`-฿${data.totals.totalRefunds.toFixed(2)}`} tone={data.totals.totalRefunds > 0 ? 'negative' : undefined} />
        <Stat label="ยอดขายสุทธิ" value={`฿${data.totals.netSales.toFixed(2)}`} tone="positive" />
        <Stat label="จำนวนบิล" value={data.totals.invoiceCount.toString()} />
        <Stat label="ยอดสินค้า" value={`฿${data.totals.totalProduct.toFixed(2)}`} />
        <Stat label="ยอดสนาม" value={`฿${data.totals.totalBooking.toFixed(2)}`} />
        <Stat label="ส่วนลดรวม" value={`฿${data.totals.totalDiscount.toFixed(2)}`} />
        <Stat label="VAT รวม" value={`฿${data.totals.totalVat.toFixed(2)}`} />
        <Stat label="Service Charge" value={`฿${data.totals.totalServiceCharge.toFixed(2)}`} />
        <Stat label="ทุนสินค้า" value={`฿${data.totals.totalCost.toFixed(2)}`} />
        <Stat label={`กำไรขั้นต้น (${data.totals.marginPct.toFixed(1)}%)`} value={`฿${data.totals.grossProfit.toFixed(2)}`} tone={data.totals.grossProfit < 0 ? 'negative' : 'positive'} />
        <Stat label="Void" value={data.totals.voidCount.toString()} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4">
        <div className="font-semibold mb-2">ตามวิธีจ่าย</div>
        {Object.keys(data.byMethod).length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> :
          <div className="space-y-1 text-sm">
            {Object.entries(data.byMethod).map(([m, v]) => (
              <div key={m} className="flex justify-between"><span>{methodLabel(m)}</span><span className="tabular-nums">฿{v.toFixed(2)}</span></div>
            ))}
          </div>
        }
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 py-2 font-semibold border-b dark:border-gray-800">ตามหมวด (ประเภทรายการ)</div>
        {data.byCategory.length === 0 && data.totals.totalBooking === 0 ? <div className="p-6 text-center text-xs text-gray-400">ไม่มี</div> :
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
              <tr><th className="px-4 py-2 text-left">หมวด</th><th className="px-4 py-2 text-right">จำนวน</th><th className="px-4 py-2 text-right">ยอด</th></tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {data.totals.totalBooking > 0 && (
                <tr>
                  <td className="px-4 py-2">สนาม</td>
                  <td className="px-4 py-2 text-right tabular-nums">{data.totals.bookingCount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{data.totals.totalBooking.toFixed(2)}</td>
                </tr>
              )}
              {data.byCategory.map((c) => (
                <tr key={c.category}>
                  <td className="px-4 py-2">{c.category}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 py-2 font-semibold border-b dark:border-gray-800">Top สินค้า</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
            <tr><th className="px-4 py-2 text-left">สินค้า</th><th className="px-4 py-2 text-right">ขายได้</th><th className="px-4 py-2 text-right">ยอด</th></tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {data.topProducts.length === 0 ? <tr><td colSpan={3} className="p-6 text-center text-gray-400">ไม่มี</td></tr> :
              data.topProducts.map((p) => (
                <tr key={p.productId}>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.qty}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.revenue.toFixed(2)}</td>
                </tr>
              ))
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
