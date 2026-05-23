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

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [p, m] = await Promise.all([
      fetch('/api/sport/pos/products?active=0').then((r) => r.json()),
      fetch('/api/sport/pos/stock?limit=50').then((r) => r.json()),
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setMovements(Array.isArray(m) ? m : []);
  }

  useEffect(() => {
    load();
  }, []);

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
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock</h1>
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
