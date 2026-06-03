'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Report = {
  totals: {
    invoiceCount: number; voidCount: number;
    totalSales: number; totalRefunds: number; netSales: number; totalProduct: number; totalBooking: number;
    totalDiscount: number; totalVat: number;
    totalServiceCharge: number; totalCost: number; grossProfit: number; marginPct: number;
  };
  byMethod: Record<string, number>;
  topProducts: { productId: string; name: string; qty: number; revenue: number }[];
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PosReportPage() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<Report | null>(null);

  async function load() {
    const fromDt = new Date(from); fromDt.setHours(0, 0, 0, 0);
    const toDt = new Date(to); toDt.setHours(23, 59, 59, 999);
    const r = await fetch(`/api/sport/pos/report?from=${fromDt.toISOString()}&to=${toDt.toISOString()}`);
    setData(await r.json());
  }
  useEffect(() => { load(); }, [from, to]);

  if (!data) return <div className="wrapper py-8 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="wrapper py-6 max-w-5xl space-y-4">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-2xl font-bold">รายงานยอดขาย</h1>
      </div>

      <div className="flex gap-2 text-sm flex-wrap items-center">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700" />
        <a
          href={(() => {
            const f = new Date(from); f.setHours(0, 0, 0, 0);
            const t = new Date(to); t.setHours(23, 59, 59, 999);
            return `/api/sport/pos/report/csv?from=${f.toISOString()}&to=${t.toISOString()}`;
          })()}
          className="px-3 py-2 rounded bg-primary-600 text-white text-xs"
        >ดาวน์โหลด CSV (ภพ.30)</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="ยอดขาย" value={`฿${data.totals.totalSales.toFixed(2)}`} />
        <Stat label="คืนเงิน (refund)" value={`-฿${data.totals.totalRefunds.toFixed(2)}`} />
        <Stat label="ยอดขายสุทธิ" value={`฿${data.totals.netSales.toFixed(2)}`} />
        <Stat label="จำนวนบิล" value={data.totals.invoiceCount.toString()} />
        <Stat label="ยอดสินค้า" value={`฿${data.totals.totalProduct.toFixed(2)}`} />
        <Stat label="ยอดสนาม" value={`฿${data.totals.totalBooking.toFixed(2)}`} />
        <Stat label="ส่วนลดรวม" value={`฿${data.totals.totalDiscount.toFixed(2)}`} />
        <Stat label="VAT รวม" value={`฿${data.totals.totalVat.toFixed(2)}`} />
        <Stat label="Service Charge" value={`฿${data.totals.totalServiceCharge.toFixed(2)}`} />
        <Stat label="ทุนสินค้า" value={`฿${data.totals.totalCost.toFixed(2)}`} />
        <Stat label={`กำไรขั้นต้น (${data.totals.marginPct.toFixed(1)}%)`} value={`฿${data.totals.grossProfit.toFixed(2)}`} />
        <Stat label="Void" value={data.totals.voidCount.toString()} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4">
        <div className="font-semibold mb-2">ตามวิธีจ่าย</div>
        {Object.keys(data.byMethod).length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> :
          <div className="space-y-1 text-sm">
            {Object.entries(data.byMethod).map(([m, v]) => (
              <div key={m} className="flex justify-between"><span>{m}</span><span>฿{v.toFixed(2)}</span></div>
            ))}
          </div>
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
                  <td className="px-4 py-2 text-right">{p.qty}</td>
                  <td className="px-4 py-2 text-right">{p.revenue.toFixed(2)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-700/50">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
