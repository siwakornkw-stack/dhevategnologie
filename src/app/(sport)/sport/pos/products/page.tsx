'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  cost: number;
  stockQty: number;
  stockUnit: string;
  lowStockAlert: number;
  isActive: boolean;
};

export default function ProductsPage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/sport/pos/products?active=0${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    const data = await r.json();
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [q]);

  async function save(form: FormData) {
    const payload = {
      name: form.get('name'),
      sku: form.get('sku'),
      category: form.get('category'),
      price: form.get('price'),
      cost: form.get('cost'),
      stockQty: form.get('stockQty'),
      stockUnit: form.get('stockUnit'),
      lowStockAlert: form.get('lowStockAlert'),
      isActive: form.get('isActive') === 'on',
    };
    const url = editing ? `/api/sport/pos/products/${editing.id}` : `/api/sport/pos/products`;
    const method = editing ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    setEditing(null);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('ลบสินค้านี้?')) return;
    const r = await fetch(`/api/sport/pos/products/${id}`, { method: 'DELETE' });
    if (r.ok) load();
  }

  return (
    <div className="wrapper py-8 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">สินค้า</h1>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          + เพิ่มสินค้า
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหา ชื่อ / SKU"
        className="w-full px-3 py-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900"
      />

      {(showForm || editing) && (
        <form
          key={editing?.id || 'new'}
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget));
          }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
        >
          <input name="name" required defaultValue={editing?.name || ''} placeholder="ชื่อ *" className="input col-span-2" />
          <input name="sku" defaultValue={editing?.sku || ''} placeholder="SKU" className="input" />
          <input name="category" defaultValue={editing?.category || ''} placeholder="หมวด" className="input" />
          <input name="price" type="number" step="0.01" required defaultValue={editing?.price ?? ''} placeholder="ราคาขาย *" className="input" />
          <input name="cost" type="number" step="0.01" defaultValue={editing?.cost ?? 0} placeholder="ทุน" className="input" />
          {!editing && (
            <input name="stockQty" type="number" defaultValue={0} placeholder="Stock เริ่มต้น" className="input" />
          )}
          <input name="stockUnit" defaultValue={editing?.stockUnit || 'ชิ้น'} placeholder="หน่วย" className="input" />
          <input name="lowStockAlert" type="number" defaultValue={editing?.lowStockAlert ?? 5} placeholder="แจ้งเตือนต่ำกว่า" className="input" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} /> Active
          </label>
          <div className="col-span-full flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm(false);
              }}
              className="px-4 py-2 text-sm rounded-lg border dark:border-gray-700"
            >
              ยกเลิก
            </button>
            <button className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white">บันทึก</button>
          </div>
          <style>{`.input{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;background:white}.dark .input{background:#111827;border-color:#374151;color:white}`}</style>
        </form>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ไม่มีสินค้า</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">ชื่อ</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">หมวด</th>
                <th className="px-4 py-2 text-right">ราคา</th>
                <th className="px-4 py-2 text-right">ทุน</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2">สถานะ</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.sku || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{p.category || '-'}</td>
                  <td className="px-4 py-2 text-right">{p.price.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{p.cost.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right ${p.stockQty <= p.lowStockAlert ? 'text-amber-600 font-semibold' : ''}`}>
                    {p.stockQty} {p.stockUnit}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-primary-600 text-xs hover:underline">แก้</button>
                    <button onClick={() => remove(p.id)} className="text-red-600 text-xs hover:underline">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
