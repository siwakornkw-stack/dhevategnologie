'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Item = { id: string; productName: string; qty: number; unitPrice: number; discount: number };
type Tab = {
  id: string; name: string; teamLabel: string | null; bookingId: string | null; status: string;
  items: Item[];
  children: { id: string; name: string; teamLabel: string | null; items: Item[] }[];
  booking: { id: string; timeSlot: string; field: { name: string; pricePerHour: number }; user: { name: string | null }; paidAt: string | null; discountAmount: number | null } | null;
  bookingSubtotal: number;
};
type Settings = { vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED'; vatRate: number; pointsEarnPerBaht: number; pointsValueBaht: number; serviceChargeRate: number };
type Split = { label: string; amount: number; method: string; refNo?: string; target?: 'PRODUCT' | 'BOOKING' };
type CustomerHit = { id: string; name: string | null; email: string | null; phone: string | null; points: number };
type CustomerInfo = { id?: string | null; name?: string; taxId?: string; address?: string; phone?: string; points?: number };

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
  const [taxInvoice, setTaxInvoice] = useState(false);
  const [cust, setCust] = useState<CustomerInfo>({});
  const [custSearch, setCustSearch] = useState('');
  const [custHits, setCustHits] = useState<CustomerHit[]>([]);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discountType: string; discountValue: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const custSearchSeq = useRef(0);

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
    const productSum = perTeam.reduce((s, x) => s + x.sub, 0);
    const book = includeBooking && tab.booking && !tab.booking.paidAt ? tab.bookingSubtotal : 0;
    // Mirror the totals math: discount/coupon/VAT/points on products only, field charge raw.
    const discN = Number(discount) || 0;
    const baseCoupon = Math.max(productSum - discN, 0);
    const couponDisc = !coupon ? 0
      : coupon.discountType === 'PERCENT' ? Math.round((baseCoupon * coupon.discountValue) / 100)
      : Math.min(coupon.discountValue, baseCoupon);
    const baseT = Math.max(productSum - discN - couponDisc, 0);
    const sc = (settings.serviceChargeRate || 0) > 0 ? +(baseT * (settings.serviceChargeRate || 0) / 100).toFixed(2) : 0;
    const v = calcVat(baseT + sc, settings.vatMode, settings.vatRate);
    const ptVal = settings.pointsValueBaht || 0;
    const ptReq = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
    const ptMaxCart = ptVal > 0 ? Math.floor(v.total / ptVal) : 0;
    const ptUse = Math.min(ptReq, cust.id ? cust.points || 0 : 0, ptMaxCart);
    const productFinal = +Math.max(v.total - ptUse * ptVal, 0).toFixed(2);
    const teams = perTeam.filter((x) => x.sub > 0);
    // Product splits target the product invoice; the field charge gets its own BOOKING-target line.
    let init: Split[];
    if (teams.length > 0) {
      init = teams.map((x) => ({ label: x.label, amount: +(productSum > 0 ? (x.sub / productSum) * productFinal : 0).toFixed(2), method: 'CASH', target: 'PRODUCT' }));
    } else if (productFinal > 0) {
      init = [{ label: perTeam[0]?.label || tab.name, amount: productFinal, method: 'CASH', target: 'PRODUCT' }];
    } else {
      init = [];
    }
    if (init.length > 0) {
      const sumNow = init.reduce((s, x) => s + x.amount, 0);
      init[init.length - 1].amount = +(init[init.length - 1].amount + (productFinal - sumNow)).toFixed(2);
    }
    if (book > 0) init.push({ label: 'ค่าสนาม', amount: book, method: 'CASH', target: 'BOOKING' });
    setSplits(init);
  }, [tab, settings, includeBooking, discount, coupon, pointsToRedeem, cust, splits.length]);

  if (!tab || !settings) return <div className="wrapper py-8 text-gray-400">กำลังโหลด...</div>;

  const allItems = [tab, ...tab.children].flatMap((t) => t.items.map((i) => ({ ...i, tabName: t.name, teamLabel: t.teamLabel })));
  const subtotalProduct = allItems.reduce((s, i) => s + (i.unitPrice * i.qty - i.discount), 0);

  const subtotalBooking = includeBooking && tab.booking && !tab.booking.paidAt ? tab.bookingSubtotal : 0;

  // Field charge is billed raw on its own invoice; discount/coupon/service charge/VAT/points apply to products only.
  const discNum = Number(discount) || 0;
  const baseForCoupon = Math.max(subtotalProduct - discNum, 0);
  const couponDiscount = !coupon ? 0
    : coupon.discountType === 'PERCENT' ? Math.round((baseForCoupon * coupon.discountValue) / 100)
    : Math.min(coupon.discountValue, baseForCoupon);
  const base = Math.max(subtotalProduct - discNum - couponDiscount, 0);
  const scRate = settings.serviceChargeRate || 0;
  const serviceCharge = scRate > 0 ? +(base * scRate / 100).toFixed(2) : 0;
  const { subtotal, vat, total: grossTotal } = calcVat(base + serviceCharge, settings.vatMode, settings.vatRate);

  const ptValue = settings.pointsValueBaht || 0;
  const ptReqRaw = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
  const ptMaxByBalance = cust.id ? cust.points || 0 : 0;
  const ptMaxByCart = ptValue > 0 ? Math.floor(grossTotal / ptValue) : 0;
  const ptUsed = Math.min(ptReqRaw, ptMaxByBalance, ptMaxByCart);
  const redeemValue = +(ptUsed * ptValue).toFixed(2);
  const posFinal = +Math.max(grossTotal - redeemValue, 0).toFixed(2);
  const total = +(posFinal + subtotalBooking).toFixed(2);
  const earnPreview = cust.id && settings.pointsEarnPerBaht > 0 ? Math.floor(posFinal * settings.pointsEarnPerBaht) : 0;

  const splitSum = splits.reduce((s, x) => s + Number(x.amount || 0), 0);
  const hasBookingBill = subtotalBooking > 0;
  const splitBookingSum = splits.filter((x) => x.target === 'BOOKING').reduce((s, x) => s + Number(x.amount || 0), 0);
  const splitProductSum = splits.filter((x) => (x.target ?? 'PRODUCT') !== 'BOOKING').reduce((s, x) => s + Number(x.amount || 0), 0);
  // With a field bill, each side must balance to its own invoice; otherwise the grand total must match.
  const splitOk = hasBookingBill
    ? Math.abs(splitBookingSum - subtotalBooking) < 0.01 && Math.abs(splitProductSum - posFinal) < 0.01
    : Math.abs(splitSum - total) < 0.01;
  const change = Math.max((Number(cashReceived) || 0) - total, 0);

  async function searchCust(q: string) {
    setCustSearch(q);
    if (q.trim().length < 2) { setCustHits([]); return; }
    const seq = ++custSearchSeq.current;
    const r = await fetch(`/api/sport/pos/customers?q=${encodeURIComponent(q.trim())}`);
    if (seq !== custSearchSeq.current) return;
    if (r.ok) setCustHits(await r.json());
  }

  function pickCust(u: CustomerHit) {
    setCust({ id: u.id, name: u.name || '', phone: u.phone || '', taxId: cust.taxId, address: cust.address, points: u.points });
    setCustHits([]);
    setCustSearch(u.name || u.phone || u.email || '');
  }

  async function submit() {
    setBusy(true);
    const customerPayload = taxInvoice && (cust.name || cust.taxId || cust.phone)
      ? { id: cust.id || null, name: cust.name || null, taxId: cust.taxId || null, address: cust.address || null, phone: cust.phone || null }
      : cust.id
        ? { id: cust.id, name: cust.name || null, phone: cust.phone || null }
        : null;
    const body: Record<string, unknown> = {
      tabId,
      includeBooking,
      discount: discNum,
      ...(coupon ? { couponCode: coupon.code } : {}),
      ...(customerPayload ? { customer: customerPayload } : {}),
      ...(cust.id && ptUsed > 0 ? { pointsToRedeem: ptUsed } : {}),
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
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'ชำระไม่สำเร็จ'); return; }
    const inv = await r.json();
    toast.success(!splitMode && payMethod === 'CASH' && change > 0 ? `บันทึกบิลแล้ว · ทอน ฿${change.toFixed(2)}` : 'บันทึกบิลแล้ว');
    const hasCash = splitMode ? splits.some((s) => s.method === 'CASH') : payMethod === 'CASH';
    const kickParam = hasCash ? '?kick=1' : '';
    const w = window.open(`/sport/pos/invoices/${inv.id}/print${kickParam}`, '_blank');
    if (!w) toast.error('เปิดหน้าพิมพ์ไม่ได้ — ตรวจ popup blocker แล้วเปิดบิลจากรายการ invoices', { duration: 8000 });
    router.push('/sport/pos/tabs');
  }

  return (
    <div className="wrapper py-6 max-w-3xl space-y-4">
      <div>
        <Link href="/sport/pos/tabs" className="text-xs text-gray-500 hover:underline">← Tabs</Link>
        <h1 className="text-xl font-bold">Checkout · {tab.name}</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4 space-y-3">
        <div className="text-sm font-semibold">รายการสินค้า</div>
        {allItems.length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> : (
          <table className="w-full text-sm">
            <tbody className="divide-y dark:divide-gray-800">
              {allItems.map((it) => (
                <tr key={it.id}>
                  <td className="py-1 text-xs text-gray-500 w-32">[{it.teamLabel || it.tabName}]</td>
                  <td className="py-1">{it.productName} x{it.qty}</td>
                  <td className="py-1 text-right tabular-nums">{(it.unitPrice * it.qty - it.discount).toFixed(2)}</td>
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
              {tab.booking.paidAt ? <span className="text-xs text-emerald-600">(จ่ายแล้ว)</span> : <span className="ml-2 font-semibold tabular-nums">฿{subtotalBooking.toFixed(2)}</span>}
            </label>
          </div>
        )}

        <div className="border-t dark:border-gray-800 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal สินค้า</span><span className="tabular-nums">{subtotalProduct.toFixed(2)}</span></div>
          {subtotalBooking > 0 && <div className="flex justify-between"><span>Subtotal สนาม</span><span className="tabular-nums">{subtotalBooking.toFixed(2)}</span></div>}
          <div className="flex justify-between items-center">
            <span>ส่วนลด</span>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span>Coupon</span>
              <input
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(null); }}
                disabled={!!coupon || couponBusy}
                placeholder="CODE"
                className="flex-1 px-2 py-1 border rounded uppercase dark:bg-gray-800 dark:border-gray-700 disabled:opacity-50"
              />
              {!coupon ? (
                <button
                  type="button"
                  disabled={couponBusy || !couponInput.trim()}
                  onClick={async () => {
                    setCouponBusy(true); setCouponMsg(null);
                    const code = couponInput.trim().toUpperCase();
                    const r = await fetch(`/api/sport/coupons/validate?code=${encodeURIComponent(code)}`);
                    setCouponBusy(false);
                    if (!r.ok) { const e = await r.json().catch(() => ({})); setCouponMsg(e.error || 'คูปองไม่ถูกต้อง'); return; }
                    const c = await r.json();
                    setCoupon({ code: c.code, discountType: c.discountType, discountValue: c.discountValue });
                  }}
                  className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >{couponBusy ? '...' : 'ใช้'}</button>
              ) : (
                <button type="button" onClick={() => { setCoupon(null); setCouponInput(''); setCouponMsg(null); }} className="px-3 py-1 border rounded text-xs dark:border-gray-700">ลบ</button>
              )}
            </div>
            {couponMsg && <div className="text-xs text-red-500">{couponMsg}</div>}
            {coupon && couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 text-xs"><span>คูปอง {coupon.code} ({coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : `฿${coupon.discountValue}`})</span><span>-{couponDiscount.toFixed(2)}</span></div>
            )}
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between text-gray-500"><span title={`Service charge — ค่าบริการ ${scRate}% ของยอดหลังส่วนลด`} className="underline decoration-dotted cursor-help">Service Charge {scRate}%</span><span className="tabular-nums">{serviceCharge.toFixed(2)}</span></div>
          )}
          {settings.vatMode !== 'NONE' && (
            <div className="flex justify-between text-gray-500"><span title={settings.vatMode === 'INCLUDED' ? 'VAT รวมในราคาแล้ว — แสดงเพื่ออ้างอิง ไม่บวกเพิ่ม' : 'VAT บวกเพิ่มจากยอด (ราคายังไม่รวม VAT)'} className="underline decoration-dotted cursor-help">VAT {settings.vatRate}% ({settings.vatMode === 'INCLUDED' ? 'incl' : 'excl'})</span><span className="tabular-nums">{vat.toFixed(2)}</span></div>
          )}
          {settings.vatMode === 'EXCLUDED' && <div className="flex justify-between text-xs text-gray-400"><span>Pre-VAT</span><span className="tabular-nums">{subtotal.toFixed(2)}</span></div>}
          {redeemValue > 0 && (
            <div className="flex justify-between text-emerald-600"><span>ส่วนลดจากแต้ม ({ptUsed} pt)</span><span className="tabular-nums">-{redeemValue.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-lg font-bold border-t dark:border-gray-800 pt-2"><span>TOTAL</span><span className="tabular-nums">฿{total.toFixed(2)}</span></div>
          {earnPreview > 0 && <div className="text-xs text-emerald-600 text-right">+ จะได้รับ {earnPreview} แต้ม</div>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4 space-y-2">
        <div className="text-sm font-semibold">ลูกค้า (optional)</div>
        <div className="relative">
          <input
            value={custSearch}
            onChange={(e) => searchCust(e.target.value)}
            placeholder="ค้นหา ชื่อ/อีเมล/เบอร์"
            className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-700"
          />
          {custHits.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow max-h-48 overflow-y-auto">
              {custHits.map((u) => (
                <button key={u.id} onClick={() => pickCust(u)}
                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700">
                  {u.name || '-'} <span className="text-gray-400">{u.phone || u.email || ''}</span>
                </button>
              ))}
            </div>
          )}
          {cust.id && (
            <div className="text-xs text-gray-500 mt-1">
              เลือก member: {cust.name} · แต้มคงเหลือ <b>{cust.points ?? 0}</b> ·{' '}
              <button onClick={() => { setCust({}); setCustSearch(''); setPointsToRedeem(''); }} className="text-red-500">ล้าง</button>
            </div>
          )}
        </div>
        {cust.id && ptValue > 0 && (cust.points ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-sm border-t dark:border-gray-800 pt-2">
            <span className="text-gray-500">ใช้แต้ม</span>
            <input
              type="number"
              min="0"
              max={Math.min(cust.points ?? 0, ptMaxByCart)}
              value={pointsToRedeem}
              onChange={(e) => setPointsToRedeem(e.target.value)}
              placeholder="0"
              className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={() => setPointsToRedeem(String(Math.min(cust.points ?? 0, ptMaxByCart)))}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              สูงสุด
            </button>
            <span className="text-xs text-gray-400">1 แต้ม = {ptValue.toFixed(2)}฿ · ใช้ได้ {Math.min(cust.points ?? 0, ptMaxByCart)} แต้ม</span>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={taxInvoice} onChange={(e) => setTaxInvoice(e.target.checked)} />
          ใบกำกับภาษีเต็มรูป
        </label>
        {taxInvoice && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input value={cust.name || ''} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder="ชื่อลูกค้า" className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
            <input value={cust.taxId || ''} onChange={(e) => setCust({ ...cust, taxId: e.target.value })} placeholder="เลขผู้เสียภาษี (13 หลัก)" className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
            <input value={cust.phone || ''} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="เบอร์โทร" className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
            <input value={cust.address || ''} onChange={(e) => setCust({ ...cust, address: e.target.value })} placeholder="ที่อยู่" className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 col-span-2" />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} /> แยกจ่าย (split)
        </label>

        {!splitMode ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {(['CASH', 'QR', 'TRANSFER', 'CARD'] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)} aria-pressed={payMethod === m} className={`px-3 py-1 rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${payMethod === m ? 'bg-indigo-500 text-white' : 'border dark:border-gray-700'}`}>{m}</button>
              ))}
            </div>
            {payMethod === 'CASH' ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-center text-sm">
                  <span className="w-16">รับเงิน</span>
                  <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setCashReceived(total.toFixed(2))} className="px-2 py-1 text-xs rounded border border-indigo-500 text-indigo-600 dark:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">พอดี</button>
                  {[100, 500, 1000, 2000].map((n) => (
                    <button key={n} onClick={() => setCashReceived(String(n))} className="px-2 py-1 text-xs rounded border dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{n}</button>
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
                <input type="number" value={sp.amount} onChange={(e) => setSplits(splits.map((x, i) => i === idx ? { ...x, amount: Number(e.target.value) } : x))} className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700" />
                {hasBookingBill && (
                  <select value={sp.target ?? 'PRODUCT'} onChange={(e) => setSplits(splits.map((x, i) => i === idx ? { ...x, target: e.target.value as 'PRODUCT' | 'BOOKING' } : x))} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700">
                    <option value="PRODUCT">สินค้า</option>
                    <option value="BOOKING">ค่าสนาม</option>
                  </select>
                )}
                <select value={sp.method} onChange={(e) => setSplits(splits.map((x, i) => i === idx ? { ...x, method: e.target.value } : x))} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700">
                  {['CASH', 'QR', 'TRANSFER', 'CARD'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => setSplits(splits.filter((_, i) => i !== idx))} aria-label={`ลบ split ${sp.label || idx + 1}`} className="text-red-500 text-xs rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">✕</button>
              </div>
            ))}
            <button onClick={() => setSplits([...splits, { label: '', amount: 0, method: 'CASH', target: 'PRODUCT' }])} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">+ เพิ่ม split</button>
            {hasBookingBill ? (
              <div className="text-xs tabular-nums space-y-0.5">
                <div className={Math.abs(splitProductSum - posFinal) < 0.01 ? 'text-emerald-600' : 'text-red-500'}>
                  split สินค้า: {splitProductSum.toFixed(2)} / {posFinal.toFixed(2)}
                </div>
                <div className={Math.abs(splitBookingSum - subtotalBooking) < 0.01 ? 'text-emerald-600' : 'text-red-500'}>
                  split ค่าสนาม: {splitBookingSum.toFixed(2)} / {subtotalBooking.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className={`text-xs tabular-nums ${Math.abs(splitSum - total) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                ผลรวม split: {splitSum.toFixed(2)} / {total.toFixed(2)}
              </div>
            )}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || total <= 0 || (splitMode && !splitOk) || (!splitMode && payMethod === 'CASH' && Number(cashReceived) < total)}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          {busy ? 'กำลังบันทึก...' : 'ยืนยัน + พิมพ์บิล'}
        </button>
      </div>
    </div>
  );
}
