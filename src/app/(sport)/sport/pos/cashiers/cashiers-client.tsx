'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Cashier = { id: string; name: string | null; email: string; createdAt: string };

type CashiersClientProps = { initialList?: Cashier[] };

export function CashiersClient({ initialList = [] }: CashiersClientProps = {}) {
  const [list, setList] = useState<Cashier[]>(initialList);
  const [creating, setCreating] = useState(false);

  async function load() {
    const r = await fetch('/api/sport/pos/cashiers');
    setList(await r.json());
  }
  useEffect(() => { if (initialList.length === 0) load(); }, [initialList.length]);

  async function create(form: FormData) {
    setCreating(true);
    const r = await fetch('/api/sport/pos/cashiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password') }),
    });
    setCreating(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error || 'สร้างไม่สำเร็จ'); return; }
    (document.getElementById('cashier-form') as HTMLFormElement | null)?.reset();
    load();
  }

  async function remove(id: string) {
    if (!confirm('ลบ cashier นี้?')) return;
    const r = await fetch('/api/sport/pos/cashiers', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    });
    if (r.ok) load();
  }

  return (
    <div className="wrapper py-8 space-y-4 max-w-3xl">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cashiers</h1>
      </div>

      <form
        id="cashier-form"
        onSubmit={(e) => { e.preventDefault(); create(new FormData(e.currentTarget)); }}
        className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
      >
        <input name="name" required placeholder="ชื่อ *" className="input" />
        <input name="email" type="email" required placeholder="email *" className="input" />
        <input name="password" type="password" required minLength={8} placeholder="password >=8 *" className="input" />
        <button disabled={creating} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-60">
          {creating ? '...' : 'สร้าง'}
        </button>
        <style>{`.input{padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb;background:white}.dark .input{background:#111827;border-color:#374151;color:white}`}</style>
      </form>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ยังไม่มี cashier</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">ชื่อ</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">สร้างเมื่อ</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.email}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('th-TH')}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(c.id)} className="text-red-600 text-xs hover:underline">ลบ</button>
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
