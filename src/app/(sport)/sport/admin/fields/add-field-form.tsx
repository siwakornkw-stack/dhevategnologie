'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SPORT_TYPE_LABELS } from '@/lib/booking';

const SPORT_TYPES = Object.entries(SPORT_TYPE_LABELS);

interface PriceRuleInput {
  startTime: string;
  endTime: string;
  pricePerHour: string;
  label: string;
}

const defaultForm = {
  name: '', sportType: 'FOOTBALL', pricePerHour: '',
  location: '', description: '', facilities: '',
  imageUrl: '', openTime: '08:00', closeTime: '22:00',
  lat: '', lng: '',
};

export function AddFieldForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [uploading, setUploading] = useState(false);
  const [priceRules, setPriceRules] = useState<PriceRuleInput[]>([]);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function addPriceRule() {
    setPriceRules((prev) => [...prev, { startTime: '08:00', endTime: '12:00', pricePerHour: '', label: '' }]);
  }
  function removePriceRule(idx: number) {
    setPriceRules((prev) => prev.filter((_, i) => i !== idx));
  }
  function updatePriceRule(idx: number, key: keyof PriceRuleInput, val: string) {
    setPriceRules((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/sport/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setField('imageUrl', data.url);
      toast.success('อัปโหลดรูปสำเร็จ');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleClose() { setOpen(false); setForm(defaultForm); setPriceRules([]); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('กรุณากรอกชื่อสนาม');
    if (!form.pricePerHour || Number(form.pricePerHour) <= 0) return toast.error('กรุณากรอกราคา');
    setLoading(true);
    try {
      const res = await fetch('/api/sport/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          priceRules: priceRules.map((r) => ({ ...r, pricePerHour: Number(r.pricePerHour) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`เพิ่มสนาม "${form.name}" สำเร็จ! 🎉`);
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition';

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="gradient-btn flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium"
      >
        <span className="text-base">+</span> เพิ่มสนาม
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Dialog */}
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">🏟️ เพิ่มสนามกีฬาใหม่</h2>
                <p className="text-xs text-gray-400 mt-0.5">กรอกข้อมูลสนามที่ต้องการเพิ่ม</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* ชื่อสนาม */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    ชื่อสนาม <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="เช่น สนามฟุตบอล A"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                  />
                </div>

                {/* ประเภทกีฬา */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    ประเภทกีฬา <span className="text-red-400">*</span>
                  </label>
                  <select className={inputCls} value={form.sportType} onChange={(e) => setField('sportType', e.target.value)}>
                    {SPORT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {/* ราคา */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    ราคา/ชั่วโมง (บาท) <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    placeholder="เช่น 300"
                    value={form.pricePerHour}
                    onChange={(e) => setField('pricePerHour', e.target.value)}
                    required
                  />
                </div>

                {/* เวลาเปิด */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">เวลาเปิด</label>
                  <input className={inputCls} type="time" value={form.openTime} onChange={(e) => setField('openTime', e.target.value)} />
                </div>

                {/* เวลาปิด */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">เวลาปิด</label>
                  <input className={inputCls} type="time" value={form.closeTime} onChange={(e) => setField('closeTime', e.target.value)} />
                </div>

                {/* สถานที่ */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">สถานที่</label>
                  <input
                    className={inputCls}
                    placeholder="เช่น ถนนสุขุมวิท กรุงเทพฯ"
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                  />
                </div>

                {/* สิ่งอำนวยความสะดวก */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    สิ่งอำนวยความสะดวก
                    <span className="text-gray-400 font-normal ml-1">(คั่นด้วย ,)</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="เช่น ที่จอดรถ, ห้องน้ำ, ตู้น้ำ"
                    value={form.facilities}
                    onChange={(e) => setField('facilities', e.target.value)}
                  />
                </div>

                {/* รูปภาพ */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">รูปภาพสนาม</label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input
                        className={inputCls}
                        placeholder="https://example.com/image.jpg หรืออัปโหลดจากเครื่อง"
                        value={form.imageUrl}
                        onChange={(e) => setField('imageUrl', e.target.value)}
                      />
                    </div>
                    <label className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition whitespace-nowrap ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploading ? '⏳' : '📷'} {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  </div>
                  {form.imageUrl && (
                    <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-auto rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                  )}
                </div>

                {/* พิกัด GPS สำหรับแผนที่ */}
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Latitude <span className="text-gray-400 font-normal">(สำหรับแผนที่)</span></label>
                  <input className={inputCls} type="number" step="any" placeholder="เช่น 13.736717" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Longitude <span className="text-gray-400 font-normal">(สำหรับแผนที่)</span></label>
                  <input className={inputCls} type="number" step="any" placeholder="เช่น 100.523186" value={form.lng} onChange={(e) => setField('lng', e.target.value)} />
                </div>

                {/* รายละเอียด */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">รายละเอียดเพิ่มเติม</label>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={3}
                    placeholder="อธิบายสนามเพิ่มเติม..."
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                  />
                </div>

                {/* ราคาตามช่วงเวลา */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      ราคาตามช่วงเวลา <span className="text-gray-400 font-normal">(ถ้าไม่ตั้ง ใช้ราคาปกติ)</span>
                    </label>
                    <div className="flex gap-2">
                      {priceRules.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPriceRules([])}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                        >
                          ล้างทั้งหมด
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={addPriceRule}
                        className="text-xs px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition"
                      >
                        + เพิ่มช่วงราคา
                      </button>
                    </div>
                  </div>
                  {priceRules.length > 0 && (
                    <div className="space-y-2">
                      {priceRules.map((rule, idx) => (
                        <div key={idx} className="flex gap-2 items-center flex-wrap">
                          <input
                            type="time"
                            value={rule.startTime}
                            onChange={(e) => updatePriceRule(idx, 'startTime', e.target.value)}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                          />
                          <span className="text-gray-400 text-sm">-</span>
                          <input
                            type="time"
                            value={rule.endTime}
                            onChange={(e) => updatePriceRule(idx, 'endTime', e.target.value)}
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder="฿/ชม."
                            value={rule.pricePerHour}
                            onChange={(e) => updatePriceRule(idx, 'pricePerHour', e.target.value)}
                            className="w-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                          />
                          <input
                            type="text"
                            placeholder="ชื่อช่วง (ไม่บังคับ)"
                            value={rule.label}
                            onChange={(e) => updatePriceRule(idx, 'label', e.target.value)}
                            className="flex-1 min-w-[120px] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                          />
                          <button
                            type="button"
                            onClick={() => removePriceRule(idx)}
                            className="text-red-400 hover:text-red-600 transition text-xl leading-none px-1"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="gradient-btn px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังบันทึก...
                    </span>
                  ) : 'บันทึกสนาม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
