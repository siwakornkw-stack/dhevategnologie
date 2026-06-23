'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

type Product = { id: string; name: string; stockQty: number; stockUnit: string };
type Movement = {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'VOID';
  qty: number;
  refType: string | null;
  note: string | null;
  createdAt: string;
  product: { name: string; stockUnit: string };
};

type StockClientProps = {
  initialProducts?: Product[];
  initialMovements?: Movement[];
};

const PAGE = 50;

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtBkk(iso: string): string {
  const parts = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

export function StockClient({ initialProducts = [], initialMovements = [] }: StockClientProps = {}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [hasMore, setHasMore] = useState(initialMovements.length >= PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterProductId, setFilterProductId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stockTakeOpen, setStockTakeOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [stSaving, setStSaving] = useState(false);

  async function fetchMovements(pid: string, skip = 0): Promise<Movement[]> {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (pid) params.set('productId', pid);
    if (skip) params.set('skip', String(skip));
    const m = await fetch(`/api/sport/pos/stock?${params.toString()}`).then((r) => r.json());
    return Array.isArray(m) ? (m as Movement[]) : [];
  }

  async function load() {
    const [p, m] = await Promise.all([
      // no-store: products endpoint is browser-cached (max-age=10); after a stock adjust we
      // reload here, and a cached response would show the old stock for up to 10s.
      fetch('/api/sport/pos/products?active=0', { cache: 'no-store' }).then((r) => r.json()),
      fetchMovements(filterProductId),
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setMovements(m);
    setHasMore(m.length >= PAGE);
  }

  async function changeFilter(pid: string) {
    setFilterProductId(pid);
    const m = await fetchMovements(pid);
    setMovements(m);
    setHasMore(m.length >= PAGE);
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const batch = await fetchMovements(filterProductId, movements.length);
      setMovements((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...batch.filter((b) => !seen.has(b.id))];
      });
      setHasMore(batch.length >= PAGE);
    } catch {
      toast.error('โหลดเพิ่มไม่สำเร็จ');
    } finally {
      setLoadingMore(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      // Pull the full movement history for the current filter (API caps at 200/page).
      const LIMIT = 200;
      const all: Movement[] = [];
      const seen = new Set<string>();
      let skip = 0;
      while (true) {
        const params = new URLSearchParams({ limit: String(LIMIT) });
        if (filterProductId) params.set('productId', filterProductId);
        if (skip) params.set('skip', String(skip));
        const batch = await fetch(`/api/sport/pos/stock?${params.toString()}`).then((r) => r.json());
        const list: Movement[] = Array.isArray(batch) ? batch : [];
        for (const m of list) if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
        if (list.length < LIMIT || all.length >= 50000) break;
        skip += LIMIT;
      }
      if (all.length === 0) { toast.error('ไม่มี movement ให้ export'); return; }

      // API returns newest-first; reverse to chronological so balance accumulates correctly.
      all.reverse();
      const bal = new Map<string, number>();
      const header = ['#', 'datetime_BKK', 'product', 'direction', 'type', 'qty', 'balance', 'refType', 'note'];
      const lines = [header.join(',')];
      all.forEach((m, i) => {
        const running = (bal.get(m.productId) || 0) + m.qty;
        bal.set(m.productId, running);
        lines.push([
          i + 1,
          fmtBkk(m.createdAt),
          csvCell(m.product?.name),
          m.qty < 0 ? 'OUT' : 'IN',
          m.type,
          m.qty,
          running,
          csvCell(m.refType ?? ''),
          csvCell(m.note ?? ''),
        ].join(','));
      });

      const csv = '﻿' + lines.join('\r\n'); // BOM so Excel reads Thai as UTF-8
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const prod = filterProductId ? (products.find((p) => p.id === filterProductId)?.name || 'product') : 'all';
      const ymd = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-${prod}-${ymd}.csv`.replace(/\s+/g, '-');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('export ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (initialProducts.length === 0 && initialMovements.length === 0) load();
  }, [initialProducts.length, initialMovements.length]);

  function openStockTake() {
    const seed: Record<string, string> = {};
    products.forEach((p) => { seed[p.id] = String(p.stockQty); });
    setCounts(seed);
    setStSaving(false);
    setStockTakeOpen(true);
  }

  async function runStockTake() {
    const ymd = new Date().toISOString().slice(0, 10);
    const rows = products
      .map((p) => {
        const raw = counts[p.id];
        if (raw === undefined || raw === '' || isNaN(Number(raw))) return null;
        const counted = Math.trunc(Number(raw));
        if (counted < 0) return null;
        const delta = counted - p.stockQty;
        if (delta === 0) return null;
        return { p, counted, delta };
      })
      .filter((x): x is { p: Product; counted: number; delta: number } => x !== null);

    if (rows.length === 0) { toast.error('ไม่มีรายการที่ต้องปรับ'); return; }
    if (!confirm(`ปรับ ${rows.length} รายการ ยืนยัน?`)) return;

    setStSaving(true);
    try {
      const r = await fetch('/api/sport/pos/stock/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: `STOCK-TAKE ${ymd}`,
          rows: rows.map((row) => ({ productId: row.p.id, counted: row.counted })),
        }),
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({ count: rows.length }));
        const count = data?.count ?? rows.length;
        await load();
        setStockTakeOpen(false);
        setStSaving(false);
        toast.success(`สำเร็จ ${count} รายการ`);
      } else {
        const e = await r.json().catch(() => ({}));
        setStSaving(false);
        toast.error(e.error || 'บันทึกไม่สำเร็จ — ไม่มีรายการใดถูกปรับ');
      }
    } catch {
      setStSaving(false);
      toast.error('บันทึกไม่สำเร็จ — ไม่มีรายการใดถูกปรับ');
    }
  }

  async function submit(form: FormData) {
    setSubmitting(true);
    const r = await fetch('/api/sport/pos/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: form.get('productId'),
        type: form.get('type'),
        qty: Number(form.get('qty')),
        note: form.get('note'),
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      toast.error(e.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    (document.getElementById('stock-form') as HTMLFormElement | null)?.reset();
    load();
  }

  return (
    <div className="wrapper py-8 space-y-6 max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stock</h1>
        </div>
        <button onClick={openStockTake} className="px-3 py-2 rounded-lg bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">นับสต๊อก (Stock-take)</button>
      </div>

      <form
        id="stock-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
      >
        <select name="productId" required className="input md:col-span-2">
          <option value="">-- เลือกสินค้า --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (คงเหลือ {p.stockQty} {p.stockUnit})
            </option>
          ))}
        </select>
        <select name="type" required className="input">
          <option value="IN">รับเข้า (IN)</option>
          <option value="OUT">ตัดออก (OUT)</option>
          <option value="ADJUST">ปรับ (+/-)</option>
        </select>
        <input name="qty" type="number" required placeholder="จำนวน" className="input" />
        <input name="note" placeholder="หมายเหตุ" className="input" />
        <button disabled={submitting} className="md:col-span-5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {submitting ? 'กำลังบันทึก...' : 'บันทึก movement'}
        </button>
      </form>

      {stockTakeOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !stSaving && setStockTakeOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-bold">นับสต๊อก (Stock-take)</h2>
              <button onClick={() => !stSaving && setStockTakeOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-xs text-gray-500 mb-3">กรอกจำนวนนับจริง — รายการที่ตรงกับระบบจะถูกข้าม. ADJUST movement จะถูกบันทึก + audit log.</p>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">สินค้า</th>
                    <th className="px-3 py-2 text-right">ในระบบ</th>
                    <th className="px-3 py-2 text-right">นับจริง</th>
                    <th className="px-3 py-2 text-right">ส่วนต่าง</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {products.map((p) => {
                    const raw = counts[p.id];
                    const counted = raw === undefined || raw === '' || isNaN(Number(raw)) ? null : Math.trunc(Number(raw));
                    const delta = counted === null ? null : counted - p.stockQty;
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{p.stockQty} {p.stockUnit}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={raw ?? ''}
                            onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                            className="w-20 px-2 py-1 text-right tabular-nums border rounded dark:bg-gray-800 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                        </td>
                        <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${delta === null || delta === 0 ? 'text-gray-400' : delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {delta === null ? '-' : delta > 0 ? `+${delta}` : delta}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t dark:border-gray-800 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-400">เว้นว่างเพื่อข้าม row</div>
              <div className="flex gap-2">
                <button disabled={stSaving} onClick={() => setStockTakeOpen(false)} className="px-3 py-2 border dark:border-gray-700 rounded text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิก</button>
                <button disabled={stSaving} onClick={runStockTake} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  {stSaving ? 'กำลังบันทึก...' : 'บันทึก stock-take'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Movement Log ({movements.length}{hasMore ? '+' : ''})</span>
          <div className="flex items-center gap-2">
            <select
              value={filterProductId}
              onChange={(e) => changeFilter(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs max-w-[200px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <option value="">ทุกสินค้า</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="px-3 py-1 rounded-lg bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white text-xs disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {exporting ? 'กำลังโหลด...' : 'โหลด CSV'}
            </button>
          </div>
        </div>
        {movements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ยังไม่มี movement</div>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">เวลา</th>
                <th className="px-4 py-2">สินค้า</th>
                <th className="px-4 py-2">ประเภท</th>
                <th className="px-4 py-2 text-right">qty</th>
                <th className="px-4 py-2">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(m.createdAt).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-2">{m.product?.name}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      m.type === 'IN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      m.type === 'OUT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      m.type === 'SALE' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                      m.type === 'VOID' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>{m.type}</span>
                  </td>
                  <td className={`px-4 py-2 text-right font-mono tabular-nums ${m.qty < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{m.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="p-3 border-t dark:border-gray-800 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
