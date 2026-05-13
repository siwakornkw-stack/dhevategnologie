'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

interface CouponManagerProps {
  initialCoupons: Coupon[];
  initialCouponSystemEnabled: boolean;
}

export function CouponManager({ initialCoupons, initialCouponSystemEnabled }: CouponManagerProps) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initialCoupons);
  const [couponSystemEnabled, setCouponSystemEnabled] = useState(initialCouponSystemEnabled);
  const [systemToggling, setSystemToggling] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENT',
    discountValue: '',
    maxUses: '',
    expiresAt: '',
  });

  async function toggleCouponSystem() {
    setSystemToggling(true);
    try {
      const res = await fetch('/api/sport/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponSystemEnabled: !couponSystemEnabled }),
      });
      if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
      setCouponSystemEnabled((v) => !v);
      toast.success(!couponSystemEnabled ? 'เปิดระบบคูปองแล้ว' : 'ปิดระบบคูปองแล้ว');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSystemToggling(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/sport/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('สร้างคูปองสำเร็จ');
      setShowForm(false);
      setForm({ code: '', discountType: 'PERCENT', discountValue: '', maxUses: '', expiresAt: '' });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      const res = await fetch('/api/sport/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }),
      });
      if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
      setCoupons((prev) => prev.map((c) => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
      toast.success(coupon.isActive ? 'ปิดคูปองแล้ว' : 'เปิดใช้คูปองแล้ว');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`ลบคูปอง "${coupon.code}" ?`)) return;
    try {
      const res = await fetch('/api/sport/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id }),
      });
      if (!res.ok) throw new Error('เกิดข้อผิดพลาด');
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      toast.success('ลบคูปองแล้ว');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎟️ คูปองส่วนลด</h1>
          <p className="text-sm text-gray-400 mt-0.5">จัดการโค้ดส่วนลดสำหรับลูกค้า</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition"
        >
          {showForm ? 'ยกเลิก' : '+ สร้างคูปอง'}
        </button>
      </div>

      {/* Global coupon system toggle */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between gap-4 transition-colors ${
        couponSystemEnabled
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50'
          : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700/50'
      }`}>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            ระบบคูปองส่วนลด
          </p>
          <p className="text-sm mt-0.5 text-gray-500 dark:text-gray-400">
            {couponSystemEnabled
              ? 'เปิดอยู่ — ลูกค้าเห็นช่องกรอกโค้ดส่วนลดตอนจอง'
              : 'ปิดอยู่ — ลูกค้าไม่เห็นช่องกรอกโค้ด และโค้ดทุกตัวใช้ไม่ได้'}
          </p>
        </div>
        <button
          onClick={toggleCouponSystem}
          disabled={systemToggling}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
            couponSystemEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              couponSystemEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">สร้างคูปองใหม่</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">รหัสคูปอง *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER20"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm font-mono uppercase text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ประเภทส่วนลด *</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="PERCENT">เปอร์เซ็นต์ (%)</option>
                <option value="FIXED">จำนวนเงิน (฿)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {form.discountType === 'PERCENT' ? 'ส่วนลด (%)' : 'ส่วนลด (฿)'} *
              </label>
              <input
                required
                type="number"
                min="1"
                max={form.discountType === 'PERCENT' ? '100' : undefined}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                placeholder={form.discountType === 'PERCENT' ? '20' : '100'}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">จำนวนครั้งสูงสุด (ว่างไว้ = ไม่จำกัด)</label>
              <input
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                placeholder="100"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">วันหมดอายุ (ว่างไว้ = ไม่หมดอายุ)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'กำลังสร้าง...' : 'สร้างคูปอง'}
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        {coupons.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-2">🎟️</div>
            <p>ยังไม่มีคูปอง กดปุ่ม &quot;+ สร้างคูปอง&quot; เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left font-semibold">รหัสคูปอง</th>
                  <th className="px-4 py-3 text-left font-semibold">ส่วนลด</th>
                  <th className="px-4 py-3 text-center font-semibold">ใช้แล้ว</th>
                  <th className="px-4 py-3 text-left font-semibold">หมดอายุ</th>
                  <th className="px-4 py-3 text-center font-semibold">สถานะ</th>
                  <th className="px-4 py-3 text-center font-semibold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {coupons.map((coupon) => {
                  const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt) < new Date() : false;
                  const isFull = coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;
                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">
                        {coupon.discountType === 'PERCENT'
                          ? `${coupon.discountValue}%`
                          : `฿${coupon.discountValue.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                        {coupon.usedCount}{coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {coupon.expiresAt
                          ? new Date(coupon.expiresAt).toLocaleDateString('th-TH')
                          : <span className="text-gray-300 dark:text-gray-600">ไม่หมดอายุ</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isExpired || isFull ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
                            {isExpired ? 'หมดอายุ' : 'ใช้หมดแล้ว'}
                          </span>
                        ) : coupon.isActive ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">ใช้งาน</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">ปิดอยู่</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => toggleActive(coupon)}
                            className="text-xs px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                          >
                            {coupon.isActive ? 'ปิด' : 'เปิด'}
                          </button>
                          <button
                            onClick={() => handleDelete(coupon)}
                            className="text-xs px-3 py-1 rounded-full border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
