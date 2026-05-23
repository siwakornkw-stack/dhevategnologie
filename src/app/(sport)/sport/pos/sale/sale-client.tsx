'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

  async function loadProducts() {
    const p = await fetch('/api/sport/pos/products').then((r) => r.json());
    setProducts(Array.isArray(p) ? p : []);
  }
  async function loadTabs() {
    const t = await fetch('/api/sport/pos/tabs?status=OPEN').then((r) => r.json());
    setTabs(Array.isArray(t) ? t.filter((x: Tab) => x.status === 'OPEN') : []);
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
    const name = prompt('ชื่อ Tab (เช่น "โต๊ะ 5" / "ทีมแดง")');
    if (!name) return;
    const r = await fetch('/api/sport/pos/tabs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    if (!r.ok) { alert('สร้างไม่สำเร็จ'); return; }
    const t = await r.json();
    await loadTabs();
    setCurrentTabId(t.id);
  }

  async function addToTab(productId: string) {
    if (!currentTabId) { alert('เลือก Tab ก่อน หรือใช้ Quick Sale'); return; }
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
        alert(e.error || 'เพิ่มไม่สำเร็จ');
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
      alert('ลบไม่สำเร็จ');
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
              <option key={t.id} value={t.id}>{t.name}{t.teamLabel ? ` / ${t.teamLabel}` : ''}</option>
            ))}
          </select>
          <button onClick={createTab} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm">+ Tab ใหม่</button>
          <button onClick={() => { setQuickCart([]); setQuickOpen(true); }} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm">Quick Sale</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: products */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / SKU"
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
                className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-700 hover:border-primary-500 text-left disabled:opacity-40 overflow-hidden"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 text-2xl">📦</div>
                )}
                <div className="p-3">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{p.name}</div>
                  <div className="text-primary-600 font-bold mt-1">฿{p.price}</div>
                  <div className="text-[10px] text-gray-400">คงเหลือ {p.stockQty} {p.stockUnit}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="col-span-full p-8 text-center text-gray-400 text-sm">ไม่พบสินค้า</div>}
          </div>
        </div>

        {/* Right: cart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 p-4 h-fit sticky top-4">
          {!currentTab ? (
            <div className="text-center text-gray-400 py-8 text-sm">เลือก Tab หรือกด Quick Sale</div>
          ) : (
            <>
              <div className="font-semibold text-gray-900 dark:text-white">{currentTab.name}</div>
              {currentTab.teamLabel && <div className="text-xs text-gray-500">ทีม: {currentTab.teamLabel}</div>}
              {currentTab.bookingId && <div className="text-xs text-emerald-600 mt-1">🔗 ผูก booking</div>}
              <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto">
                {allCurrentItems.length === 0 ? (
                  <div className="text-center text-gray-400 py-6 text-xs">ยังไม่มีรายการ</div>
                ) : (
                  <>
                    {currentTab.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-sm border-b dark:border-gray-800 pb-1">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{it.productName}</div>
                          <div className="text-xs text-gray-400">x{it.qty} @ {it.unitPrice}</div>
                        </div>
                        <div className="text-right">
                          <div>{(it.unitPrice * it.qty - it.discount).toFixed(2)}</div>
                          <button onClick={() => voidItem(it.id)} className="text-[10px] text-red-500 hover:underline">ลบ</button>
                        </div>
                      </div>
                    ))}
                    {(currentTab.children || []).map((c) => c.items.length > 0 && (
                      <div key={c.id} className="border-t dark:border-gray-800 pt-2">
                        <div className="text-[10px] text-amber-600 mb-1">↳ {c.teamLabel || c.name} (merged)</div>
                        {c.items.map((it) => (
                          <div key={it.id} className="flex items-center justify-between text-sm pb-1">
                            <div className="flex-1 min-w-0 ml-3">
                              <div className="truncate text-gray-500">{it.productName}</div>
                              <div className="text-xs text-gray-400">x{it.qty} @ {it.unitPrice}</div>
                            </div>
                            <div className="text-right text-gray-500">{(it.unitPrice * it.qty - it.discount).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="mt-3 pt-3 border-t dark:border-gray-800 flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>{tabSubtotal.toFixed(2)}</span>
              </div>
              <button
                onClick={() => router.push(`/sport/pos/checkout/${currentTab.id}`)}
                disabled={allCurrentItems.length === 0 && !currentTab.bookingId}
                className="w-full mt-3 py-3 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50"
              >
                Checkout →
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

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = Math.max(subtotal - (Number(discount) || 0), 0);
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
      }),
    });
    setBusy(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || 'ชำระไม่สำเร็จ'); return; }
    const inv = await r.json();
    window.open(`/sport/pos/invoices/${inv.id}/print`, '_blank');
    onPaid(inv.id);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm pointer-events-none">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-emerald-500 shadow-2xl p-5 space-y-3 pointer-events-auto">
        <div className="flex justify-between items-center">
          <div className="font-bold text-lg">Quick Sale</div>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        <div className="text-xs text-gray-500">กดสินค้าด้านหลังเพื่อเพิ่ม</div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {cart.length === 0 ? <div className="text-center text-gray-400 py-6 text-sm">ยังไม่มีรายการ</div> :
            cart.map((it) => (
              <div key={it.productId} className="flex items-center gap-2 text-sm">
                <div className="flex-1">{it.name}</div>
                <input type="number" min={1} value={it.qty} onChange={(e) => setCart(cart.map((x) => x.productId === it.productId ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))}
                  className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
                <div className="w-20 text-right">{(it.price * it.qty).toFixed(2)}</div>
                <button onClick={() => setCart(cart.filter((x) => x.productId !== it.productId))} className="text-red-500 text-xs">✕</button>
              </div>
            ))
          }
        </div>
        <div className="border-t dark:border-gray-800 pt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between items-center">
            <span>ส่วนลด</span>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 px-2 py-1 border rounded text-right dark:bg-gray-800 dark:border-gray-700" />
          </div>
          <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span>{total.toFixed(2)}</span></div>
          <div className="flex gap-2 flex-wrap">
            {(['CASH', 'QR', 'TRANSFER', 'CARD'] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`px-3 py-1 rounded text-xs ${method === m ? 'bg-primary-600 text-white' : 'border dark:border-gray-700'}`}>{m}</button>
            ))}
          </div>
          {method === 'CASH' ? (
            <>
              <div className="flex gap-2 items-center">
                <span className="text-xs w-16">รับเงิน</span>
                <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
              </div>
              <div className="flex gap-1">
                {[50, 100, 500, 1000].map((n) => (
                  <button key={n} onClick={() => setCashReceived(String(n))} className="px-2 py-1 text-xs rounded border dark:border-gray-700">{n}</button>
                ))}
              </div>
              <div className="flex justify-between text-sm"><span>ทอน</span><span className="font-semibold">{change.toFixed(2)}</span></div>
            </>
          ) : (
            <input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="ref no (option)" className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
          )}
        </div>
        <button onClick={pay} disabled={busy || cart.length === 0 || (method === 'CASH' && Number(cashReceived) < total)}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'จ่าย + พิมพ์บิล'}
        </button>
      </div>
    </div>
  );
}
