'use client';

import { useEffect, useState } from 'react';

type Report = {
  totals: {
    invoiceCount: number; voidCount: number;
    totalSales: number; totalRefunds: number; netSales: number; totalProduct: number; totalBooking: number;
    totalDiscount: number; totalVat: number; totalServiceCharge: number;
  };
  byMethod: Record<string, number>;
  byCategory: { category: string; count: number; revenue: number }[];
  topProducts: { productId: string; name: string; qty: number; revenue: number }[];
};
type Settings = { shopName: string; taxId: string | null; address: string | null; paperSize: string };

export default function SalesReportPrintPage() {
  const [data, setData] = useState<Report | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [error, setError] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const fromStr = sp.get('from') || '';
    const toStr = sp.get('to') || '';
    const f = new Date(fromStr); f.setHours(0, 0, 0, 0);
    const t = new Date(toStr); t.setHours(23, 59, 59, 999);
    setRange({ from: fromStr, to: toStr });
    (async () => {
      const [rRes, sRes] = await Promise.all([
        fetch(`/api/sport/pos/report?from=${f.toISOString()}&to=${t.toISOString()}`),
        fetch('/api/sport/pos/settings'),
      ]);
      if (!rRes.ok || !sRes.ok) { setError(true); return; }
      const [r, s] = await Promise.all([rRes.json(), sRes.json()]);
      setData(r); setSettings(s);
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    })();
  }, []);

  if (error) return <div className="p-8 text-center text-gray-400">โหลดรายงานไม่สำเร็จ หรือไม่มีสิทธิ์</div>;
  if (!data || !settings) return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>;

  const width = settings.paperSize === '58mm' ? '58mm' : '80mm';
  const t = data.totals;
  const fmtD = (s: string) => (s ? new Date(s).toLocaleDateString('th-TH') : '-');

  return (
    <div className="receipt-page bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          @page { size: ${width} auto; margin: 0; }
          body { margin: 0; }
          .no-print, header, footer { display: none !important; }
          .receipt-page { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
        }
        .receipt { width: ${width}; margin: 0 auto; background: white; padding: 8px; font-family: 'Tahoma', monospace; font-size: 11px; color: #000; }
        .receipt .center { text-align: center; }
        .receipt .right { text-align: right; }
        .receipt hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
        .receipt table { width: 100%; border-collapse: collapse; }
        .receipt th, .receipt td { padding: 1px 0; vertical-align: top; }
      `}</style>

      <div className="no-print max-w-md mx-auto mb-3 flex gap-2 justify-end">
        <button onClick={() => window.print()} className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">พิมพ์ซ้ำ</button>
        <button onClick={() => window.close()} className="px-3 py-1 border rounded text-xs">ปิด</button>
      </div>

      <div className="receipt">
        <div className="center" style={{ fontWeight: 'bold', fontSize: '13px' }}>{settings.shopName}</div>
        {settings.taxId && <div className="center">Tax ID {settings.taxId}</div>}
        {settings.address && <div className="center">{settings.address}</div>}
        <div className="center" style={{ fontWeight: 'bold', marginTop: 4 }}>*** สรุปการขาย ***</div>
        <hr />
        <div>ช่วง: {fmtD(range.from)} – {fmtD(range.to)}</div>
        <div>พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</div>
        <hr />
        <table>
          <tbody>
            <tr><td>ยอดขายรวม</td><td className="right">{t.totalSales.toFixed(2)}</td></tr>
            <tr><td>หัก refund</td><td className="right">-{t.totalRefunds.toFixed(2)}</td></tr>
            <tr style={{ fontWeight: 'bold' }}><td>ยอดขายสุทธิ</td><td className="right">{t.netSales.toFixed(2)}</td></tr>
            <tr><td>จำนวนบิล</td><td className="right">{t.invoiceCount}</td></tr>
            <tr><td>ยอดสินค้า</td><td className="right">{t.totalProduct.toFixed(2)}</td></tr>
            <tr><td>ยอดค่าสนาม</td><td className="right">{t.totalBooking.toFixed(2)}</td></tr>
            {t.totalDiscount > 0 && <tr><td>ส่วนลดรวม</td><td className="right">-{t.totalDiscount.toFixed(2)}</td></tr>}
            {t.totalVat > 0 && <tr><td>VAT</td><td className="right">{t.totalVat.toFixed(2)}</td></tr>}
          </tbody>
        </table>
        <hr />
        <div style={{ fontWeight: 'bold' }}>การรับชำระ:</div>
        <table>
          <tbody>
            {Object.entries(data.byMethod).filter(([, v]) => v !== 0).map(([m, v]) => (
              <tr key={m}><td>{m}</td><td className="right">{v.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
        <hr />
        <div style={{ fontWeight: 'bold' }}>ตามหมวด:</div>
        <table>
          <tbody>
            {data.byCategory.length === 0 ? <tr><td colSpan={2} style={{ color: '#666' }}>-</td></tr> :
              data.byCategory.map((c) => (
                <tr key={c.category}>
                  <td>{c.category} <span style={{ color: '#666' }}>x{c.count}</span></td>
                  <td className="right">{c.revenue.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {data.topProducts.length > 0 && (
          <>
            <hr />
            <div style={{ fontWeight: 'bold' }}>เมนูย่อย (top {data.topProducts.length}):</div>
            <table>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name} <span style={{ color: '#666' }}>x{p.qty}</span></td>
                    <td className="right">{p.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <hr />
        <div className="center" style={{ marginTop: '6px' }}>{settings.shopName}</div>
      </div>
    </div>
  );
}
