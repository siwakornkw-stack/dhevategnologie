'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Product = { id: string; name: string; sku: string | null; category: string | null; price: number; stockQty: number; stockUnit: string; imageUrl: string | null; isActive: boolean };
type Item = { id: string; productName: string; qty: number; unitPrice: number; discount: number };
type Tab = { id: string; name: string; teamLabel: string | null; bookingId: string | null; status: string; parentTabId: string | null; items: Item[]; children?: { id: string; name: string; teamLabel: string | null; items: Item[] }[] };

type SaleClientProps = {
  initialProducts?: Product[];
  initialTabs?: Tab[];
};

export function SaleClient({ initialProducts = [], initialTabs = [] }: SaleClientProps = {}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [currentTabId, setCurrentTabId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickCart, setQuickCart] = useState<{ productId: string; name: string; qty: number; price: number }[]>([]);
  const [tabNameOpen, setTabNameOpen] = useState(false);
  const [tabNameInput, setTabNameInput] = useState('');
  const [tabBusy, setTabBusy] = useState(false);

  async function loadProducts() {
    const p = await fetch('/api/sport/pos/products').then((r) => r.json());
    setProducts(Array.isArray(p) ? p : []);
  }
  async function loadTabs() {
    const t = await fetch('/api/sport/pos/tabs?status=OPEN').then((r) => r.json());
    setTabs(Array.isArray(t) ? t.filter((x: Tab) => x.status === 'OPEN' || x.status === 'HELD') : []);
  }
  async function load() {
    await Promise.all([loadProducts(), loadTabs()]);
  }
  useEffect(() => {
    if (initialProducts.length === 0 && initialTabs.length === 0) load();
  }, [initialProducts.length, initialTabs.length]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[], [products]);
  const filtered = products.filter((p) =>
    p.isActive &&
    (!cat || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || '').toLowerCase().includes(q.toLowerCase())),
  );
  const currentTab = tabs.find((t) => t.id === currentTabId) || null;

  async function createTab() {
    const name = tabNameInput.trim();
    if (!name) return;
    setTabBusy(true);
    const r = await fetch('/api/sport/pos/tabs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    setTabBusy(false);
    if (!r.ok) { toast.error('สร้าง Tab ไม่สำเร็จ'); return; }
    const t = await r.json();
    await loadTabs();
    setCurrentTabId(t.id);
    setTabNameInput('');
    setTabNameOpen(false);
  }

  async function addToTab(productId: string) {
    if (!currentTabId) { toast.error('เลือก Tab ก่อน หรือใช้ Quick Sale'); return; }
    const current = tabs.find((t) => t.id === currentTabId);
    if (current?.status === 'HELD') { toast.error('Tab ถูกพักไว้ กดเรียกคืนก่อน'); return; }
    const tabId = currentTabId;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Item = { id: tempId, productName: product.name, qty: 1, unitPrice: product.price, discount: 0 };
    setTabs((ts) => ts.map((t) => t.id === tabId ? { ...t, items: [...t.items, optimistic] } : t));
    setProducts((ps) => ps.map((p) => p.id === productId ? { ...p, stockQty: p.stockQty - 1 } : p));
    try {
      const r = await fetch(`/api/sport/pos/tabs/${tabId}/items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, qty: 1 }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error || 'เพิ่มไม่สำเร็จ');
        setTabs((ts) => ts.map((t) => t.id === tabId ? { ...t, items: t.items.filter((i) => i.id !== tempId) } : t));
        setProducts((ps) => ps.map((p) => p.id === productId ? { ...p, stockQty: p.stockQty + 1 } : p));
        return;
      }
      const created: Item = await r.json();
      setTabs((ts) => ts.map((t) => t.id === tabId ? { ...t, items: t.items.map((i) => i.id === tempId ? created : i) } : t));
    } catch {
      setTabs((ts) => ts.map((t) => t.id === tabId ? { ...t, items: t.items.filter((i) => i.id !== tempId) } : t));
      setProducts((ps) => ps.map((p) => p.id === productId ? { ...p, stockQty: p.stockQty + 1 } : p));
    }
  }

  async function holdTab() {
    if (!currentTabId) return;
    const r = await fetch(`/api/sport/pos/tabs/${currentTabId}/hold`, { method: 'POST' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'พักไม่สำเร็จ'); return; }
    await loadTabs();
  }
  async function resumeTab() {
    if (!currentTabId) return;
    const r = await fetch(`/api/sport/pos/tabs/${currentTabId}/resume`, { method: 'POST' });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'เรียกคืนไม่สำเร็จ'); return; }
    await loadTabs();
  }

  async function voidItem(itemId: string) {
    if (!currentTabId) return;
    if (!confirm('ลบรายการนี้?')) return;
    const tabId = currentTabId;
    const tab = tabs.find((t) => t.id === tabId);
    const removed = tab?.items.find((i) => i.id === itemId);
    setTabs((ts) => ts.map((t) => t.id === tabId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t));
    const r = await fetch(`/api/sport/pos/tabs/${tabId}/items/${itemId}`, { method: 'DELETE' });
    if (!r.ok && removed) {
      setTabs((ts) => ts.map((t) => t.id === tabId ? { ...t, items: [...t.items, removed] } : t));
      toast.error('ลบไม่สำเร็จ');
    }
  }

  function addQuick(p: Product) {
    setQuickCart((c) => {
      const ex = c.find((x) => x.productId === p.id);
      if (ex) return c.map((x) => x.productId === p.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { productId: p.id, name: p.name, qty: 1, price: p.price }];
    });
  }

  const allCurrentItems = currentTab ? [...currentTab.items, ...(currentTab.children || []).flatMap((c) => c.items.map((i) => ({ ...i, _team: c.teamLabel || c.name })))] : [];
  const tabSubtotal = allCurrentItems.reduce((s, i) => s + (i.unitPrice * i.qty - i.discount), 0);

  return (
    <div className="wrapper py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">ขายหน้าร้าน</h1>
        </div>
        <div className="flex gap-2">
          <select
            value={currentTabId || ''}
            onChange={(e) => setCurrentTabId(e.target.value || null)}
            className="px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">-- เลือก Tab --</option>
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>{t.status === 'HELD' ? '[พัก] ' : ''}{t.name}{t.teamLabel ? ` / ${t.teamLabel}` : ''}</option>
            ))}
          </select>
          <button onClick={() => { setTabNameOpen(true); setTabNameInput(''); }} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">+ Tab ใหม่</button>
          <button onClick={() => { setQuickCart([]); setQuickOpen(true); }} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Quick Sale</button>
          <button
            onClick={async () => {
              const r = await fetch('/api/sport/pos/invoices?limit=1');
              if (!r.ok) { toast.error('โหลดบิลล่าสุดไม่สำเร็จ'); return; }
              const arr = await r.json();
              const last = Array.isArray(arr) ? arr[0] : null;
              if (!last?.id) { toast.error('ไม่มีบิลย้อนหลัง'); return; }
              const w = window.open(`/sport/pos/invoices/${last.id}/print`, '_blank');
              if (!w) toast.error('เปิดหน้าพิมพ์ไม่ได้ — ตรวจ popup blocker');
            }}
            className="px-3 py-2 rounded-lg border dark:border-gray-700 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >พิมพ์บิลล่าสุด</button>
        </div>
      </div>

      {tabNameOpen && (
        <div className="mb-4 flex gap-2 items-center rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
          <input
            autoFocus
            value={tabNameInput}
            onChange={(e) => setTabNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createTab(); if (e.key === 'Escape') setTabNameOpen(false); }}
            placeholder='ชื่อ Tab (เช่น "โต๊ะ 5" / "ทีมแดง")'
            className="flex-1 px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
          <button onClick={createTab} disabled={tabBusy || !tabNameInput.trim()} className="px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{tabBusy ? '...' : 'สร้าง'}</button>
          <button onClick={() => { setTabNameOpen(false); setTabNameInput(''); }} className="px-3 py-2 rounded-lg border dark:border-gray-700 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิก</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: products */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const term = q.trim().toLowerCase();
                if (!term) return;
                const exact = products.find((p) => p.isActive && (p.sku || '').toLowerCase() === term);
                if (!exact) return;
                if (exact.stockQty <= 0) { toast.error('สินค้าหมดสต๊อก'); return; }
                if (quickOpen) addQuick(exact); else addToTab(exact.id);
                setQ('');
              }}
              placeholder="ค้นหา / สแกน barcode (SKU) แล้วกด Enter"
              className="flex-1 px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900" />
            <select value={cat} onChange={(e) => setCat(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900">
              <option value="">ทั้งหมด</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => (quickOpen ? addQuick(p) : addToTab(p.id))}
                disabled={p.stockQty <= 0}
                aria-label={`เพิ่ม ${p.name} ฿${p.price}`}
                className="rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-700 hover:border-primary-500 text-left disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-24 object-cover" />
                ) : (
                  <div aria-hidden className="w-full h-24 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 text-2xl">📦</div>
                )}
                <div className="p-3">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.name}</div>
                  <div className="text-primary-600 font-bold mt-1">฿{p.price}</div>
                  {p.stockQty <= 0
                    ? <div className="text-xs font-medium text-error-600">หมดสต๊อก</div>
                    : <div className="text-xs text-gray-500">คงเหลือ {p.stockQty} {p.stockUnit}</div>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="col-span-full p-8 text-center text-gray-500 dark:text-gray-400 text-sm">ไม่พบสินค้า</div>}
          </div>
        </div>

        {/* Right: cart */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 p-4 h-fit sticky top-4">
          {!currentTab ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">เลือก Tab หรือกด Quick Sale</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {currentTab.name}
                  {currentTab.status === 'HELD' && <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">พัก</span>}
                </div>
                {currentTab.status === 'OPEN' ? (
                  <button onClick={holdTab} className="px-2 py-1 text-xs rounded border dark:border-gray-700 text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">พัก</button>
                ) : currentTab.status === 'HELD' ? (
                  <button onClick={resumeTab} className="px-2 py-1 text-xs rounded bg-amber-500 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">เรียกคืน</button>
                ) : null}
              </div>
              {currentTab.teamLabel && <div className="text-xs text-gray-500">ทีม: {currentTab.teamLabel}</div>}
              {currentTab.bookingId && <div className="text-xs text-emerald-600 mt-1">🔗 ผูก booking</div>}
              <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto">
                {allCurrentItems.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-6 text-xs">ยังไม่มีรายการ</div>
                ) : (
                  <>
                    {currentTab.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-sm border-b dark:border-gray-800 pb-1">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{it.productName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">x{it.qty} @ {it.unitPrice}</div>
                        </div>
                        <div className="text-right">
                          <div className="tabular-nums">{(it.unitPrice * it.qty - it.discount).toFixed(2)}</div>
                          <button onClick={() => voidItem(it.id)} aria-label={`ลบ ${it.productName}`} className="text-xs text-red-500 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ลบ</button>
                        </div>
                      </div>
                    ))}
                    {(currentTab.children || []).map((c) => c.items.length > 0 && (
                      <div key={c.id} className="border-t dark:border-gray-800 pt-2">
                        <div className="text-xs text-amber-600 mb-1">↳ {c.teamLabel || c.name} (merged)</div>
                        {c.items.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-sm pb-1">
                            <div className="flex-1 min-w-0 ml-3">
                              <div className="truncate text-gray-500">{it.productName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">x{it.qty} @ {it.unitPrice}</div>
                            </div>
                            <div className="text-right text-gray-500 tabular-nums">{(it.unitPrice * it.qty - it.discount).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="mt-3 pt-3 border-t dark:border-gray-800 flex justify-between font-semibold">
                <span>Subtotal</span>
                <span className="tabular-nums">{tabSubtotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => router.push(`/sport/pos/checkout/${currentTab.id}`)}
                disabled={(allCurrentItems.length === 0 && !currentTab.bookingId) || currentTab.status === 'HELD'}
                className="w-full mt-3 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {currentTab.status === 'HELD' ? 'พักอยู่ — เรียกคืนก่อน' : 'Checkout →'}
              </button>
            </>
          )}
        </div>
      </div>

      {quickOpen && (
        <QuickSaleModal cart={quickCart} setCart={setQuickCart} onClose={() => setQuickOpen(false)} onPaid={() => { setQuickOpen(false); setQuickCart([]); loadProducts(); }} />
      )}
    </div>
  );
}

type QuickCustomer = { id: string; name: string | null; phone: string | null; email: string | null; points: number };

function QuickSaleModal({ cart, setCart, onClose, onPaid }: {
  cart: { productId: string; name: string; qty: number; price: number }[];
  setCart: (c: { productId: string; name: string; qty: number; price: number }[]) => void;
  onClose: () => void;
  onPaid: (invoiceId: string) => void;
}) {
  const [method, setMethod] = useState<'CASH' | 'QR' | 'TRANSFER' | 'CARD'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [discount, setDiscount] = useState<string>('0');
  const [refNo, setRefNo] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [pointsValueBaht, setPointsValueBaht] = useState(0);
  const [pointsEarnPerBaht, setPointsEarnPerBaht] = useState(0);
  const [vatMode, setVatMode] = useState<'NONE' | 'INCLUDED' | 'EXCLUDED'>('NONE');
  const [vatRate, setVatRate] = useState(0);
  const [serviceChargeRate, setServiceChargeRate] = useState(0);
  const [custQ, setCustQ] = useState('');
  const [custHits, setCustHits] = useState<QuickCustomer[]>([]);
  const [cust, setCust] = useState<QuickCustomer | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [txName, setTxName] = useState('');
  const [txTaxId, setTxTaxId] = useState('');
  const [txAddr, setTxAddr] = useState('');
  const [txPhone, setTxPhone] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discountType: string; discountValue: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);

  const hasExtras = !!cust || !!coupon || (Number(discount) || 0) > 0 || (Number(pointsToRedeem) || 0) > 0 || taxOpen;

  useEffect(() => {
    fetch('/api/sport/pos/settings').then((r) => r.ok ? r.json() : null).then((s) => {
      if (s) {
        setPointsValueBaht(s.pointsValueBaht || 0);
        setPointsEarnPerBaht(s.pointsEarnPerBaht || 0);
        setVatMode(s.vatMode || 'NONE');
        setVatRate(s.vatRate || 0);
        setServiceChargeRate(s.serviceChargeRate || 0);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (cust) return;
    const handle = setTimeout(async () => {
      if (custQ.trim().length < 2) { setCustHits([]); return; }
      const r = await fetch(`/api/sport/pos/customers?q=${encodeURIComponent(custQ.trim())}`);
      if (r.ok) setCustHits(await r.json());
    }, 250);
    return () => clearTimeout(handle);
  }, [custQ, cust]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const manualDiscount = Number(discount) || 0;
  const baseForCoupon = Math.max(subtotal - manualDiscount, 0);
  const couponDiscount = !coupon ? 0
    : coupon.discountType === 'PERCENT' ? Math.round((baseForCoupon * coupon.discountValue) / 100)
    : Math.min(coupon.discountValue, baseForCoupon);
  const baseTotal = Math.max(subtotal - manualDiscount - couponDiscount, 0);
  const serviceCharge = serviceChargeRate > 0 ? +(baseTotal * serviceChargeRate / 100).toFixed(2) : 0;
  const beforeVat = baseTotal + serviceCharge;
  const vatRateNum = vatRate / 100;
  const vatAmount = vatMode === 'NONE' ? 0
    : vatMode === 'INCLUDED' ? +(beforeVat * vatRateNum / (1 + vatRateNum)).toFixed(2)
    : +(beforeVat * vatRateNum).toFixed(2);
  const grossTotal = vatMode === 'EXCLUDED' ? +(beforeVat + vatAmount).toFixed(2) : beforeVat;
  const ptReqRaw = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
  const ptMaxBalance = cust?.points || 0;
  const ptMaxByTotal = pointsValueBaht > 0 ? Math.floor(grossTotal / pointsValueBaht) : 0;
  const ptUsed = cust && pointsValueBaht > 0 ? Math.min(ptReqRaw, ptMaxBalance, ptMaxByTotal) : 0;
  const redeemValue = +(ptUsed * pointsValueBaht).toFixed(2);
  const total = +Math.max(grossTotal - redeemValue, 0).toFixed(2);
  const earnPreview = cust && pointsEarnPerBaht > 0 ? Math.floor(total * pointsEarnPerBaht) : 0;
  const change = Math.max((Number(cashReceived) || 0) - total, 0);

  async function pay() {
    if (cart.length === 0) return;
    setBusy(true);
    const r = await fetch('/api/sport/pos/quick-sale', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map((c) => ({ productId: c.productId, qty: c.qty, unitPrice: c.price })),
        discount: Number(discount) || 0,
        payment: {
          method,
          amount: total,
          cashReceived: method === 'CASH' ? Number(cashReceived) || total : undefined,
          refNo: refNo || undefined,
        },
        ...(cust || taxOpen
          ? {
              customer: {
                ...(cust ? { id: cust.id } : {}),
                name: (taxOpen && txName.trim()) || cust?.name || undefined,
                phone: (taxOpen && txPhone.trim()) || cust?.phone || undefined,
                ...(taxOpen && txTaxId.trim() ? { taxId: txTaxId.trim() } : {}),
                ...(taxOpen && txAddr.trim() ? { address: txAddr.trim() } : {}),
              },
            }
          : {}),
        ...(cust && ptUsed > 0 ? { pointsToRedeem: ptUsed } : {}),
        ...(coupon ? { couponCode: coupon.code } : {}),
      }),
    });
    setBusy(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'ชำระไม่สำเร็จ'); return; }
    const inv = await r.json();
    toast.success(method === 'CASH' && change > 0 ? `บันทึกบิลแล้ว · ทอน ฿${change.toFixed(2)}` : 'บันทึกบิลแล้ว');
    const w = window.open(`/sport/pos/invoices/${inv.id}/print`, '_blank');
    if (!w) {
      toast.error('เปิดหน้าพิมพ์ไม่ได้ — ตรวจ popup blocker แล้วกด "พิมพ์บิลล่าสุด"', { duration: 8000 });
    }
    onPaid(inv.id);
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md pointer-events-none">
      <div className="pointer-events-auto h-full flex flex-col bg-white dark:bg-gray-900 border-l-2 border-emerald-500 shadow-2xl">
        <div className="shrink-0 flex justify-between items-start px-5 py-4 border-b dark:border-gray-800">
          <div>
            <div className="font-bold text-lg">Quick Sale</div>
            <div className="text-xs text-gray-500">กดสินค้าด้านหลังเพื่อเพิ่ม</div>
          </div>
          <button onClick={onClose} aria-label="ปิด Quick Sale" className="text-gray-500 dark:text-gray-400 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {cart.length === 0 ? <div className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">ยังไม่มีรายการ</div> :
            cart.map((it) => (
              <div key={it.productId} className="flex items-center gap-2 text-sm">
                <div className="flex-1">{it.name}</div>
                <input type="number" min={1} value={it.qty} onChange={(e) => setCart(cart.map((x) => x.productId === it.productId ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))}
                  className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
                <div className="w-20 text-right tabular-nums">{(it.price * it.qty).toFixed(2)}</div>
                <button onClick={() => setCart(cart.filter((x) => x.productId !== it.productId))} aria-label={`เอา ${it.name} ออก`} className="text-red-500 text-xs rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">✕</button>
              </div>
            ))
          }
        </div>

        <div className="shrink-0 border-t dark:border-gray-800">
          <button
            type="button"
            onClick={() => setExtrasOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-2 text-xs text-gray-500"
          >
            <span>{extrasOpen ? '▾' : '▸'} ลูกค้า / ส่วนลด / คูปอง / ใบกำกับ</span>
            {!extrasOpen && hasExtras && <span className="text-emerald-600">• มีการปรับ</span>}
          </button>
          {extrasOpen && (
            <div className="px-5 pb-3 space-y-2 text-sm max-h-72 overflow-y-auto">
              {!cust ? (
                <div className="space-y-1">
                  <input
                    value={custQ}
                    onChange={(e) => setCustQ(e.target.value)}
                    placeholder="ค้นลูกค้า (ชื่อ/เบอร์/อีเมล) — option"
                    className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs"
                  />
                  {custHits.length > 0 && (
                    <div className="max-h-32 overflow-auto border dark:border-gray-700 rounded">
                      {custHits.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setCust(c); setCustQ(''); setCustHits([]); }}
                          className="w-full text-left px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 border-b dark:border-gray-700 last:border-0"
                        >
                          {c.name || '(ไม่มีชื่อ)'} · {c.phone || c.email || '-'} <span className="text-primary-600">({c.points} pt)</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!createOpen ? (
                    <button type="button" onClick={() => { setCreateOpen(true); setCreateName(custQ); setCreatePhone(''); }} className="text-xs text-primary-600 hover:underline">+ สมัครลูกค้าใหม่</button>
                  ) : (
                    <div className="border dark:border-gray-700 rounded p-2 space-y-1">
                      <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="ชื่อ (option)" className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs" />
                      <input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="เบอร์โทร *" className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs" />
                      <div className="flex gap-1">
                        <button type="button" disabled={createBusy || !createPhone.trim()} onClick={async () => {
                          setCreateBusy(true);
                          const r = await fetch('/api/sport/pos/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createName.trim(), phone: createPhone.trim() }) });
                          setCreateBusy(false);
                          if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'สมัครไม่สำเร็จ'); return; }
                          const u = await r.json();
                          setCust({ id: u.id, name: u.name, phone: u.phone, email: u.email, points: u.points || 0 });
                          setCustQ(''); setCustHits([]); setCreateOpen(false); setCreateName(''); setCreatePhone('');
                        }} className="flex-1 px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded text-xs disabled:opacity-50">{createBusy ? '...' : 'สมัคร'}</button>
                        <button type="button" disabled={createBusy} onClick={() => { setCreateOpen(false); setCreateName(''); setCreatePhone(''); }} className="px-2 py-1 border rounded text-xs disabled:opacity-50">ยกเลิก</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{cust.name || '(ไม่มีชื่อ)'}</div>
                    <div className="text-gray-500">{cust.phone || cust.email || '-'} · {cust.points} pt</div>
                  </div>
                  <button onClick={() => { setCust(null); setPointsToRedeem(''); }} aria-label="เอาลูกค้าออก" className="text-red-500 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">✕</button>
                </div>
              )}
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setTaxOpen((v) => !v)}
                  className="text-gray-500 hover:underline"
                >
                  {taxOpen ? '▾' : '▸'} ใบกำกับเต็มรูปแบบ (taxId/ที่อยู่)
                </button>
                {taxOpen && (
                  <div className="mt-1 space-y-1">
                    <input value={txName} onChange={(e) => setTxName(e.target.value)} placeholder="ชื่อบริษัท/ผู้ซื้อ"
                      className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs" />
                    <input value={txTaxId} onChange={(e) => setTxTaxId(e.target.value)} placeholder="เลขผู้เสียภาษี"
                      className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs" />
                    <input value={txAddr} onChange={(e) => setTxAddr(e.target.value)} placeholder="ที่อยู่"
                      className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs" />
                    <input value={txPhone} onChange={(e) => setTxPhone(e.target.value)} placeholder="โทร"
                      className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700 text-xs" />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span>ส่วนลด</span>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs">Coupon</span>
                  <input
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(null); }}
                    disabled={!!coupon || couponBusy}
                    placeholder="CODE"
                    className="flex-1 px-2 py-1 border rounded text-xs uppercase dark:bg-gray-800 dark:border-gray-700 disabled:opacity-50"
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
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded disabled:opacity-50"
                    >{couponBusy ? '...' : 'ใช้'}</button>
                  ) : (
                    <button type="button" onClick={() => { setCoupon(null); setCouponInput(''); setCouponMsg(null); }} className="px-2 py-1 text-xs border rounded dark:border-gray-700">ลบ</button>
                  )}
                </div>
                {couponMsg && <div className="text-xs text-red-500">{couponMsg}</div>}
              </div>
              {cust && pointsValueBaht > 0 && (
                <div className="flex justify-between items-center">
                  <span>ใช้แต้ม (max {Math.min(ptMaxBalance, ptMaxByTotal)})</span>
                  <input
                    type="number" min={0} max={Math.min(ptMaxBalance, ptMaxByTotal)}
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(e.target.value)}
                    className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t dark:border-gray-800 px-5 py-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{subtotal.toFixed(2)}</span></div>
          {manualDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>ส่วนลด</span><span>-{manualDiscount.toFixed(2)}</span></div>}
          {coupon && couponDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 text-xs"><span>คูปอง {coupon.code} ({coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : `฿${coupon.discountValue}`})</span><span>-{couponDiscount.toFixed(2)}</span></div>
          )}
          {serviceCharge > 0 && <div className="flex justify-between text-gray-500"><span>SC {serviceChargeRate}%</span><span>{serviceCharge.toFixed(2)}</span></div>}
          {vatMode === 'EXCLUDED' && vatAmount > 0 && <div className="flex justify-between text-gray-500"><span>VAT {vatRate}%</span><span>{vatAmount.toFixed(2)}</span></div>}
          {vatMode === 'INCLUDED' && vatAmount > 0 && <div className="flex justify-between text-gray-500 dark:text-gray-400 text-xs"><span>(VAT รวม {vatRate}%)</span><span>{vatAmount.toFixed(2)}</span></div>}
          {ptUsed > 0 && <div className="flex justify-between text-emerald-600"><span>หัก redeem</span><span>-{redeemValue.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span className="tabular-nums">{total.toFixed(2)}</span></div>
          {earnPreview > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 text-right">จะได้ {earnPreview} pt</div>}
          <div className="flex gap-2 flex-wrap">
            {(['CASH', 'QR', 'TRANSFER', 'CARD'] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m} className={`px-3 py-1 rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${method === m ? 'bg-indigo-500 text-white' : 'border dark:border-gray-700'}`}>{m}</button>
            ))}
          </div>
          {method === 'CASH' ? (
            <>
              <div className="flex gap-2 items-center">
                <span className="text-xs w-16">รับเงิน</span>
                <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setCashReceived(total.toFixed(2))} className="px-2 py-1 text-xs rounded border dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">พอดี</button>
                {[50, 100, 500, 1000].map((n) => (
                  <button key={n} onClick={() => setCashReceived(String(n))} className="px-2 py-1 text-xs rounded border dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{n}</button>
                ))}
              </div>
              <div className="flex justify-between text-sm"><span>ทอน</span><span className="font-semibold tabular-nums">{change.toFixed(2)}</span></div>
            </>
          ) : (
            <>
              <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="ref no (option)" className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
              <div className="flex justify-between text-sm"><span>ยอดชำระ</span><span className="font-semibold tabular-nums">{total.toFixed(2)}</span></div>
            </>
          )}
          <button onClick={pay} disabled={busy || cart.length === 0 || (method === 'CASH' && Number(cashReceived) < total)}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900">
            {busy ? 'กำลังบันทึก...' : 'จ่าย + พิมพ์บิล'}
          </button>
        </div>
      </div>
    </div>
  );
}
