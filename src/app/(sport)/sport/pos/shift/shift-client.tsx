'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type MethodTotals = Record<string, number>;
type Movement = { id: string; type: 'PAY_IN' | 'PAY_OUT'; amount: number; reason: string | null; createdAt: string };
type Summary = {
  invoiceCount: number;
  paidCount: number;
  voidCount: number;
  refundCount: number;
  grossPaid: number;
  voidTotal: number;
  refundTotal: number;
  netSales: number;
  methodTotals: MethodTotals;
  payIn: number;
  payOut: number;
  movements: Movement[];
};
type Shift = {
  id: string;
  shiftNo: string;
  cashierId: string;
  status: 'OPEN' | 'CLOSED';
  openingFloat: number;
  openingNote: string | null;
  openedAt: string;
  closedAt: string | null;
  countedCash: number | null;
  closingNote: string | null;
  summary?: Summary;
};

export function ShiftClient() {
  const [current, setCurrent] = useState<Shift | null>(null);
  const [detail, setDetail] = useState<Shift | null>(null);
  const [list, setList] = useState<Shift[]>([]);
  const [openingFloat, setOpeningFloat] = useState('1000');
  const [openingNote, setOpeningNote] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mvType, setMvType] = useState<'PAY_IN' | 'PAY_OUT'>('PAY_OUT');
  const [mvAmount, setMvAmount] = useState('');
  const [mvReason, setMvReason] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'OPEN' | 'CLOSED'>('');

  async function loadCurrent() {
    const r = await fetch('/api/sport/pos/shifts/current');
    const j = await r.json();
    setCurrent(j);
    if (j?.id) loadDetail(j.id);
  }
  async function loadDetail(id: string) {
    const r = await fetch(`/api/sport/pos/shifts/${id}`);
    if (r.ok) setDetail(await r.json());
  }
  async function loadList(override?: { from?: string; to?: string; status?: '' | 'OPEN' | 'CLOSED' }) {
    const from = override?.from ?? filterFrom;
    const to = override?.to ?? filterTo;
    const status = override?.status ?? filterStatus;
    const params = new URLSearchParams({ limit: '50' });
    if (from) { const d = new Date(from); d.setHours(0, 0, 0, 0); params.set('from', d.toISOString()); }
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); params.set('to', d.toISOString()); }
    if (status) params.set('status', status);
    const r = await fetch(`/api/sport/pos/shifts?${params}`);
    if (r.ok) setList(await r.json());
  }
  useEffect(() => {
    loadCurrent();
    loadList();
  }, []);

  async function openShift() {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/sport/pos/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingFloat: Number(openingFloat) || 0, openingNote }),
    });
    setBusy(false);
    if (!r.ok) { setMsg((await r.json()).error || 'open failed'); return; }
    setOpeningNote('');
    await loadCurrent();
    await loadList();
  }

  async function addMovement() {
    if (!current) return;
    const amt = Number(mvAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setMsg('amount invalid'); return; }
    setBusy(true); setMsg(null);
    const r = await fetch('/api/sport/pos/cash-movements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: mvType, amount: amt, reason: mvReason }),
    });
    setBusy(false);
    if (!r.ok) { setMsg((await r.json()).error || 'movement failed'); return; }
    setMvAmount(''); setMvReason('');
    await loadDetail(current.id);
  }

  async function closeShift() {
    if (!current) return;
    if (!countedCash) { setMsg('กรอกเงินสดที่นับได้'); return; }
    if (!confirm(`ปิดกะ ${current.shiftNo}?`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/sport/pos/shifts/${current.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countedCash: Number(countedCash), closingNote }),
    });
    setBusy(false);
    if (!r.ok) { setMsg((await r.json()).error || 'close failed'); return; }
    setCountedCash(''); setClosingNote('');
    await loadCurrent();
    await loadList();
  }

  const expectedCash =
    detail?.summary
      ? (detail.openingFloat || 0)
        + (detail.summary.methodTotals?.CASH || 0)
        + (detail.summary.payIn || 0)
        - (detail.summary.payOut || 0)
      : null;
  const diff =
    countedCash && expectedCash !== null
      ? +(Number(countedCash) - expectedCash).toFixed(2)
      : null;

  return (
    <div className="wrapper py-6 max-w-4xl space-y-6">
      <div>
        <Link href="/sport/pos" className="text-xs text-gray-500 hover:underline">← POS</Link>
        <h1 className="text-2xl font-bold">กะ (Shift)</h1>
      </div>

      {msg && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded">{msg}</div>}

      {!current ? (
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">เปิดกะใหม่</h2>
          <label className="block text-sm">
            เงินทอนตั้งต้น (Opening float)
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
          </label>
          <label className="block text-sm">
            หมายเหตุ
            <input
              value={openingNote}
              onChange={(e) => setOpeningNote(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
          </label>
          <button
            onClick={openShift}
            disabled={busy}
            className="px-4 py-2 rounded bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? '...' : 'เปิดกะ'}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-gray-500">กะปัจจุบัน</div>
              <div className="font-mono font-semibold">{current.shiftNo}</div>
              <div className="text-xs text-gray-500 mt-1">
                เปิด: {new Date(current.openedAt).toLocaleString('th-TH')}
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">OPEN</span>
          </div>

          {detail?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="บิล" value={detail.summary.paidCount} />
              <Stat label="ยอดขายสุทธิ" value={detail.summary.netSales.toFixed(2)} />
              <Stat label="คืน" value={detail.summary.refundTotal.toFixed(2)} />
              <Stat label="void" value={detail.summary.voidCount} />
              {Object.entries(detail.summary.methodTotals).map(([k, v]) => (
                <Stat key={k} label={k} value={v.toFixed(2)} />
              ))}
            </div>
          )}

          <div className="border-t dark:border-gray-700 pt-4 space-y-3">
            <h3 className="font-semibold text-sm">เพิ่ม/ถอนเงินสด (Petty cash)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select value={mvType} onChange={(e) => setMvType(e.target.value as 'PAY_IN' | 'PAY_OUT')}
                className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm">
                <option value="PAY_OUT">ถอนเงิน (PAY_OUT)</option>
                <option value="PAY_IN">เติมเงิน (PAY_IN)</option>
              </select>
              <input type="number" min="0" step="0.01" placeholder="amount"
                value={mvAmount} onChange={(e) => setMvAmount(e.target.value)}
                className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" />
              <input placeholder="เหตุผล" value={mvReason} onChange={(e) => setMvReason(e.target.value)}
                className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm" />
              <button onClick={addMovement} disabled={busy || !mvAmount}
                className="px-4 py-2 rounded bg-gray-800 text-white text-sm hover:bg-gray-700 disabled:opacity-50">
                บันทึก
              </button>
            </div>
            {detail?.summary?.movements?.length ? (
              <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {detail.summary.movements.map((m) => (
                  <div key={m.id} className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>{m.type === 'PAY_IN' ? '+' : '-'} {m.amount.toFixed(2)} - {m.reason || '-'}</span>
                    <span className="text-gray-400">{new Date(m.createdAt).toLocaleTimeString('th-TH')}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t dark:border-gray-700 pt-4 space-y-3">
            <h3 className="font-semibold text-sm">ปิดกะ (Z-report)</h3>
            <div className="text-xs text-gray-500">
              ตั้งต้น: {current.openingFloat.toFixed(2)} + ขายเงินสด:{' '}
              {(detail?.summary?.methodTotals?.CASH ?? 0).toFixed(2)}
              {detail?.summary?.payIn ? ` + เติม: ${detail.summary.payIn.toFixed(2)}` : ''}
              {detail?.summary?.payOut ? ` - ถอน: ${detail.summary.payOut.toFixed(2)}` : ''}
              {' '}= ควรมีในลิ้นชัก:{' '}
              <span className="font-semibold">{expectedCash?.toFixed(2) ?? '-'}</span>
            </div>
            <label className="block text-sm">
              เงินสดในลิ้นชัก (นับจริง)
              <input
                type="number"
                min="0"
                step="0.01"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              />
            </label>
            {diff !== null && (
              <div className={`text-sm ${diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                ส่วนต่าง: {diff > 0 ? '+' : ''}
                {diff.toFixed(2)}
              </div>
            )}
            <label className="block text-sm">
              หมายเหตุปิดกะ
              <input
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
              />
            </label>
            <button
              onClick={closeShift}
              disabled={busy || !countedCash}
              className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? '...' : 'ปิดกะ'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700/50 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-gray-800 font-semibold text-sm flex flex-wrap items-center gap-2">
          <span>กะย้อนหลัง</span>
          <div className="ml-auto flex flex-wrap items-center gap-1 text-xs font-normal">
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
            <span className="text-gray-400">→</span>
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as '' | 'OPEN' | 'CLOSED')} className="px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700">
              <option value="">ทุกสถานะ</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <button onClick={() => loadList()} className="px-3 py-1 bg-primary-600 text-white rounded">ค้นหา</button>
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterStatus(''); loadList({ from: '', to: '', status: '' }); }} className="px-2 py-1 border rounded">ล้าง</button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">รหัส</th>
              <th className="px-4 py-2">เปิด</th>
              <th className="px-4 py-2">ปิด</th>
              <th className="px-4 py-2 text-right">ตั้งต้น</th>
              <th className="px-4 py-2 text-right">นับได้</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {list.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">ไม่มีข้อมูล</td></tr>
            ) : list.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-mono text-xs">{s.shiftNo}</td>
                <td className="px-4 py-2 text-xs">{new Date(s.openedAt).toLocaleString('th-TH')}</td>
                <td className="px-4 py-2 text-xs">{s.closedAt ? new Date(s.closedAt).toLocaleString('th-TH') : '-'}</td>
                <td className="px-4 py-2 text-right">{s.openingFloat.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">{s.countedCash != null ? s.countedCash.toFixed(2) : '-'}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <a href={`/sport/pos/shift/${s.id}/print`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">Z-report</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
