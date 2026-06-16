'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

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
  imageUrl: string | null;
  isActive: boolean;
  stockParentId?: string | null;
  unitsPerStock?: number;
};

type ProductsClientProps = { initialList?: Product[] };

export function ProductsClient({ initialList = [] }: ProductsClientProps = {}) {
  const [list, setList] = useState<Product[]>(initialList);
  const [loading, setLoading] = useState(initialList.length === 0);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipFirst = useRef(initialList.length > 0);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/sport/pos/products?active=0${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    const data = await r.json();
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    if (skipFirst.current && q === '') { skipFirst.current = false; return; }
    skipFirst.current = false;
    load();
  }, [q]);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/sport/upload', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error || 'อัปโหลดไม่สำเร็จ');
        return;
      }
      setImageUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

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
      stockParentId: form.get('stockParentId') || null,
      unitsPerStock: form.get('unitsPerStock'),
      imageUrl,
      isActive: form.get('isActive') === 'on',
    };
    const url = editing ? `/api/sport/pos/products/${editing.id}` : `/api/sport/pos/products`;
    const method = editing ? 'PATCH' : 'POST';
    setSaving(true);
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      toast.error(e.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    toast.success('บันทึกแล้ว');
    setEditing(null);
    setShowForm(false);
    setImageUrl(null);
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">สินค้า</h1>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setImageUrl(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          + เพิ่มสินค้า
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหา ชื่อ / SKU"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      />

      {(showForm || editing) && (
        <form
          key={editing?.id || 'new'}
          onSubmit={(e) => {
            e.preventDefault();
            save(new FormData(e.currentTarget));
          }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
        >
          <div className="col-span-full flex items-center gap-3">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="preview" className="w-20 h-20 object-cover rounded-lg border dark:border-gray-700" />
            ) : (
              <div className="w-20 h-20 rounded-lg border-2 border-dashed dark:border-gray-700 flex items-center justify-center text-xs text-gray-400">ไม่มีรูป</div>
            )}
            <div className="flex flex-col gap-2">
              <label className="px-3 py-1.5 text-xs rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center gap-1">
                {uploading ? 'กำลังอัปโหลด...' : 'เลือกรูป'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {imageUrl && (
                <button type="button" onClick={() => setImageUrl(null)} className="text-xs text-red-600 hover:underline text-left">ลบรูป</button>
              )}
            </div>
          </div>
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
          <select name="stockParentId" defaultValue={editing?.stockParentId || ''} className="input">
            <option value="">— stock เดี่ยว (ไม่ใช่แพ็ค) —</option>
            {list.filter((x) => !x.stockParentId && x.id !== editing?.id).map((x) => (
              <option key={x.id} value={x.id}>แพ็คที่ดึง stock จาก: {x.name}</option>
            ))}
          </select>
          <input name="unitsPerStock" type="number" min={1} defaultValue={editing?.unitsPerStock ?? 1} placeholder="จำนวน/แพ็ค (เช่น 12)" className="input" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} /> Active
          </label>
          <div className="col-span-full flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm(false);
                setImageUrl(null);
              }}
              className="px-4 py-2 text-sm rounded-lg border dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ยกเลิก
            </button>
            <button disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{saving ? '...' : 'บันทึก'}</button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ไม่มีสินค้า</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 w-16">รูป</th>
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
                  <td className="px-4 py-2">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-cover rounded-md border dark:border-gray-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 text-xs">-</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.sku || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{p.category || '-'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{p.price.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 tabular-nums">{p.cost.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${p.stockQty <= p.lowStockAlert ? 'text-red-600 font-semibold' : ''}`}>
                    {p.stockQty} {p.stockUnit}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {p.isActive ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => { setEditing(p); setImageUrl(p.imageUrl); setShowForm(true); }} className="text-indigo-600 dark:text-indigo-400 text-xs hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">แก้</button>
                    <button onClick={() => remove(p.id)} className="text-red-600 text-xs hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ลบ</button>
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
