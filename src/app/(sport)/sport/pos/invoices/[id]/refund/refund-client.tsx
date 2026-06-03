'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SnapItem = { productId?: string; productName: string; qty: number; unitPrice: number; discount?: number };

function lineNet(it: SnapItem, refundQty: number): number {
  if (!it.qty || it.qty <= 0) return 0;
  const lineTotal = it.unitPrice * it.qty - (it.discount || 0);
  return +(lineTotal * (refundQty / it.qty)).toFixed(2);
}
type Refund = { id: string; refundNo: string; amount: number; method: string; reason: string | null; createdAt: string; itemsSnapshot?: SnapItem[] | null };
type Invoice = {
  id: string; invoiceNo: string; status: string; total: number; refundedAmount: number;
  itemsSnapshot: SnapItem[] | null;
};

export function RefundClient({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<number, number>>({});
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [i, r] = await Promise.all([
      fetch(`/api/sport/pos/invoices/${invoiceId}`).then((x) => x.json()),
      fetch(`/api/sport/pos/refunds?invoiceId=${invoiceId}`).then((x) => x.json()),
    ]);
    setInv(i);
    setRefunds(Array.isArray(r) ? r : []);
  }
  useEffect(() => { load(); }, [invoiceId]);

  const items = inv?.itemsSnapshot || [];
  const remaining = inv ? +(inv.total - inv.refundedAmount).toFixed(2) : 0;

  const refundedByPid = useMemo(() => {
    const m = new Map<string, number>();
    for (const rf of refunds) {
      const snap = rf.itemsSnapshot || [];
      for (const s of snap) {
        if (!s.productId) continue;
        m.set(s.productId, (m.get(s.productId) || 0) + (Number(s.qty) || 0));
      }
    }
    return m;
  }, [refunds]);

  const calcAmount = useMemo(() => {
    let sum = 0;
    items.forEach((it, idx) => {
      const q = qtyMap[idx] || 0;
      sum += lineNet(it, q);
    });
    return +sum.toFixed(2);
  }, [qtyMap, items]);

  useEffect(() => {
    if (calcAmount > 0) setAmount(String(calcAmount));
  }, [calcAmount]);

  async function submit() {
    if (!inv) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setMsg('amount ต้องมากกว่า 0'); return; }
    if (amt > remaining + 0.01) { setMsg(`เกินยอดคงเหลือ ${remaining.toFixed(2)}`); return; }
    if (!confirm(`Refund ${amt.toFixed(2)} (${method})?`)) return;

    const itemsPayload = items
      .map((it, idx) => ({ ...it, qty: qtyMap[idx] || 0 }))
      .filter((it) => it.qty > 0 && it.productId);

    setBusy(true); setMsg(null);
    const r = await fetch('/api/sport/pos/refunds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, method, amount: amt, reason, items: itemsPayload }),
    });
    setBusy(false);
    if (!r.ok) { setMsg((await r.json()).error || 'refund failed'); return; }
    setQtyMap({}); setAmount(''); setReason('');
    await load();
    setMsg('สำเร็จ');
  }

  if (!inv) return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="wrapper py-6 max-w-3xl space-y-5">
      <div>
        <Link href="/sport/pos/invoices" className="text-xs text-gray-500 hover:underline">← บิลย้อนหลัง</Link>
        <h1 className="text-xl font-bold">Refund: {inv.invoiceNo}</h1>
        <div className="text-sm text-gray-500 mt-1 tabular-nums">
          ยอดบิล {inv.total.toFixed(2)} | คืนแล้ว {inv.refundedAmount.toFixed(2)} | คงเหลือ <b>{remaining.toFixed(2)}</b>
        </div>
      </div>

      {inv.status !== 'PAID' && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded">
          บิลสถานะ {inv.status} - refund ได้เฉพาะ PAID
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-800 text-sm font-semibold">เลือกสินค้าที่คืน (optional - คืนเข้า stock)</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">สินค้า</th>
              <th className="px-4 py-2 text-right">ราคา</th>
              <th className="px-4 py-2 text-right">ขายไป</th>
              <th className="px-4 py-2 text-right">คืนแล้ว</th>
              <th className="px-4 py-2 text-right w-32">คืน</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {items.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">ไม่มีสินค้าใน snapshot</td></tr>
            ) : items.map((it, idx) => {
              const refQty = it.productId ? (refundedByPid.get(it.productId) || 0) : 0;
              const left = Math.max(0, it.qty - refQty);
              return (
                <tr key={idx}>
                  <td className="px-4 py-2">{it.productName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{it.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{it.qty}</td>
                  <td className="px-4 py-2 text-right text-xs text-gray-500 tabular-nums">{refQty > 0 ? refQty : '-'}</td>
                  <td className="px-4 py-2 text-right">
                    {it.productId && left > 0 ? (
                      <input
                        type="number"
                        min="0"
                        max={left}
                        step="1"
                        value={qtyMap[idx] || ''}
                        onChange={(e) => {
                          const v = Math.min(Number(e.target.value) || 0, left);
                          setQtyMap((m) => ({ ...m, [idx]: v }));
                        }}
                        className="w-20 px-2 py-1 border rounded text-right tabular-nums dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        placeholder={`/${left}`}
                      />
                    ) : <span className="text-xs text-gray-400">{!it.productId ? '-' : 'คืนหมด'}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-lg p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            ยอดคืน (฿)
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded tabular-nums dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </label>
          <label className="block text-sm">
            วิธีคืน
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700">
              <option value="CASH">CASH</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="QR">QR</option>
              <option value="CARD">CARD</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          เหตุผล
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </label>
        {msg && <div className="text-sm text-red-600">{msg}</div>}
        <button
          onClick={submit}
          disabled={busy || inv.status !== 'PAID'}
          className="px-4 py-2 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {busy ? '...' : 'ทำ Refund'}
        </button>
        <button
          onClick={() => router.refresh()}
          className="ml-2 px-4 py-2 rounded border text-sm dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          รีเฟรช
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-800 font-semibold text-sm">ประวัติคืนเงินบิลนี้</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">เลขที่</th>
              <th className="px-4 py-2">เวลา</th>
              <th className="px-4 py-2">วิธี</th>
              <th className="px-4 py-2 text-right">ยอด</th>
              <th className="px-4 py-2">เหตุผล</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {refunds.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">ยังไม่มี</td></tr>
            ) : refunds.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-mono text-xs">{r.refundNo}</td>
                <td className="px-4 py-2 text-xs">{new Date(r.createdAt).toLocaleString('th-TH')}</td>
                <td className="px-4 py-2 text-xs">{r.method}</td>
                <td className="px-4 py-2 text-right text-red-600 tabular-nums">-{r.amount.toFixed(2)}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{r.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
