'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Tab = {
  id: string; name: string; teamLabel: string | null; bookingId: string | null;
  status: string; parentTabId: string | null;
  items: { id: string; qty: number; unitPrice: number; discount: number }[];
  openedAt: string;
};
type Booking = { id: string; date: string; timeSlot: string; user: { name: string | null; phone: string | null }; field: { name: string } };

type TabsClientProps = {
  initialTabs?: Tab[];
  initialBookings?: Booking[];
};

export function TabsClient({ initialTabs = [], initialBookings = [] }: TabsClientProps = {}) {
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkOpenId, setLinkOpenId] = useState<string | null>(null);
  const [linkTeamLabel, setLinkTeamLabel] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMaster, setMergeMaster] = useState<string>('');

  async function load() {
    const [t, b] = await Promise.all([
      fetch('/api/sport/pos/tabs?status=OPEN').then((r) => r.json()),
      fetch('/api/sport/pos/bookings').then((r) => r.json()),
    ]);
    setTabs(Array.isArray(t) ? t : []);
    setBookings(Array.isArray(b) ? b : []);
  }
  useEffect(() => {
    if (initialTabs.length === 0 && initialBookings.length === 0) load();
  }, [initialTabs.length, initialBookings.length]);

  const roots = tabs.filter((t) => !t.parentTabId);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function openMerge() {
    if (selected.size < 2) { toast.error('เลือกอย่างน้อย 2 tab'); return; }
    setMergeMaster(Array.from(selected)[0]);
    setMergeOpen(true);
  }
  async function doMerge() {
    const ids = Array.from(selected);
    if (!mergeMaster || !ids.includes(mergeMaster)) { toast.error('เลือก master'); return; }
    const childIds = ids.filter((x) => x !== mergeMaster);
    const r = await fetch('/api/sport/pos/tabs/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ masterId: mergeMaster, childIds }),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'merge ไม่สำเร็จ'); return; }
    setSelected(new Set());
    setMergeOpen(false);
    load();
  }

  function openLink(tabId: string, teamLabel: string | null) {
    if (linkOpenId === tabId) { setLinkOpenId(null); return; }
    setLinkTeamLabel(teamLabel || '');
    setLinkOpenId(tabId);
  }
  async function linkBooking(tabId: string, bookingId: string, teamLabel?: string) {
    const r = await fetch(`/api/sport/pos/tabs/${tabId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, teamLabel: teamLabel || undefined }),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'ผูกไม่สำเร็จ'); return; }
    setLinkOpenId(null);
    load();
  }

  async function unlinkBooking(tabId: string) {
    if (!confirm('ยกเลิกการผูก booking?')) return;
    const r = await fetch(`/api/sport/pos/tabs/${tabId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: null }),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error || 'ยกเลิกไม่สำเร็จ'); return; }
    load();
  }

  async function voidTab(id: string) {
    if (!confirm('ยกเลิก tab นี้? (สต็อกจะคืน)')) return;
    const r = await fetch(`/api/sport/pos/tabs/${id}`, { method: 'DELETE' });
    if (r.ok) load();
  }

  return (
    <div className="wrapper py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tabs / โต๊ะ</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={openMerge} disabled={selected.size < 2} className="px-3 py-2 rounded-lg bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            Merge ({selected.size})
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700/50 divide-y dark:divide-gray-800">
        {roots.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">ไม่มี tab เปิดอยู่</div>
        ) : roots.map((t) => {
          const subtotal = t.items.reduce((s, i) => s + (i.unitPrice * i.qty - i.discount), 0);
          const children = tabs.filter((c) => c.parentTabId === t.id);
          return (
            <div key={t.id} className="p-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`เลือก tab ${t.name}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
                <div className="flex-1">
                  <div className="font-medium">{t.name} {t.teamLabel && <span className="text-xs text-gray-500">/ {t.teamLabel}</span>}</div>
                  <div className="text-xs text-gray-500">
                    {t.items.length} รายการ · <span className="tabular-nums">฿{subtotal.toFixed(2)}</span>
                    {t.bookingId && <span className="ml-2 text-emerald-600">booking</span>}
                    {children.length > 0 && <span className="ml-2 text-gray-500">+ {children.length} merged</span>}
                  </div>
                </div>
                {t.bookingId || t.teamLabel ? (
                  <button onClick={() => unlinkBooking(t.id)} className="text-xs text-gray-500 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิกผูก booking</button>
                ) : (
                  <button onClick={() => openLink(t.id, t.teamLabel)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ผูก booking</button>
                )}
                <button onClick={() => router.push(`/sport/pos/checkout/${t.id}`)} className="px-3 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Checkout</button>
                <button onClick={() => voidTab(t.id)} className="text-xs text-red-500 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิก</button>
              </div>

              {children.length > 0 && (
                <div className="ml-8 mt-2 space-y-1">
                  {children.map((c) => (
                    <div key={c.id} className="text-xs text-gray-500 flex gap-2">
                      ↳ {c.name} {c.teamLabel && `/ ${c.teamLabel}`} ({c.items.length} รายการ)
                    </div>
                  ))}
                </div>
              )}

              {linkOpenId === t.id && (
                <div className="mt-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 space-y-2">
                  <div className="text-xs font-semibold">เลือก booking (วันนี้-อนาคต, ยังไม่จ่าย)</div>
                  <input
                    value={linkTeamLabel}
                    onChange={(e) => setLinkTeamLabel(e.target.value)}
                    placeholder='ทีม (option, เช่น "ทีมแดง")'
                    aria-label="ชื่อทีม"
                    className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-900 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {bookings.length === 0 ? <div className="text-xs text-gray-400">ไม่มี</div> :
                      bookings.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => linkBooking(t.id, b.id, linkTeamLabel.trim() || undefined)}
                          className="w-full text-left p-2 rounded hover:bg-white dark:hover:bg-gray-900 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          {new Date(b.date).toLocaleDateString('th-TH')} {b.timeSlot} · {b.field.name} · {b.user.name}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {mergeOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMergeOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-lg">เลือก Master Tab</div>
            <div className="text-xs text-gray-500">รายการอื่นจะถูก merge เข้า master</div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {Array.from(selected).map((tid) => {
                const t = tabs.find((x) => x.id === tid);
                if (!t) return null;
                return (
                  <label key={tid} className="flex items-center gap-2 p-2 border dark:border-gray-700 rounded cursor-pointer">
                    <input type="radio" name="master" checked={mergeMaster === tid} onChange={() => setMergeMaster(tid)} />
                    <span className="text-sm">{t.name}{t.teamLabel ? ` / ${t.teamLabel}` : ''} <span className="text-xs text-gray-400">({t.items.length} รายการ)</span></span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMergeOpen(false)} className="px-3 py-2 text-sm border dark:border-gray-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">ยกเลิก</button>
              <button onClick={doMerge} className="px-3 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Merge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
