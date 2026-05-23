'use client';

import { use, useEffect, useState } from 'react';

type SnapItem = { tabName?: string; productName: string; qty: number; unitPrice: number; discount: number };
type Payment = { method: string; amount: number; cashReceived: number | null; changeAmount: number | null; refNo: string | null };
type Split = { label: string; amount: number; method: string; refNo: string | null };
type Invoice = {
  invoiceNo: string; type: string; status: string;
  subtotalProduct: number; subtotalBooking: number; discount: number;
  vatMode: string; vatRate: number; vatAmount: number; total: number;
  paidAt: string; voidedAt: string | null; voidReason: string | null;
  itemsSnapshot: SnapItem[] | null;
  payments: Payment[]; splits: Split[];
};
type Settings = { shopName: string; taxId: string | null; address: string | null; paperSize: string; receiptHeader: string | null; receiptFooter: string | null };

export default function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    (async () => {
      const [i, s] = await Promise.all([
        fetch(`/api/sport/pos/invoices/${id}`).then((r) => r.json()),
        fetch(`/api/sport/pos/settings`).then((r) => r.json()),
      ]);
      setInv(i); setSettings(s);
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    })();
  }, [id]);

  if (!inv || !settings) return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>;

  const items = inv.itemsSnapshot || [];
  const width = settings.paperSize === '58mm' ? '58mm' : '80mm';

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          @page { size: ${width} auto; margin: 0; }
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        .receipt { width: ${width}; margin: 0 auto; background: white; padding: 8px; font-family: 'Tahoma', monospace; font-size: 11px; color: #000; }
        .receipt .center { text-align: center; }
        .receipt .right { text-align: right; }
        .receipt hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
        .receipt table { width: 100%; border-collapse: collapse; }
        .receipt th, .receipt td { padding: 1px 0; }
      `}</style>

      <div className="no-print max-w-md mx-auto mb-3 flex gap-2 justify-end">
        <button onClick={() => window.print()} className="px-3 py-1 bg-primary-600 text-white text-xs rounded">พิมพ์ซ้ำ</button>
        <button onClick={() => window.close()} className="px-3 py-1 border rounded text-xs">ปิด</button>
      </div>

      <div className="receipt">
        <div className="center" style={{ fontWeight: 'bold', fontSize: '13px' }}>{settings.shopName}</div>
        {settings.taxId && <div className="center">Tax ID {settings.taxId}</div>}
        {settings.address && <div className="center">{settings.address}</div>}
        {settings.receiptHeader && <div className="center">{settings.receiptHeader}</div>}
        <hr />
        <div>Invoice: {inv.invoiceNo}</div>
        <div>{new Date(inv.paidAt).toLocaleString('th-TH')}</div>
        {inv.status === 'VOID' && <div style={{ color: 'red', fontWeight: 'bold' }}>*** VOID ***</div>}
        <hr />
        <table>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>{it.productName}{it.tabName && <span style={{ color: '#666', fontSize: '9px' }}> [{it.tabName}]</span>}</td>
                <td className="right" style={{ width: '40px' }}>x{it.qty}</td>
                <td className="right" style={{ width: '55px' }}>{(it.unitPrice * it.qty - it.discount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inv.subtotalBooking > 0 && (
          <>
            <hr />
            <div className="right">ค่าสนาม: {inv.subtotalBooking.toFixed(2)}</div>
          </>
        )}
        <hr />
        <table>
          <tbody>
            <tr><td>Subtotal สินค้า</td><td className="right">{inv.subtotalProduct.toFixed(2)}</td></tr>
            {inv.subtotalBooking > 0 && <tr><td>Subtotal สนาม</td><td className="right">{inv.subtotalBooking.toFixed(2)}</td></tr>}
            {inv.discount > 0 && <tr><td>ส่วนลด</td><td className="right">-{inv.discount.toFixed(2)}</td></tr>}
            {inv.vatMode !== 'NONE' && <tr><td>VAT {inv.vatRate}% ({inv.vatMode === 'INCLUDED' ? 'incl' : 'excl'})</td><td className="right">{inv.vatAmount.toFixed(2)}</td></tr>}
            <tr style={{ fontWeight: 'bold', fontSize: '13px' }}><td>TOTAL</td><td className="right">{inv.total.toFixed(2)}</td></tr>
          </tbody>
        </table>
        <hr />
        {inv.splits.length > 0 ? (
          <>
            <div style={{ fontWeight: 'bold' }}>แยกจ่าย:</div>
            <table>
              <tbody>
                {inv.splits.map((sp, i) => (
                  <tr key={i}>
                    <td>{sp.label} [{sp.method}]{sp.refNo ? ` ${sp.refNo}` : ''}</td>
                    <td className="right">{sp.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          inv.payments.map((p, i) => (
            <div key={i}>
              <div>ชำระ ({p.method}): {p.amount.toFixed(2)}</div>
              {p.cashReceived !== null && <div>รับเงินสด: {p.cashReceived.toFixed(2)}</div>}
              {p.changeAmount !== null && <div>ทอน: {p.changeAmount.toFixed(2)}</div>}
              {p.refNo && <div>Ref: {p.refNo}</div>}
            </div>
          ))
        )}
        <hr />
        {settings.receiptFooter && <div className="center">{settings.receiptFooter}</div>}
        <div className="center" style={{ marginTop: '6px' }}>ขอบคุณที่ใช้บริการ</div>
      </div>
    </div>
  );
}
