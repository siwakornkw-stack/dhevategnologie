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

interface Field {
  id: string;
  name: string;
  sportType: string;
  pricePerHour: number;
  location: string | null;
  description: string | null;
  facilities: string | null;
  imageUrl: string | null;
  images: string[];
  openTime: string;
  closeTime: string;
  isActive: boolean;
  priceRules?: { startTime: string; endTime: string; pricePerHour: number; label: string | null }[];
}

export function EditFieldForm({ field }: { field: Field }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [form, setFormState] = useState({
    name: field.name,
    sportType: field.sportType,
    pricePerHour: String(field.pricePerHour),
    location: field.location ?? '',
    description: field.description ?? '',
    facilities: field.facilities ?? '',
    imageUrl: field.imageUrl ?? '',
    images: field.images ?? [],
    openTime: field.openTime,
    closeTime: field.closeTime,
    isActive: field.isActive,
  });
  const [priceRules, setPriceRules] = useState<PriceRuleInput[]>(
    (field.priceRules ?? []).map((r) => ({
      startTime: r.startTime,
      endTime: r.endTime,
      pricePerHour: String(r.pricePerHour),
      label: r.label ?? '',
    })),
  );

  function addPriceRule() {
    setPriceRules((prev) => [...prev, { startTime: '08:00', endTime: '12:00', pricePerHour: '', label: '' }]);
  }
  function removePriceRule(idx: number) {
    setPriceRules((prev) => prev.filter((_, i) => i !== idx));
  }
  function updatePriceRule(idx: number, key: keyof PriceRuleInput, val: string) {
    setPriceRules((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  }

  function set(k: string, v: string | boolean | string[]) {
    setFormState((f) => ({ ...f, [k]: v }));
  }

  async function handleExtraImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingExtra(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/sport/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set('images', [...form.images, data.url]);
      toast.success('อัปโหลดรูปสำเร็จ');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingExtra(false);
      e.target.value = '';
    }
  }

  function removeExtraImage(idx: number) {
    set('images', form.images.filter((_, i) => i !== idx));
  }

  function handleClose() { setOpen(false); }

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
      set('imageUrl', data.url);
      toast.success('อัปโหลดรูปสำเร็จ');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('กรุณากรอกชื่อสนาม');
    if (!form.pricePerHour || Number(form.pricePerHour) <= 0) return toast.error('กรุณากรอกราคา');
    setLoading(true);
    try {
      const res = await fetch(`/api/sport/fields/${field.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          pricePerHour: Number(form.pricePerHour),
          priceRules: priceRules.map((r) => ({ ...r, pricePerHour: Number(r.pricePerHour) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('แก้ไขสนามสำเร็จ!');
      handleClose();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
      >
        แก้ไข
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">✏️ แก้ไขสนาม</h2>
                <p className="text-xs text-gray-400 mt-0.5">{field.name}</p>
              </div>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ชื่อสนาม <span className="text-red-400">*</span></label>
                  <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ประเภทกีฬา</label>
                  <select className={inputCls} value={form.sportType} onChange={(e) => set('sportType', e.target.value)}>
                    {SPORT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">ราคา/ชั่วโมง (บาท) <span className="text-red-400">*</span></label>
                  <input className={inputCls} type="number" min="1" value={form.pricePerHour} onChange={(e) => set('pricePerHour', e.target.value)} required />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">เวลาเปิด</label>
                  <input className={inputCls} type="time" value={form.openTime} onChange={(e) => set('openTime', e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">เวลาปิด</label>
                  <input className={inputCls} type="time" value={form.closeTime} onChange={(e) => set('closeTime', e.target.value)} />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">สถานที่</label>
                  <input className={inputCls} placeholder="เช่น ถนนสุขุมวิท กรุงเทพฯ" value={form.location} onChange={(e) => set('location', e.target.value)} />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">สิ่งอำนวยความสะดวก <span className="text-gray-400 font-normal">(คั่นด้วย ,)</span></label>
                  <input className={inputCls} placeholder="เช่น ที่จอดรถ, ห้องน้ำ" value={form.facilities} onChange={(e) => set('facilities', e.target.value)} />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">รูปภาพสนาม</label>
                  <div className="flex gap-2 items-start">
                    <input className={`${inputCls} flex-1`} placeholder="URL รูปภาพ" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} />
                    <label className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition whitespace-nowrap ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploading ? '⏳' : '📷'} {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  </div>
                  {form.imageUrl && <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-auto rounded-lg object-cover border border-gray-200 dark:border-gray-700" />}
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">รูปภาพเพิ่มเติม</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.images.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                        <button
                          type="button"
                          onClick={() => removeExtraImage(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          x
                        </button>
                      </div>
                    ))}
                    <label className={`h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition text-gray-400 text-xs ${uploadingExtra ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingExtra ? '...' : '+'}
                      <span className="text-[10px] mt-0.5">{uploadingExtra ? 'กำลังอัป' : 'เพิ่มรูป'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleExtraImageUpload} disabled={uploadingExtra} />
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">รายละเอียด</label>
                  <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">สถานะสนาม</label>
                  <button
                    type="button"
                    onClick={() => set('isActive', !form.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-xs font-medium ${form.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {form.isActive ? 'เปิดให้บริการ' : 'ปิดให้บริการ'}
                  </span>
                </div>

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

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="gradient-btn px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 min-w-[120px]">
                  {loading ? <span className="flex items-center gap-2 justify-center"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />บันทึก...</span> : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
