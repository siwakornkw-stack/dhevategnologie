'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Item = { id: string; productName: string; qty: number; unitPrice: number; discount: number };
type Tab = {
  id: string; name: string; teamLabel: string | null; bookingId: string | null; status: string;
  items: Item[];
  children: { id: string; name: string; teamLabel: string | null; items: Item[] }[];
  booking: { id: string; timeSlot: string; field: { name: string; pricePerHour: number }; user: { name: string | null }; paidAt: string | null; discountAmount: number | null } | null;
  bookingSubtotal: number;
};
type Settings = { vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED'; vatRate: number };
type Split = { label: string; amount: number; method: string; refNo?: string };

function calcVat(itemsTotal: number, mode: string, rate: number) {
  const r = rate / 100;
  if (mode === 'NONE') return { subtotal: itemsTotal, vat: 0, total: itemsTotal };
  if (mode === 'INCLUDED') { const vat = +(itemsTotal * r / (1 + r)).toFixed(2); return { subtotal: +(itemsTotal - vat).toFixed(2), vat, total: itemsTotal }; }
  const vat = +(itemsTotal * r).toFixed(2);
  return { subtotal: itemsTotal, vat, total: +(itemsTotal + vat).toFixed(2) };
}

export default function CheckoutPage({ params }: { params: Promise<{ tabId: string }> }) {
  const { tabId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [includeBooking, setIncludeBooking] = useState(true);
  const [discount, setDiscount] = useState('0');
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<Split[]>([]);
  const [payMethod, setPayMethod] = useState<'CASH' | 'QR' | 'TRANSFER' | 'CARD'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [refNo, setRefNo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, s] = await Promise.all([
        fetch(`/api/sport/pos/tabs/${tabId}`).then((r) => r.json()),
        fetch(`/api/sport/pos/settings`).then((r) => r.json()),
      ]);
      setTab(t);
      setSettings(s);
    })();
  }, [tabId]);

  useEffect(() => {
    if (!tab || !settings) return;
    if (splits.length > 0) return;
    if (!(tab.children?.length > 0 || tab.bookingId)) return;
    const all = [tab, ...tab.children];
    const perTeam: { label: string; sub: number }[] = [];
    for (const x of all) {
      const sub = x.items.reduce((s: number, i: Item) => s + (i.unitPrice * i.qty - i.discount), 0);
      perTeam.push({ label: x.teamLabel || x.name, sub });
    }
    const book = includeBooking && tab.booking && !tab.booking.paidAt ? tab.bookingSubtotal : 0;
    if (book > 0 && perTeam.length > 0) perTeam[0].sub += book;
    const rawSum = perTeam.reduce((s, x) => s + x.sub, 0);
    const discN = Number(discount) || 0;
    const baseT = Math.max(rawSum - discN, 0);
    const v = calcVat(baseT, settings.vatMode, settings.vatRate);
    const init: Split[] = perTeam
      .filter((x) => x.sub > 0)
      .map((x) => ({ label: x.label, amount: +(rawSum > 0 ? (x.sub / rawSum) * v.total : 0).toFixed(2), method: 'CASH' }));
    if (init.length > 0) {
      const sumNow = init.reduce((s, x) => s + x.amount, 0);
      init[init.length - 1].amount = +(init[init.length - 1].amount + (v.total - sumNow)).toFixed(2);
    }
    setSplits(init);
  }, [tab, settings, includeBooking, discount, splits.length]);

  if (!tab || !settings) return <div className="wrapper py-8 text-gray-400">กำลังโหลด...</div>;

  const allItems = [tab, ...tab.children].flatMap((t) => t.items.map((i) => ({ ...i, tabName: t.name, teamLabel: t.teamLabel })));
  const subtotalProduct = allItems.reduce((s, i) => s + (i.unitPrice * i.qty - i.discount), 0);

  const subtotalBooking = includeBooking && tab.booking && !tab.booking.paidAt ? tab.bookingSubtotal : 0;

  const discNum = Number(discount) || 0;
  const base = Math.max(subtotalProduct + subtotalBooking - discNum, 0);
  const { subtotal, vat, total } = calcVat(base, settings.vatMode, settings.vatRate);
  const splitSum = splits.reduce((s, x) => s + Number(x.amount || 0), 0);
  const change = Math.max((Number(cashReceived) || 0) - total, 0);

  async function submit() {
    setBusy(true);
    const body: Record<string, unknown> = {
      tabId,
      includeBooking,
      discount: discNum,
      ...(splitMode
        ? { splits }
        : {
            payment: {
              method: payMethod,
              amount: total,
              cashReceived: payMethod === 'CASH' ? Number(cashReceived) || total : undefined,
              refNo: refNo || undefined,
            },
          }),
    };
    const r = await fetch('/api/sport/pos/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) { alert((await r.json()).error || 'ชำระไม่สำเร็จ'); return; }
    const inv = await r.json();
    window.open(`/sport/pos/invoices/${inv.id}/print`, '_blank');
    router.push('/sport/pos/tabs');
  }

  return (
    <div className="wrapper py-6 max-w-3xl space-y-4">
      <div>
        <Link href="/sport/pos/tabs" className="text-xs text-gray-500 hover:underline">← Tabs</Link>
        <h1 className="text-2xl font-bold">Checkout · {tab.name}</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 p-4 space-y-3">
        <div className="text-sm font-semibold">รายการสินค้า</div>
        {allItems.length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> : (
          <table className="w-full text-sm">
            <tbody className="divide-y dark:divide-gray-800">
              {allItems.map((it) => (
                <tr key={it.id}>
                  <td className="py-1 text-xs text-gray-500 w-32">[{it.teamLabel || it.tabName}]</td>
                  <td className="py-1">{it.productName} x{it.qty}</td>
                  <td className="py-1 text-right">{(it.unitPrice * it.qty - it.discount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab.booking && (
          <div className="border-t dark:border-gray-800 pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeBooking} onChange={(e) => setIncludeBooking(e.target.checked)} disabled={!!tab.booking.paidAt} />
              รวมค่าสนาม: {tab.booking.field.name} {tab.booking.timeSlot}
              {tab.booking.paidAt ? <span className="text-xs text-green-600">(จ่ายแล้ว)</span> : <span className="ml-2 font-semibold">฿{subtotalBooking.toFixed(2)}</span>}
            </label>
          </div>
        )}

        <div className="border-t dark:border-gray-800 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal สินค้า</span><span>{subtotalProduct.toFixed(2)}</span></div>
          {subtotalBooking > 0 && <div className="flex justify-between"><span>Subtotal สนาม</span><span>{subtotalBooking.toFixed(2)}</span></div>}
          <div className="flex justify-between items-center">
            <span>ส่วนลด</span>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700" />
          </div>
          {settings.vatMode !== 'NONE' && (
            <div className="flex justify-between text-gray-500"><span>VAT {settings.vatRate}% ({settings.vatMode === 'INCLUDED' ? 'incl' : 'excl'})</span><span>{vat.toFixed(2)}</span></div>
          )}
          {settings.vatMode === 'EXCLUDED' && <div className="flex justify-between text-xs text-gray-400"><span>Pre-VAT</span><span>{subtotal.toFixed(2)}</span></div>}
          <div className="flex justify-between text-lg font-bold border-t dark:border-gray-800 pt-2"><span>TOTAL</span><span>฿{total.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} /> แยกจ่าย (split)
        </label>

        {!splitMode ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {(['CASH', 'QR', 'TRANSFER', 'CARD'] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)} className={`px-3 py-1 rounded text-xs ${payMethod === m ? 'bg-primary-600 text-white' : 'border dark:border-gray-700'}`}>{m}</button>
              ))}
            </div>
            {payMethod === 'CASH' ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-center text-sm">
                  <span className="w-16">รับเงิน</span>
                  <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex gap-1">
                  {[100, 500, 1000, 2000].map((n) => (
                    <button key={n} onClick={() => setCashReceived(String(n))} className="px-2 py-1 text-xs rounded border dark:border-gray-700">{n}</button>
                  ))}
                </div>
                <div className="flex justify-between text-sm"><span>เงินทอน</span><span className="font-semibold">{change.toFixed(2)}</span></div>
              </div>
            ) : (
              <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="ref no" className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
            )}
          </>
        ) : (
          <div className="space-y-2">
            {splits.map((sp, idx) => (
              <div key={idx} className="flex gap-2 items-center text-sm">
                <input value={sp.label} onChange={(e) => setSplits(splits.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} placeholder="ทีม" className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
                <input type="number" value={sp.amount} onChange={(e) => setSplits(splits.map((x, i) => i === idx ? { ...x, amount: Number(e.target.value) } : x))} className="w-28 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700" />
                <select value={sp.method} onChange={(e) => setSplits(splits.map((x, i) => i === idx ? { ...x, method: e.target.value } : x))} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700">
                  {['CASH', 'QR', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => setSplits(splits.filter((_, i) => i !== idx))} className="text-red-500 text-xs">✕</button>
              </div>
            ))}
            <button onClick={() => setSplits([...splits, { label: '', amount: 0, method: 'CASH' }])} className="text-xs text-primary-600 hover:underline">+ เพิ่ม split</button>
            <div className={`text-xs ${Math.abs(splitSum - total) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
              ผลรวม split: {splitSum.toFixed(2)} / {total.toFixed(2)}
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || total <= 0 || (splitMode && Math.abs(splitSum - total) > 0.01) || (!splitMode && payMethod === 'CASH' && Number(cashReceived) < total)}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50"
        >
          {busy ? 'กำลังบันทึก...' : 'ยืนยัน + พิมพ์บิล'}
        </button>
      </div>
    </div>
  );
}
