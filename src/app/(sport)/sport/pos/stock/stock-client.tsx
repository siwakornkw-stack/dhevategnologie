'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Product = { id: string; name: string; stockQty: number; stockUnit: string };
type Movement = {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'VOID';
  qty: number;
  note: string | null;
  createdAt: string;
  product: { name: string; stockUnit: string };
};

type StockClientProps = {
  initialProducts?: Product[];
  initialMovements?: Movement[];
};

export function StockClient({ initialProducts = [], initialMovements = [] }: StockClientProps = {}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [submitting, setSubmitting] = useState(false);
  const [stockTakeOpen, setStockTakeOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [stProgress, setStProgress] = useState<{ done: number; total: number; ok: number; fail: number } | null>(null);

  async function load() {
    const [p, m] = await Promise.all([
      fetch('/api/sport/pos/products?active=0').then((r) => r.json()),
      fetch('/api/sport/pos/stock?limit=50').then((r) => r.json()),
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setMovements(Array.isArray(m) ? m : []);
  }

  useEffect(() => {
    if (initialProducts.length === 0 && initialMovements.length === 0) load();
  }, [initialProducts.length, initialMovements.length]);

  function openStockTake() {
    const seed: Record<string, string> = {};
    products.forEach((p) => { seed[p.id] = String(p.stockQty); });
    setCounts(seed);
    setStProgress(null);
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

    if (rows.length === 0) { alert('ไม่มีรายการที่ต้องปรับ'); return; }
    if (!confirm(`ปรับ ${rows.length} รายการ ยืนยัน?`)) return;

    setStProgress({ done: 0, total: rows.length, ok: 0, fail: 0 });
    let ok = 0; let fail = 0;
    for (const row of rows) {
      try {
        const r = await fetch('/api/sport/pos/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: row.p.id,
            type: 'ADJUST',
            qty: row.delta,
            note: `STOCK-TAKE ${ymd} (was ${row.p.stockQty} → ${row.counted})`,
          }),
        });
        if (r.ok) ok++; else fail++;
      } catch { fail++; }
      setStProgress({ done: ok + fail, total: rows.length, ok, fail });
    }
    await load();
    if (fail === 0) {
      setStockTakeOpen(false);
      alert(`สำเร็จ ${ok} รายการ`);
    } else {
      alert(`สำเร็จ ${ok} / ล้มเหลว ${fail} — ดู movement log`);
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
      alert(e.error || 'บันทึกไม่สำเร็จ');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock</h1>
        </div>
        <button onClick={openStockTake} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm">นับสต๊อก (Stock-take)</button>
      </div>

      <form
        id="stock-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
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
        <button disabled={submitting} className="md:col-span-5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-60">
          {submitting ? 'กำลังบันทึก...' : 'บันทึก movement'}
        </button>
        <style>{`.input{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;background:white}.dark .input{background:#111827;border-color:#374151;color:white}`}</style>
      </form>

      {stockTakeOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !stProgress && setStockTakeOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-bold">นับสต๊อก (Stock-take)</h2>
              <button onClick={() => !stProgress && setStockTakeOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
                        <td className="px-3 py-2 text-right text-gray-500">{p.stockQty} {p.stockUnit}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={raw ?? ''}
                            onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                            className="w-20 px-2 py-1 text-right border rounded dark:bg-gray-800 dark:border-gray-700"
                          />
                        </td>
                        <td className={`px-3 py-2 text-right font-mono text-xs ${delta === null || delta === 0 ? 'text-gray-400' : delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {delta === null ? '-' : delta > 0 ? `+${delta}` : delta}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t dark:border-gray-800 flex items-center justify-between gap-3">
              {stProgress ? (
                <div className="text-sm text-gray-500">
                  {stProgress.done} / {stProgress.total} (สำเร็จ {stProgress.ok} / ล้มเหลว {stProgress.fail})
                </div>
              ) : (
                <div className="text-xs text-gray-400">เว้นว่างเพื่อข้าม row</div>
              )}
              <div className="flex gap-2">
                <button disabled={!!stProgress} onClick={() => setStockTakeOpen(false)} className="px-3 py-2 border rounded text-sm disabled:opacity-50">ยกเลิก</button>
                <button disabled={!!stProgress} onClick={runStockTake} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">
                  {stProgress ? 'กำลังบันทึก...' : 'บันทึก stock-take'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-800 text-sm font-semibold">Movement Log (50 ล่าสุด)</div>
        {movements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ยังไม่มี movement</div>
        ) : (
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
                      m.type === 'IN' ? 'bg-green-100 text-green-700' :
                      m.type === 'OUT' ? 'bg-red-100 text-red-700' :
                      m.type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                      m.type === 'VOID' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{m.type}</span>
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${m.qty < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{m.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
