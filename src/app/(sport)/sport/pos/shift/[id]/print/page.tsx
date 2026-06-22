'use client';

import { use, useEffect, useState } from 'react';
import { methodLabel } from '@/lib/payment-methods';

type Movement = { id: string; type: 'PAY_IN' | 'PAY_OUT'; amount: number; reason: string | null; createdAt: string };
type Summary = {
  invoiceCount: number; paidCount: number; voidCount: number; refundCount: number;
  grossPaid: number; voidTotal: number; refundTotal: number; netSales: number;
  methodTotals: Record<string, number>;
  bookingByMethod: Record<string, number>;
  byCategory: { category: string; count: number; revenue: number; methods: Record<string, { qty: number; revenue: number }> }[];
  topProducts: { productId: string; name: string; qty: number; revenue: number; methods: Record<string, { qty: number; revenue: number }> }[];
  payIn: number; payOut: number; movements: Movement[];
};
type Shift = {
  id: string; shiftNo: string; cashierId: string;
  status: 'OPEN' | 'CLOSED';
  openingFloat: number; openingNote: string | null;
  openedAt: string; closedAt: string | null;
  countedCash: number | null; closingNote: string | null;
  summary?: Summary;
};
type Settings = { shopName: string; taxId: string | null; address: string | null; paperSize: string };

export default function ShiftPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [shift, setShift] = useState<Shift | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    (async () => {
      const [s, st] = await Promise.all([
        fetch(`/api/sport/pos/shifts/${id}`).then((r) => r.json()),
        fetch(`/api/sport/pos/settings`).then((r) => r.json()),
      ]);
      setShift(s); setSettings(st);
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    })();
  }, [id]);

  if (!shift || !settings) return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>;
  const sm = shift.summary;
  const expected = sm
    ? (shift.openingFloat || 0) + (sm.methodTotals?.CASH || 0) + (sm.payIn || 0) - (sm.payOut || 0)
    : null;
  const diff = expected !== null && shift.countedCash !== null ? +(shift.countedCash - expected).toFixed(2) : null;
  const width = settings.paperSize === '58mm' ? '58mm' : '80mm';

  return (
    <div className="receipt-page bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          @page { size: ${width} auto; margin: 0; }
          body { margin: 0; }
          .no-print, header, footer { display: none !important; }
          .receipt-page { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .receipt { page-break-after: always; page-break-inside: avoid; break-inside: avoid; }
          .receipt:last-child { page-break-after: auto; }
          /* keep each section's rows together so the long summary slip never cuts mid-table */
          .receipt table, .receipt tr { page-break-inside: avoid; break-inside: avoid; }
        }
        .receipt { width: ${width}; margin: 0 auto; background: white; padding: 8px; font-family: 'Tahoma', monospace; font-size: 11px; color: #000; }
        .receipt .center { text-align: center; }
        .receipt .right { text-align: right; }
        .receipt hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
        .receipt table { width: 100%; border-collapse: collapse; }
        .receipt th, .receipt td { padding: 1px 0; }
      `}</style>

      <div className="no-print max-w-md mx-auto mb-3 flex gap-2 justify-end">
        <button onClick={() => window.print()} className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">พิมพ์ซ้ำ</button>
        <button onClick={() => window.close()} className="px-3 py-1 border rounded text-xs">ปิด</button>
      </div>

      <div className="receipt">
        <div className="center" style={{ fontWeight: 'bold', fontSize: '13px' }}>{settings.shopName}</div>
        {settings.taxId && <div className="center">Tax ID {settings.taxId}</div>}
        {settings.address && <div className="center">{settings.address}</div>}
        <div className="center" style={{ fontWeight: 'bold', marginTop: 4 }}>*** {shift.status === 'OPEN' ? 'X-REPORT' : 'Z-REPORT'} ***</div>
        <hr />
        <div>Shift: {shift.shiftNo}</div>
        <div>เปิด: {new Date(shift.openedAt).toLocaleString('th-TH')}</div>
        {shift.closedAt && <div>ปิด: {new Date(shift.closedAt).toLocaleString('th-TH')}</div>}
        <div>สถานะ: {shift.status}</div>
        <hr />
        {sm && (
          <>
            <table>
              <tbody>
                <tr><td>บิลทั้งหมด</td><td className="right">{sm.invoiceCount}</td></tr>
                <tr><td>บิลจ่ายแล้ว</td><td className="right">{sm.paidCount}</td></tr>
                <tr><td>บิล void</td><td className="right">{sm.voidCount}</td></tr>
                <tr><td>คืนเงิน (refund)</td><td className="right">{sm.refundCount}</td></tr>
              </tbody>
            </table>
            <hr />
            <table>
              <tbody>
                <tr><td>ยอดขายรวม</td><td className="right">{sm.grossPaid.toFixed(2)}</td></tr>
                <tr><td>หัก refund</td><td className="right">-{sm.refundTotal.toFixed(2)}</td></tr>
                <tr style={{ fontWeight: 'bold' }}><td>ยอดขายสุทธิ</td><td className="right">{sm.netSales.toFixed(2)}</td></tr>
              </tbody>
            </table>
            <hr />
            <div style={{ fontWeight: 'bold' }}>ตามวิธีจ่าย (สุทธิ):</div>
            <table>
              <tbody>
                {Object.entries(sm.methodTotals).filter(([, v]) => v !== 0).map(([m, v]) => (
                  <tr key={m}><td>{methodLabel(m)}</td><td className="right">{v.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
            {(sm.payIn > 0 || sm.payOut > 0) && (
              <>
                <hr />
                <div style={{ fontWeight: 'bold' }}>Petty cash:</div>
                <table>
                  <tbody>
                    <tr><td>เติม (Pay-in)</td><td className="right">+{sm.payIn.toFixed(2)}</td></tr>
                    <tr><td>ถอน (Pay-out)</td><td className="right">-{sm.payOut.toFixed(2)}</td></tr>
                  </tbody>
                </table>
                {sm.movements.length > 0 && (
                  <table style={{ marginTop: 2 }}>
                    <tbody>
                      {sm.movements.map((m) => (
                        <tr key={m.id} style={{ fontSize: '9px', color: '#444' }}>
                          <td>{m.type === 'PAY_IN' ? '+' : '-'} {m.reason || '-'}</td>
                          <td className="right">{m.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
            <hr />
            <div style={{ fontWeight: 'bold' }}>เงินสดในลิ้นชัก:</div>
            <table>
              <tbody>
                <tr><td>เงินทอนตั้งต้น</td><td className="right">{shift.openingFloat.toFixed(2)}</td></tr>
                <tr><td>+ ขายเงินสด</td><td className="right">{(sm.methodTotals?.CASH || 0).toFixed(2)}</td></tr>
                {sm.payIn > 0 && <tr><td>+ เติม</td><td className="right">{sm.payIn.toFixed(2)}</td></tr>}
                {sm.payOut > 0 && <tr><td>- ถอน</td><td className="right">-{sm.payOut.toFixed(2)}</td></tr>}
                <tr style={{ fontWeight: 'bold' }}><td>ควรมี</td><td className="right">{expected?.toFixed(2)}</td></tr>
                {shift.countedCash !== null && (
                  <>
                    <tr><td>นับจริง</td><td className="right">{shift.countedCash.toFixed(2)}</td></tr>
                    <tr style={{ fontWeight: 'bold' }}><td>ส่วนต่าง</td><td className="right">{(diff! >= 0 ? '+' : '') + diff!.toFixed(2)}</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </>
        )}
        {shift.openingNote && (<><hr /><div>เปิด: {shift.openingNote}</div></>)}
        {shift.closingNote && (<><hr /><div>ปิด: {shift.closingNote}</div></>)}
        <hr />
        <div className="center" style={{ marginTop: '6px' }}>{new Date().toLocaleString('th-TH')}</div>
      </div>

      {sm && (sm.byCategory.length > 0 || sm.topProducts.length > 0 || Object.keys(sm.bookingByMethod).length > 0) && (
        <div className="receipt">
          <div className="center" style={{ fontWeight: 'bold', fontSize: '13px' }}>{settings.shopName}</div>
          <div className="center" style={{ fontWeight: 'bold', marginTop: 4 }}>*** สรุปการขายของกะ ***</div>
          <hr />
          <div>Shift: {shift.shiftNo}</div>
          <div>เปิด: {new Date(shift.openedAt).toLocaleString('th-TH')}</div>
          {shift.closedAt && <div>ปิด: {new Date(shift.closedAt).toLocaleString('th-TH')}</div>}
          {sm.byCategory.length > 0 && (<>
          <hr />
          <div style={{ fontWeight: 'bold' }}>ตามหมวด:</div>
          <table>
            <tbody>
              {sm.byCategory.flatMap((c) => [
                <tr key={c.category} style={{ fontWeight: 'bold' }}>
                  <td>{c.category} <span style={{ color: '#666', fontWeight: 'normal' }}>x{c.count}</span></td>
                  <td className="right">{c.revenue.toFixed(2)}</td>
                </tr>,
                ...Object.entries(c.methods).map(([m, mv]) => (
                  <tr key={c.category + m} style={{ fontSize: '9px', color: '#444' }}>
                    <td>&nbsp;&nbsp;{methodLabel(m)} <span style={{ color: '#888' }}>x{mv.qty}</span></td>
                    <td className="right">{mv.revenue.toFixed(2)}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
          </>)}
          {sm.topProducts.length > 0 && (
            <>
              <hr />
              <div style={{ fontWeight: 'bold' }}>เมนูย่อย:</div>
              <table>
                <tbody>
                  {sm.topProducts.flatMap((p) => [
                    <tr key={p.productId} style={{ fontWeight: 'bold' }}>
                      <td>{p.name} <span style={{ color: '#666', fontWeight: 'normal' }}>x{p.qty}</span></td>
                      <td className="right">{p.revenue.toFixed(2)}</td>
                    </tr>,
                    ...Object.entries(p.methods).map(([m, mv]) => (
                      <tr key={p.productId + m} style={{ fontSize: '9px', color: '#444' }}>
                        <td>&nbsp;&nbsp;{methodLabel(m)} <span style={{ color: '#888' }}>x{mv.qty}</span></td>
                        <td className="right">{mv.revenue.toFixed(2)}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </>
          )}
          {Object.keys(sm.bookingByMethod).length > 0 && (
            <>
              <hr />
              <div style={{ fontWeight: 'bold' }}>ค่าสนาม (ตามวิธีจ่าย):</div>
              <table>
                <tbody>
                  {Object.entries(sm.bookingByMethod).filter(([, v]) => v !== 0).map(([m, v]) => (
                    <tr key={m}><td>{methodLabel(m)}</td><td className="right">{v.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <hr />
          <div className="center" style={{ marginTop: '6px' }}>{new Date().toLocaleString('th-TH')}</div>
        </div>
      )}
    </div>
  );
}
